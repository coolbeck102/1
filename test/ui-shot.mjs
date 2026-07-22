// UI 重设计视觉验证截图（开始页 / 游戏中 HUD / 画线态 / 暂停卡片）
import { chromium } from 'playwright-core';
const URL = process.env.URL || 'http://localhost:5173/';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 900, height: 920 } });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('#game');
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/ui-start.png' });
// 开始游戏 -> 看 HUD（进度条 + cyan 玩家 idle）
await page.click('#startBtn');
await page.waitForTimeout(900);
await page.screenshot({ path: 'test/ui-game.png' });
// 画线态：按 j + 上，玩家进入 drawing（琥珀光晕）
await page.keyboard.down('j');
await page.keyboard.down('w');
await page.waitForTimeout(550);
await page.screenshot({ path: 'test/ui-drawing.png' });
await page.keyboard.up('w');
await page.keyboard.up('j');
// 暂停卡片
await page.keyboard.press('p');
await page.waitForTimeout(350);
await page.screenshot({ path: 'test/ui-pause.png' });
await browser.close();
console.log('screenshots done: ui-start / ui-game / ui-drawing / ui-pause');
