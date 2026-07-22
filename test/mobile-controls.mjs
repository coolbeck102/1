// 手机端控制验证：控件在游戏区下方、左右对调分居两端、摇杆钮居中于大圈、全局禁用长按菜单、可拖动。
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  userAgent: MOBILE_UA,
});
// 强制 coarse pointer，使触摸设备专属的 CSS/JS 分支（全局禁菜单）在桌面 Chromium 上也可验证
await page.emulateMedia({ forcedMediaFeatures: [{ name: 'pointer', value: 'coarse' }] });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const R = {};
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#game', { timeout: 10000 });

  await page.click('#startBtn');
  await page.waitForFunction(() => {
    const mc = document.querySelector('#mobileControls');
    return mc && !mc.classList.contains('hidden') && getComputedStyle(mc).display !== 'none';
  }, { timeout: 8000 });
  await page.waitForTimeout(800);

  const geo = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, top: b.top, bottom: b.bottom, left: b.left, right: b.right, cx: b.x + b.width / 2, cy: b.y + b.height / 2 }; };
    const mc = document.querySelector('#mobileControls');
    return {
      game: r('#game'), mc: r('#mobileControls'), draw: r('#drawBtn'), move: r('#movePad'), knob: r('#moveKnob'),
      mcJustify: getComputedStyle(mc).justifyContent,
      knobPos: getComputedStyle(document.querySelector('#moveKnob')).position,
      bodyUserSelect: getComputedStyle(document.body).userSelect,
      screenCenterX: window.innerWidth / 2,
    };
  });
  R.geo = geo;

  // 断言1：控制条在游戏区下方，不重叠
  R.controlsBelowGame = geo.mc.top >= geo.game.bottom - 1;
  R.overlapPixels = Math.max(0, geo.game.bottom - geo.mc.top);
  // 断言2：左右对调分居两端（划线在右、移动在左）
  R.drawRightOfMove = geo.draw.cx > geo.move.cx;
  R.buttonsSplit = geo.move.cx < geo.screenCenterX - 30 && geo.draw.cx > geo.screenCenterX + 30;
  // 断言3（核心修复）：摇杆小圆钮默认居中于移动大圈
  R.knobCenteredInPad = Math.abs(geo.knob.cx - geo.move.cx) <= 6 && Math.abs(geo.knob.cy - geo.move.cy) <= 6;
  R.knobAbsolute = geo.knobPos === 'absolute';
  // 断言4：全局禁菜单（CSS user-select:none 在触摸设备生效 + document 级 contextmenu 拦截）
  R.globalUserSelectNone = geo.bodyUserSelect === 'none';
  R.globalContextmenuBlocked = await page.evaluate(() => {
    const e = new Event('contextmenu', { bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });

  // 断言5：拖动移动盘 -> 摇杆从中心位移
  const mp = geo.move;
  await page.mouse.move(mp.cx, mp.cy);
  await page.mouse.down();
  await page.mouse.move(mp.cx + 30, mp.cy, { steps: 6 });
  R.knobMovedPx = await page.evaluate(() => {
    const k = document.querySelector('#moveKnob');
    const m = /translate\(calc\(-50% \+ (-?\d+)px\)/.exec(k.style.transform || '');
    return m ? Math.abs(parseInt(m[1], 10)) : 0;
  });
  await page.mouse.up();
  // 抬起后回中心
  await page.waitForTimeout(60);
  R.knobReturnsCenter = await page.evaluate(() => {
    const move = document.querySelector('#movePad').getBoundingClientRect();
    const k = document.querySelector('#moveKnob').getBoundingClientRect();
    const mcx = move.x + move.width / 2, mcy = move.y + move.height / 2;
    const kcx = k.x + k.width / 2, kcy = k.y + k.height / 2;
    return Math.abs(kcx - mcx) <= 6 && Math.abs(kcy - mcy) <= 6;
  });

  // 断言6：按住划线键 -> active 态
  const db = geo.draw;
  await page.mouse.move(db.cx, db.cy);
  await page.mouse.down();
  await page.waitForTimeout(120);
  R.drawActive = await page.evaluate(() => document.querySelector('#drawBtn').classList.contains('active'));
  await page.mouse.up();

  await page.screenshot({ path: 'test/mobile-controls.png' });
  await browser.close();

  console.log('MOBILE RESULT:', JSON.stringify(R, null, 2));
  const fail = [];
  if (errors.length) fail.push('CONSOLE ERRORS:\n' + errors.join('\n'));
  if (!R.controlsBelowGame) fail.push(`控制条未置于游戏区下方（重叠 ${R.overlapPixels}px）`);
  if (!R.drawRightOfMove) fail.push('左右未对调（划线键应在右、移动盘应在左）');
  if (!R.buttonsSplit) fail.push('两个大按钮未分居两端（应移动贴左、划线贴右）');
  if (!R.knobAbsolute) fail.push('摇杆钮未采用 absolute 定位（无法精确居中）');
  if (!R.knobCenteredInPad) fail.push(`摇杆钮未居中于大圈（偏差：x=${Math.abs(geo.knob.cx-geo.move.cx)} y=${Math.abs(geo.knob.cy-geo.move.cy)}px）`);
  if (!R.knobReturnsCenter) fail.push('拖动抬起后摇杆未回到大圈中心');
  if (!R.globalUserSelectNone) fail.push('全局 user-select 未禁用（触摸设备 body.userSelect 非 none）');
  if (!R.globalContextmenuBlocked) fail.push('全局 contextmenu 未被拦截（长按菜单仍可能弹出）');
  if (!(R.knobMovedPx > 5)) fail.push('移动盘拖动无效（摇杆位移 ' + R.knobMovedPx + 'px）');
  if (!R.drawActive) fail.push('按住划线键未进入 active 态');

  if (fail.length) { console.error('\n❌ MOBILE CONTROL TEST FAILED:\n' + fail.join('\n')); process.exit(2); }
  console.log('\n✅ MOBILE CONTROL TEST PASSED —— 控件在游戏区下方、左右分居两端、摇杆钮居中于大圈、全局禁用长按菜单、可拖动');
  process.exit(0);
} catch (err) {
  console.error('MOBILE CONTROL TEST FAILED:', err.message);
  if (errors.length) console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  try { await page.screenshot({ path: 'test/mobile-controls-fail.png' }); } catch {}
  try { await browser.close(); } catch {}
  process.exit(1);
}
