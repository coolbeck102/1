// 手机端游戏区放大验证：进局后确认标题/副标题/「单次」已隐藏，游戏区显著加高，画布正常
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({
  channel: 'msedge', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
});
const page = await context.newPage();
await context.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
const client = await context.newCDPSession(page);
await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#startScreen', { timeout: 10000 });
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#startScreen')?.classList.contains('hidden'), { timeout: 8000 });
  await page.waitForTimeout(1200);

  const geo = await page.evaluate(() => {
    const disp = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'missing'; };
    const wrap = document.querySelector('#gameWrap').getBoundingClientRect();
    const controls = document.querySelector('#mobileControls').getBoundingClientRect();
    const panel = document.querySelector('#panel').getBoundingClientRect();
    return {
      h1: disp('h1'), sub: disp('.sub'), capture: disp('.hud-capture'), tip: disp('#tip'),
      wrapW: Math.round(wrap.width), wrapH: Math.round(wrap.height),
      wrapBottom: Math.round(wrap.bottom), controlsTop: Math.round(controls.top),
      panelH: Math.round(panel.height), vpH: window.innerHeight,
      native43H: Math.round(wrap.width * 0.75),
    };
  });

  await page.screenshot({ path: 'test/mobile-gamearea.png', fullPage: false });
  await browser.close();

  console.log('GAME AREA GEO:', JSON.stringify(geo, null, 2));
  const fail = [];
  if (geo.h1 !== 'none') fail.push('标题 h1「昆虫防线」未隐藏');
  if (geo.sub !== 'none') fail.push('副标题 .sub「每过一关…」未隐藏');
  if (geo.capture !== 'none') fail.push('HUD「单次」未隐藏');
  if (geo.wrapH <= geo.native43H + 20) fail.push(`游戏区未加高: 现高 ${geo.wrapH} vs 原4:3高 ${geo.native43H}`);
  if (geo.wrapBottom > geo.controlsTop + 2) fail.push(`游戏区与控制条重叠: wrapBottom=${geo.wrapBottom} controlsTop=${geo.controlsTop}`);
  if (geo.controlsTop > geo.vpH) fail.push(`控制条超出视口底: controlsTop=${geo.controlsTop} vpH=${geo.vpH}`);
  if (errors.length) fail.push('运行时错误:\n' + errors.join('\n'));
  if (fail.length) { console.error('\n❌ GAME AREA FAILED:\n' + fail.join('\n')); process.exit(2); }
  console.log(`\n✅ GAME AREA PASSED —— 游戏区加高 ${geo.native43H}px → ${geo.wrapH}px (+${Math.round((geo.wrapH/geo.native43H-1)*100)}%)，标题/副标题/单次已隐藏，无重叠`);
  process.exit(0);
} catch (err) {
  console.error('GAME AREA TEST FAILED:', err.message);
  if (errors.length) console.error('ERRORS:\n' + errors.join('\n'));
  try { await browser.close(); } catch {}
  process.exit(1);
}
