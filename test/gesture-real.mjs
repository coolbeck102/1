import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await p.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click('#startBtn').catch(()=>{});
await page.waitForTimeout(1500);
const cdp = await page.context().newCDPSession(page);

// 用 CDP 真实触摸（会生成真实 pointerId，setPointerCapture 正常）
const padBox = await page.evaluate(() => { const r = document.getElementById('movePad').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const btnBox = await page.evaluate(() => { const r = document.getElementById('drawBtn').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
const padC = { x: padBox.x + padBox.w / 2, y: padBox.y + padBox.h / 2 };
const btnC = { x: btnBox.x + btnBox.w / 2, y: btnBox.y + btnBox.h / 2 };

// 1) 单指拖动摇杆 → knob 应位移
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: padC.x, y: padC.y }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: padC.x + 40, y: padC.y + 40 }] });
await page.waitForTimeout(120);
const knobMove = await page.evaluate(() => document.getElementById('moveKnob').style.transform);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('1) 单指摇杆拖动 knob:', knobMove, knobMove.includes('translate') && knobMove !== 'translate(-50%, -50%)' ? '✅ 正常位移' : '❌ 未动');

// 2) 双指同时按住（摇杆 + 划线钮）→ 游戏事件仍收到 + 默认被拦
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: padC.x, y: padC.y }, { x: btnC.x, y: btnC.y }] });
await page.waitForTimeout(200);
const twoFingerState = await page.evaluate(() => ({
  drawActive: document.getElementById('drawBtn').classList.contains('active'),  // 划线钮按下态
  knobTransform: document.getElementById('moveKnob').style.transform,
}));
const blocked = await page.evaluate(() => {
  let dp = false;
  const probe = e => { dp = e.defaultPrevented; };
  document.addEventListener('touchmove', probe, { once: true });
  return dp;
});
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
console.log('2) 双指同时按住: 划线钮active=', twoFingerState.drawActive, ' 摇杆位移=', twoFingerState.knobTransform);
console.log('   → 游戏自身触摸事件是否仍被处理（划线钮亮起=是）:', twoFingerState.drawActive);

// 3) 双指 touchmove 是否 preventDefault（浏览器手势被拦）
const twoMove = await page.evaluate(() => {
  let dp = null;
  const probe = e => { dp = e.defaultPrevented; };
  document.addEventListener('touchmove', probe, { once: true });
  const pad = document.getElementById('movePad').getBoundingClientRect();
  const btn = document.getElementById('drawBtn').getBoundingClientRect();
  const t1 = new Touch({ identifier: 11, target: document.getElementById('movePad'), clientX: pad.left + 5, clientY: pad.top + 5 });
  const t2 = new Touch({ identifier: 12, target: document.getElementById('drawBtn'), clientX: btn.left + 5, clientY: btn.top + 5 });
  const ev = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [t1, t2], targetTouches: [t1, t2], changedTouches: [t1, t2] });
  document.dispatchEvent(ev);
  return dp;
});
console.log('3) 双指 touchmove defaultPrevented(浏览器手势被拦)=', twoMove);

console.log('pageerrors:', errors.length, errors.slice(0,3).join(' | '));
await p.close();