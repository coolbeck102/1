import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg' };
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

const lvl1 = await page.evaluate(()=> window.__h5test.meterVis(0)); // 第1关
const lvl3 = await page.evaluate(()=> window.__h5test.meterVis(2)); // 第3关
const lvl9 = await page.evaluate(()=> window.__h5test.meterVis(8)); // 第9关

console.log('LVL1 (curIdx=0):', JSON.stringify(lvl1));
console.log('LVL3 (curIdx=2):', JSON.stringify(lvl3));
console.log('LVL9 (curIdx=8):', JSON.stringify(lvl9));
console.log('ERRORS', errors.length ? errors.join(' | ') : 'none');

// 预期：第1关 meterHidden=false hintHidden=false；后续关 meterHidden=true hintHidden=true
const pass = lvl1.meterHidden===false && lvl1.hintHidden===false
  && lvl3.meterHidden===true && lvl3.hintHidden===true
  && lvl9.meterHidden===true && lvl9.hintHidden===true
  && errors.length===0;
console.log(pass ? 'PASS ✅ 占领比例条+教程说明仅第1关显示' : 'FAIL ❌');

await browser.close();
server.close();
process.exit(pass ? 0 : 1);
