// 障碍草地化验证：用存档解锁第 9 关（障碍多、种类全），截高清图
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
// 直接写存档：解锁到第 9 关（maxCleared=8），muted 避免无头音频
await page.evaluate(() => { localStorage.setItem('kcfx_save_v1', JSON.stringify({maxCleared:8,clearedImages:[],adBlocks:0,purchased:false,highScore:0,muted:true})); });
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#game');
await page.waitForTimeout(400);
await page.click('#startBtn');
await page.waitForTimeout(900);
await page.screenshot({ path: 'test/obstacle.png' });
// 局部放大，看清障碍细节
await page.screenshot({ path: 'test/obstacle-zoom.png', clip: { x: 250, y: 170, width: 420, height: 360 } });
await browser.close();
console.log('obstacle shots done; pageerrors=', errors.length, errors.slice(0,3));
