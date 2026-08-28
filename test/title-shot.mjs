import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const errs = [];
const d = await p.newPage({ viewport: { width: 1280, height: 860 } });
d.on('pageerror', e => errs.push('D:' + e));
await d.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await d.waitForTimeout(1600);
await d.screenshot({ path: 'test/title-desktop.png' });
const m = await p.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
m.on('pageerror', e => errs.push('M:' + e));
await m.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await m.waitForTimeout(1600);
await m.screenshot({ path: 'test/title-mobile.png' });
// 诊断：关键 id 都在（JS 零改动的保障）
const diag = await m.evaluate(() => ({
  startBtn: !!document.getElementById('startBtn'),
  galleryBtn: !!document.getElementById('galleryBtn'),
  settingsBtn: !!document.getElementById('settingsBtn'),
  hiScore: !!document.getElementById('hiScore'),
  unlockCount: !!document.getElementById('unlockCount'),
  levelGridHTML: (document.getElementById('levelGrid')?.innerHTML || '').slice(0, 60),
  startBtnText: document.getElementById('startBtn')?.textContent,
}));
console.log('diag:', JSON.stringify(diag));
console.log('errors:', errs.length, errs.slice(0,3).join(' | '));
await p.close();
