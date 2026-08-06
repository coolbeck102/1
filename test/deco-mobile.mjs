import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await p.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'test/deco-m-start.png' });
// enter game (mobile uses startBtn too)
await page.click('#startBtn').catch(()=>{});
await page.waitForTimeout(1800);
await page.screenshot({ path: 'test/deco-m-game.png' });
// pause overlay bokeh
await page.click('#pauseBtn').catch(()=>{});
await page.waitForTimeout(800);
await page.screenshot({ path: 'test/deco-m-pause.png' });
// sanity: decoration nodes present + non-blocking
const diag = await page.evaluate(() => {
  const deco = document.getElementById('deco');
  const amb = document.getElementById('ambient');
  const cs = deco ? getComputedStyle(deco) : null;
  const leaf = document.querySelector('#deco .leaf');
  const spark = document.querySelector('#ambient .spark');
  return {
    hasDeco: !!deco, hasAmbient: !!amb,
    decoZ: cs && cs.zIndex, decoPE: cs && cs.pointerEvents,
    leafBox: leaf ? leaf.getBoundingClientRect() : null,
    sparkBg: spark ? getComputedStyle(spark).backgroundColor : null,
    mobileControlsVisible: !document.getElementById('mobileControls').classList.contains('hidden')
  };
});
console.log('diag:', JSON.stringify(diag));
console.log('pageerrors:', errors.length, errors.slice(0,3).join(' | '));
await p.close();
