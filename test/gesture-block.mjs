import { chromium } from 'playwright-core';
const p = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const page = await p.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.click('#startBtn').catch(()=>{});
await page.waitForTimeout(1500);

// 1) 双指 touchstart：应 defaultPrevented=true（被拦），且事件仍派发到 document
const twoFinger = await page.evaluate(() => {
  let reached = false;
  const probe = () => { reached = true; };
  document.addEventListener('touchstart', probe, { once: true });
  const pad = document.getElementById('movePad').getBoundingClientRect();
  const btn = document.getElementById('drawBtn').getBoundingClientRect();
  const t1 = new Touch({ identifier: 1, target: document.getElementById('movePad'), clientX: pad.left + 10, clientY: pad.top + 10 });
  const t2 = new Touch({ identifier: 2, target: document.getElementById('drawBtn'), clientX: btn.left + 10, clientY: btn.top + 10 });
  const ev = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t1, t2], targetTouches: [t1, t2], changedTouches: [t1, t2] });
  const dispatched = document.dispatchEvent(ev);
  return { reached, defaultPrevented: ev.defaultPrevented, dispatched };
});

// 2) 单指 touchstart：不应被 preventDefault 拦（不影响正常操作）
const oneFinger = await page.evaluate(() => {
  const pad = document.getElementById('movePad').getBoundingClientRect();
  const t1 = new Touch({ identifier: 1, target: document.getElementById('movePad'), clientX: pad.left + 10, clientY: pad.top + 10 });
  const ev = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t1], targetTouches: [t1], changedTouches: [t1] });
  document.dispatchEvent(ev);
  return { defaultPrevented: ev.defaultPrevented };
});

// 3) 真实单指 pointer 操作仍工作：模拟摇杆拖动（走一步看 moveKnob 位移）
const padOp = await page.evaluate(() => {
  const pad = document.getElementById('movePad');
  const r = pad.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: cx, clientY: cy, bubbles: true }));
  pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: cx + 40, clientY: cy + 40, bubbles: true }));
  pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: cx + 40, clientY: cy + 40, bubbles: true }));
  const knob = document.getElementById('moveKnob').style.transform;
  return { knob };
});

console.log('双指 touchstart :', JSON.stringify(twoFinger));
console.log('   -> reached(事件仍派发)=', twoFinger.reached, ' defaultPrevented(默认被拦)=', twoFinger.defaultPrevented);
console.log('单指 touchstart :', JSON.stringify(oneFinger), ' (不应被拦)');
console.log('摇杆 pointer 操作 knob 位移:', padOp.knob);
console.log('pageerrors:', errors.length, errors.slice(0,3).join(' | '));
await p.close();