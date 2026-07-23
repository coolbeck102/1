import { chromium } from 'playwright-core';
import path from 'path';

const URL = 'http://localhost:5173/';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const browser = await chromium.launch({ executablePath: EDGE, args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true,
});
const page = await context.newPage();
const client = await context.newCDPSession(page);
await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
const fail = [];
const log = (...a) => console.log(...a);

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#startScreen', { timeout: 10000 });
  await page.click('#startBtn');
  await page.waitForTimeout(1500);

  const geo = await page.evaluate(() => {
    const cv = document.getElementById('game');
    const gw = document.getElementById('gameWrap');
    const db = document.getElementById('drawBtn');
    const mp = document.getElementById('movePad');
    const r = gw.getBoundingClientRect();
    const rdb = db.getBoundingClientRect();
    const rmp = mp.getBoundingClientRect();
    return {
      cw: cv.width, ch: cv.height,
      gwW: r.width, gwH: r.height, gwBottom: r.bottom,
      drawBottom: rdb.bottom, drawTop: rdb.top,
      moveBottom: rmp.bottom, moveTop: rmp.top,
      innerH: window.innerHeight,
    };
  });
  log('canvas 内部:', geo.cw + 'x' + geo.ch, '| gameWrap 显示:', Math.round(geo.gwW) + 'x' + Math.round(geo.gwH));
  log('视口高:', geo.innerH, '| 游戏区底:', Math.round(geo.gwBottom), '| 划线键底:', Math.round(geo.drawBottom), '| 移动盘底:', Math.round(geo.moveBottom));

  // 断言1：手机端世界是竖向 600x900
  if (geo.cw === 600 && geo.ch === 900) log('PASS 世界为竖向 600x900');
  else fail.push(`世界比例错误: ${geo.cw}x${geo.ch} (期望 600x900)`);

  // 断言2：显示框宽高比严格 2:3（不拉伸）
  const dispRatio = geo.gwW / geo.gwH;
  const expectRatio = 600 / 900; // 0.6667
  if (Math.abs(dispRatio - expectRatio) < 0.03) log('PASS 显示框 2:3 不变形 (ratio=' + dispRatio.toFixed(3) + ')');
  else fail.push(`显示框被拉伸: ratio=${dispRatio.toFixed(3)} (期望~${(expectRatio).toFixed(3)})`);

  // 断言3：游戏区高度明显高于旧 4:3(292) 且不超过视口
  if (geo.gwH > 450) log('PASS 游戏区加高 (H=' + Math.round(geo.gwH) + 'px > 旧 292)');
  else fail.push(`游戏区高度不足: ${Math.round(geo.gwH)}`);
  if (geo.gwH <= geo.innerH) log('PASS 游戏区未超出视口');
  else fail.push('游戏区超出视口高度');

  // 断言3b：两个控制按钮完整落在视口内（本次修复重点）
  const maxBtnBottom = Math.max(geo.drawBottom, geo.moveBottom);
  if (maxBtnBottom <= geo.innerH) log('PASS 控制按钮完整在视口内 (按钮底=' + Math.round(maxBtnBottom) + ' <= 视口=' + geo.innerH + ')');
  else fail.push('控制按钮被挤出视口: 按钮底=' + Math.round(maxBtnBottom) + ' > 视口=' + geo.innerH);
  // 断言3c：按钮不与游戏区重叠（按钮顶 >= 游戏区底）
  const minBtnTop = Math.min(geo.drawTop, geo.moveTop);
  if (minBtnTop >= geo.gwBottom - 1) log('PASS 按钮不遮挡游戏区 (按钮顶=' + Math.round(minBtnTop) + ' >= 游戏区底=' + Math.round(geo.gwBottom) + ')');
  else fail.push('按钮与游戏区重叠: 按钮顶=' + Math.round(minBtnTop) + ' < 游戏区底=' + Math.round(geo.gwBottom));

  // 断言4：刷怪/绘制无异常（spawnAudit 需传参 n，否则循环不执行 total 恒 0）
  const r = await page.evaluate(() => window.__h5test.spawnAudit(1));
  if (r && r.total > 0 && r.bad === 0) log('PASS 刷怪正常 (total=' + r.total + ', bad=' + r.bad + ')');
  else fail.push('刷怪异常: ' + JSON.stringify(r));

  await page.screenshot({ path: 'test/mobile-portrait.png' });
  log('截图已存 test/mobile-portrait.png');
} catch (e) {
  fail.push('脚本异常: ' + e.message);
} finally {
  if (errors.length) log('页面错误:', errors.join(' | '));
  await browser.close();
}

if (fail.length) { console.log('\n❌ 失败:'); fail.forEach((f) => console.log(' - ' + f)); process.exit(1); }
else { console.log('\n✅ 全部通过：手机端竖向世界，草地/角色/障碍无拉伸'); }
