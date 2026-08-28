import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await p.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.click('#startBtn').catch(()=>{});
await page.waitForTimeout(2000);
await page.screenshot({ path: 'test/ctrl-v2-game.png' });

// 诊断：控制条布局 + 热区尺寸 + 重叠检测
const diag = await page.evaluate(() => {
  const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom }; };
  const pad = box('movePad'), btn = box('drawBtn'), ctrl = box('mobileControls');
  const padAfter = getComputedStyle(document.getElementById('movePad'), '::after');
  const btnAfter = getComputedStyle(document.getElementById('drawBtn'), '::after');
  const gap = btn.x - pad.right;
  // 热区间距：pad 热区右缘到 btn 热区左缘
  const padZoneR = pad.x + parseFloat(padAfter.width) / 2;
  const btnZoneL = btn.x + btn.right - btn.x - parseFloat(btnAfter.width) / 2;
  const zoneGap = btnZoneL - padZoneR;
  return {
    ctrlW: ctrl.w, ctrlH: ctrl.h,
    pad: pad, btn: btn,
    knobW: box('moveKnob').w,
    padZoneW: padAfter.width, btnZoneW: btnAfter.width,
    visualGap: Math.round(gap),
    zoneGap: Math.round(zoneGap),
    overlap: zoneGap < 0
  };
});
console.log('diag:', JSON.stringify(diag, null, 1));
console.log('pageerrors:', errors.length, errors.slice(0,3).join(' | '));
await p.close();