import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err,data)=>{
    if (err) { res.statusCode = 404; res.end('nf'); return; }
    res.setHeader('Content-Type', types[path.extname(fp)] || 'application/octet-stream');
    res.end(data);
  });
});

await new Promise(r => server.listen(0, r));
const port = server.address().port;
const url = `http://localhost:${port}/index.html`;

const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', args:['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(500);

// 反复随机重开关卡，审计所有敌人出生点是否落在 mask!==0（障碍=3 / 已占=1）
const trials = Number(process.argv[2] || 200);
const audit = await page.evaluate((n)=> window.__h5test.spawnAudit(n), trials);

console.log('AUDIT', JSON.stringify(audit));
console.log('PAGE_ERRORS', errors.length ? errors.join(' | ') : 'none');

await browser.close();
server.close();
process.exit(audit.bad === 0 && errors.length === 0 ? 0 : 1);
