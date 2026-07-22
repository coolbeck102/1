import { chromium } from 'playwright-core';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname, join } from 'path';

const ROOT = process.cwd();
const PORT = 5181;
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
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERR:' + e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

// unlock everything so startBtn goes straight into the game
await page.evaluate(() => { window.__h5test.unlockAll && window.__h5test.unlockAll(); });
await page.evaluate(() => { document.getElementById('startBtn').click(); });
await page.waitForTimeout(200);

const perLevel = [];
for (let step = 0; step <= 25; step++) {
  const started = await page.evaluate(() => window.__h5test.forceWin());
  let maxT = 0, sawVictory = false, sawPanelDuringAnim = false;
  // sample animation frames
  for (let f = 0; f < 24; f++) {
    await page.waitForTimeout(50);
    const s = await page.evaluate(() => window.__h5test.winState());
    if (s.victory) { sawVictory = true; maxT = Math.max(maxT, s.victoryT); }
  }
  // let finishVictory run -> show levelResult
  await page.waitForTimeout(2400);
  const after = await page.evaluate(() => window.__h5test.winState());
  const levelLabel = await page.evaluate(() => document.getElementById('resultTitle').textContent);
  perLevel.push({ step, started, maxT, sawVictory, victoryEnded: after.victory === false, levelResultShown: after.levelResultShown, levelLabel });
  const hasNext = await page.evaluate(() => !document.getElementById('levelResult').classList.contains('hidden'));
  if (hasNext) {
    await page.evaluate(() => document.getElementById('nextLevelBtn').click());
    await page.waitForTimeout(150);
  } else {
    break;
  }
}

console.log('CONSOLE_ERRORS:', errors.length ? errors : 'none');
console.log(JSON.stringify(perLevel, null, 1));
await browser.close();
server.close();
