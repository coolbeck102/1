import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const server = http.createServer((req,res)=>{
  const p = decodeURIComponent(req.url.split('?')[0]) === '/' ? '/index.html' : decodeURIComponent(req.url.split('?')[0]);
  fs.readFile(path.join(ROOT, p), (err,data)=>{
    if (err) { res.statusCode = 404; res.end('nf'); return; }
    res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
    res.end(data);
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args:['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(400);
/* 点击"开始"按钮进入游戏态（隐藏开始菜单遮罩），再注入障碍物截图 */
await page.click('#startBtn');
await page.waitForTimeout(500);
const n = await page.evaluate(()=> window.__h5test.injectObstacles());
await page.waitForTimeout(200);
const shot = path.resolve('test/obstacle-clean.png');
await page.screenshot({ path: shot });
console.log('OK n=' + n + ' err=' + (errors.length?errors.join('|'):'none') + ' shot=' + shot);
await browser.close();
server.close();
