import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const sizes = [
  { name: 'Android 小屏 360x740', width: 360, height: 740 },
  { name: 'iPhone 14 390x844',   width: 390, height: 844 },
  { name: '大屏 430x932',        width: 430, height: 932 },
  { name: '横屏 844x390',        width: 844, height: 390 },
];
let allOk = true;
for (const s of sizes) {
  const page = await p.newPage({ viewport: { width: s.width, height: s.height }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.click('#startBtn').catch(()=>{});
  await page.waitForTimeout(1200);
  const d = await page.evaluate(() => {
    const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    const pad = box('movePad'), btn = box('drawBtn');
    const padAfter = getComputedStyle(document.getElementById('movePad'), '::after');
    const btnAfter = getComputedStyle(document.getElementById('drawBtn'), '::after');
    const padZoneR = pad.x + parseFloat(padAfter.width) / 2;
    const btnZoneL = btn.right - parseFloat(btnAfter.width) / 2;
    const inViewport = pad.x >= 0 && btn.right <= innerWidth && pad.bottom <= innerHeight && btn.bottom <= innerHeight;
    return { pad, btn, visualGap: btn.x - pad.right, zoneGap: Math.round(btnZoneL - padZoneR), inViewport, overlap: btnZoneL - padZoneR < 0, errCount: 0 };
  });
  d.errCount = errors.length;
  const ok = d.inViewport && !d.overlap && d.errCount === 0;
  if (!ok) allOk = false;
  console.log(`[${ok ? 'OK ' : 'FAIL'}] ${s.name}`);
  console.log(`   pad x=${d.pad.x}~${d.pad.right}  btn x=${d.btn.x}~${d.btn.right}  视觉间隔=${d.visualGap}px  热区间隔=${d.zoneGap}px  视口内=${d.inViewport}  重叠=${d.overlap}  err=${d.errCount}`);
  await page.close();
}
console.log(allOk ? '\nALL PASS' : '\nSOME FAILED');
await p.close();