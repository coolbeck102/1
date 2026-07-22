// 3x 高清游戏画面：验证角色图形化（甲虫/虫子/道具徽章的填充细节）
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 820, height: 700 }, deviceScaleFactor: 3 });
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#game');
await page.waitForTimeout(400);
await page.click('#startBtn');
await page.waitForTimeout(500);
// 画线进入黑区，让 cyan 甲虫 + 琥珀光晕 + 拖尾进入画面
await page.keyboard.down('j');
await page.keyboard.down('w');
await page.waitForTimeout(850);
await page.screenshot({ path: 'test/char-hd.png' });
await browser.close();
console.log('hd done');
