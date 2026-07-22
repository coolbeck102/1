import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname, join } from 'path';

const ROOT = process.cwd();
const PORT = 5183;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = join(ROOT, p);
  try {
    const buf = readFileSync(fp);
    const ext = extname(fp);
    const ct = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.evaluate(() => { window.__h5test.unlockAll && window.__h5test.unlockAll(); });
await page.evaluate(() => { document.getElementById('startBtn').click(); });
await page.waitForTimeout(200);

async function winAndShoot(tag){
  await page.evaluate(() => window.__h5test.forceWin());
  // capture at ~0.6s and ~1.4s into animation
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test/victory_${tag}_a.png` });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test/victory_${tag}_b.png` });
  // finish
  await page.waitForTimeout(2200);
  const s = await page.evaluate(() => window.__h5test.winState());
  console.log(tag, JSON.stringify(s));
  const hasNext = await page.evaluate(() => !document.getElementById('levelResult').classList.contains('hidden'));
  if (hasNext) { await page.evaluate(() => document.getElementById('nextLevelBtn').click()); await page.waitForTimeout(150); }
  return hasNext;
}

await winAndShoot('lvl1');
for (let i=0;i<6;i++){ const h=await winAndShoot('lvl'+(i+2)); if(!h) break; }
await browser.close();
server.close();
