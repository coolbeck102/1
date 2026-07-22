// 手机端进局冒烟：验证 isMobile 路径下可正常开始、刷怪无误（减速改动不影响正确性）
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
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });

try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#startScreen', { timeout: 10000 });
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#startScreen')?.classList.contains('hidden'), { timeout: 8000 });
  // 运行 2 秒
  await page.waitForTimeout(2000);
  // 移动控件应显示（手机端）
  const mobileShown = await page.evaluate(() => !document.querySelector('#mobileControls')?.classList.contains('hidden'));
  // 刷怪正确性审计（多关）
  const audit = await page.evaluate(() => window.__h5test && window.__h5test.spawnAudit(8));
  await page.screenshot({ path: 'test/mobile-game.png', fullPage: false });

  await browser.close();

  const R = { mobileShown, audit, errors };
  console.log('MOBILE SANITY:', JSON.stringify(R, null, 2));
  const fail = [];
  if (!mobileShown) fail.push('手机端移动控件未显示');
  if (!audit || audit.bad !== 0) fail.push('刷怪审计异常: ' + JSON.stringify(audit));
  if (errors.length) fail.push('运行时错误:\n' + errors.join('\n'));
  if (fail.length) { console.error('\n❌ MOBILE SANITY FAILED:\n' + fail.join('\n')); process.exit(2); }
  console.log('\n✅ MOBILE SANITY PASSED —— 手机端可正常进局、刷怪无误');
  process.exit(0);
} catch (err) {
  console.error('MOBILE SANITY FAILED:', err.message);
  if (errors.length) console.error('ERRORS:\n' + errors.join('\n'));
  try { await browser.close(); } catch {}
  process.exit(1);
}
