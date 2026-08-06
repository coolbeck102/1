import { chromium } from 'playwright-core';
const EXE = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await p.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'test/deco-start.png' });
// enter game
await page.click('#startBtn').catch(()=>{});
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/deco-game.png' });
// pause overlay (bokeh backdrop)
await page.click('#pauseBtn').catch(()=>{});
await page.waitForTimeout(700);
await page.screenshot({ path: 'test/deco-pause.png' });
console.log('pageerrors:', errors.length, errors.slice(0,3).join(' | '));
await p.close();
