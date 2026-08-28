import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const errs = [];

// --- 桌面 1280x860 ---
const desktop = await p.newPage({ viewport: { width: 1280, height: 860 } });
desktop.on('pageerror', e => errs.push('D:' + e));
await desktop.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await desktop.waitForTimeout(1000);
await desktop.click('#startBtn').catch(()=>{});
await desktop.waitForTimeout(2500);
//  // 多走几格让敌人/障碍/草地都进画面
for (const k of ['ArrowRight','ArrowRight','ArrowDown','ArrowDown','KeyJ','ArrowDown','ArrowDown','ArrowLeft','ArrowLeft','ArrowUp','ArrowUp']) {
  await desktop.keyboard.down(k);
  if (k === 'KeyJ') await desktop.waitForTimeout(150); else await desktop.waitForTimeout(80);
  await desktop.keyboard.up(k);
  await desktop.waitForTimeout(60);
}
await desktop.waitForTimeout(800);
await desktop.screenshot({ path: 'test/visual-v2-desktop.png' });

// --- 手机 390x844 ---
const mobile = await p.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
mobile.on('pageerror', e => errs.push('M:' + e));
await mobile.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await mobile.waitForTimeout(1000);
await mobile.click('#startBtn').catch(()=>{});
await mobile.waitForTimeout(2200);
await mobile.screenshot({ path: 'test/visual-v2-mobile.png' });

console.log('errors:', errs.length, errs.slice(0,3).join(' | '));
await p.close();