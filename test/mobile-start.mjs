// 手机端主界面（开始/相册/设置）按钮可见性验证
// 模拟 iPhone 视口 + 触摸 + pointer:coarse，断言三个按钮完整落在视口内、不被 4:3 游戏框裁切。
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  deviceScaleFactor: 3,
});
const page = await context.newPage();

// 加载前清空存档，保证从干净状态开始
await context.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });

// 强制 pointer:coarse（CSS 媒体查询依赖它）
const client = await context.newCDPSession(page);
await client.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#startScreen', { timeout: 10000 });

  const geo = await page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth;
    const ss = document.querySelector('#startScreen');
    const ssPos = getComputedStyle(ss).position;
    const ids = ['startBtn', 'galleryBtn', 'settingsBtn'];
    const boxes = {};
    for (const id of ids) {
      const r = document.getElementById(id).getBoundingClientRect();
      boxes[id] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
                    top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    }
    return { vh, vw, ssPos, boxes };
  });

  await page.screenshot({ path: 'test/mobile-start.png', fullPage: false });

  const R = geo;
  const fail = [];
  // 断言1：主界面在手机端铺满全屏（fixed）
  if (R.ssPos !== 'fixed') fail.push('主界面未铺满全屏(position=' + R.ssPos + ')');
  // 断言2：三个按钮完整落在视口内（bottom<=vh, top>=0, left>=0, right<=vw）
  for (const id of ['startBtn', 'galleryBtn', 'settingsBtn']) {
    const b = R.boxes[id];
    if (!b) { fail.push('找不到按钮 #' + id); continue; }
    if (b.top < 0) fail.push(`#${id} 顶部被裁 (top=${b.top})`);
    if (b.bottom > R.vh) fail.push(`#${id} 底部被裁 (bottom=${b.bottom} > vh=${R.vh})`);
    if (b.left < 0) fail.push(`#${id} 左侧被裁 (left=${b.left})`);
    if (b.right > R.vw) fail.push(`#${id} 右侧被裁 (right=${b.right} > vw=${R.vw})`);
  }
  R.startBtnVisible = R.boxes.startBtn && R.boxes.startBtn.bottom <= R.vh;
  R.galleryBtnVisible = R.boxes.galleryBtn && R.boxes.galleryBtn.bottom <= R.vh;
  R.settingsBtnVisible = R.boxes.settingsBtn && R.boxes.settingsBtn.bottom <= R.vh;

  await browser.close();

  console.log('MOBILE START RESULT:', JSON.stringify(R, null, 2));
  if (fail.length) {
    console.error('\n❌ MOBILE START FAILED:\n' + fail.join('\n'));
    process.exit(2);
  }
  console.log('\n✅ MOBILE START PASSED —— 手机端主界面(开始/相册/设置)完整可见、未被裁切');
  process.exit(0);
} catch (err) {
  console.error('MOBILE START FAILED:', err.message);
  if (errors.length) console.error('ERRORS:\n' + errors.join('\n'));
  try { await browser.close(); } catch {}
  process.exit(1);
}
