import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname, join } from 'path';

const ROOT = process.cwd();
const PORT = 5184;
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = join(ROOT, p);
  try {
    const buf = readFileSync(fp);
    res.writeHead(200, { 'Content-Type': extname(fp) === '.html' ? 'text/html' : extname(fp) === '.js' ? 'text/javascript' : 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await chromium.launch({ channel: 'msedge', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGE:' + e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

await page.evaluate(() => window.__h5test.unlockAll && window.__h5test.unlockAll());
await page.evaluate(() => document.getElementById('startBtn').click());
await page.waitForTimeout(200);

async function realPlayWin(tag){
  const pre = await page.evaluate(() => {
    const ws = window.__h5test;
    const s = ws ? ws.winState() : {};
    s.pctEl = document.getElementById('percent')?.textContent || '?';
    return s;
  });

  // Force win via real updateStats path
  const started = await page.evaluate(() => window.__h5test.forceWin());

  const postForce = await page.evaluate(() => {
    const ws = window.__h5test;
    return ws ? ws.winState() : {};
  });

  // Sample animation over ~1s
  let maxT = 0, sawVic = false;
  for (let f = 0; f < 20; f++) {
    await page.waitForTimeout(50);
    const s = await page.evaluate(() => {
      const ws = window.__h5test;
      return ws ? ws.winState() : {};
    });
    if (s.victory) { sawVic = true; maxT = Math.max(maxT, s.victoryT); }
  }

  // Wait for finishVictory → levelResult
  await page.waitForTimeout(2500);
  const final = await page.evaluate(() => ({
    victory: document.getElementById('levelResult')?.classList.contains('hidden') !== false,
    levelResultShown: !document.getElementById('levelResult')?.classList.contains('hidden'),
    resultTitle: document.getElementById('resultTitle')?.textContent || ''
  }));

  console.log(JSON.stringify({ tag, pre: { ...pre, pct: pre.pctEl }, started, postForce, maxT, sawVic, final }));

  const hasNext = !!(await page.evaluate(() =>
    document.getElementById('levelResult') && !document.getElementById('levelResult').classList.contains('hidden')
  ));
  if (hasNext) {
    await page.evaluate(() => document.getElementById('nextLevelBtn').click());
    await page.waitForTimeout(150);
  }
  return hasNext;
}

for (let i = 0; i < 15; i++) {
  const c = await realPlayWin('L' + (i + 1));
  if (!c) break;
}

// Test double-trigger safety
await page.evaluate(() => document.getElementById('startBtn').click());
await page.waitForTimeout(200);
const dt = await page.evaluate(() => {
  const r1 = window.__h5test.forceWin();
  const r2 = window.__h5test.triggerVictory ? window.__h5test.triggerVictory() : 'N/A';
  const ws = window.__h5test.winState();
  return { forceWin: r1, triggerDuringVictory: r2, ...ws };
});
console.log('\nDOUBLE:', JSON.stringify(dt));
console.log('\nERRS:', errors.length ? errors : 'none');
await browser.close();
server.close();
