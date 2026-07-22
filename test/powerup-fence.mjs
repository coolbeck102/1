// 道具拾取改造验证：从"走到格子自动吃"改为"用闭合区域围住才吃"。
// 启动本机 Edge 无头，进入第 1 关，验证：
//   1) 自然刷新的道具会出现在 powerups 数组（演示原 spawn 逻辑仍工作）；
//   2) 闭合线把道具围住 -> 道具从 powerups 消失且效果/HUD 生效（enclose=true）；
//   3) 闭合线不包围道具 -> 道具保留（enclose=false）。
// 截图存档 test/powerup-fence.png。
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const fail = [];
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load', timeout: 30000 });

  // 进入运行态
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#startScreen')?.classList.contains('hidden'), { timeout: 8000 });

  // 1) 等待自然刷新的道具（spawn 计时器默认 8s 触发）
  let natural = [];
  try {
    await page.waitForFunction(() => (window.__h5test && window.__h5test.getPowerups().length > 0), { timeout: 12000 });
    natural = await page.evaluate(() => window.__h5test.getPowerups());
  } catch {}
  console.log('NATURAL SPAWN powerups:', JSON.stringify(natural));
  if (natural.length === 0) fail.push('自然刷新道具未在 12s 内出现（spawn 逻辑异常）');

  // 2) + 3) 对每种道具，分别测试"围住"与"不包围"
  const results = {};
  for (const type of ['shield', 'speed', 'bomb']) {
    const enclosed = await page.evaluate((t) => window.__h5test.testFence(t, true), type);
    const outside = await page.evaluate((t) => window.__h5test.testFence(t, false), type);
    results[type] = { enclosed, outside };
    console.log(`[${type}] enclosed=`, JSON.stringify(enclosed));
    console.log(`[${type}] outside =`, JSON.stringify(outside));

    if (enclosed.error) { fail.push(`testFence ${type} enclose=true 报错: ${enclosed.error}`); continue; }
    if (outside.error) { fail.push(`testFence ${type} enclose=false 报错: ${outside.error}`); continue; }

    // 围住：道具必须从数组消失
    if (enclosed.removed !== 1) fail.push(`[${type}] 围住时应吃掉道具(removed===1)，实际 removed=${enclosed.removed}`);
    // 不包围：道具必须保留
    if (outside.removed !== 0) fail.push(`[${type}] 不包围时应保留道具(removed===0)，实际 removed=${outside.removed}`);

    if (type === 'shield') {
      if (enclosed.effect !== true) fail.push('[shield] 围住后护盾效果未生效(effect!==true)');
      if (!/护盾/.test(enclosed.hud || '')) fail.push('[shield] 围住后 HUD 未显示护盾');
    } else if (type === 'speed') {
      if (enclosed.effect !== true) fail.push('[speed] 围住后加速效果未生效(effect!==true)');
      if (!/加速/.test(enclosed.hud || '')) fail.push('[speed] 围住后 HUD 未显示加速');
    }
  }

  await page.screenshot({ path: 'test/powerup-fence.png' });
  console.log('SCREENSHOT saved: test/powerup-fence.png');

  if (errors.length) fail.push('CONSOLE ERRORS:\n' + errors.join('\n'));

  await browser.close();

  console.log('\nFENCE TEST RESULTS:', JSON.stringify(results, null, 2));
  if (fail.length) { console.error('\n❌ POWERUP FENCE TEST FAILED:\n' + fail.join('\n')); process.exit(2); }
  console.log('\n✅ POWERUP FENCE TEST PASSED —— 道具"围住才吃"逻辑验证通过');
  process.exit(0);
} catch (err) {
  console.error('POWERUP FENCE TEST FAILED:', err.message);
  if (errors.length) console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  try { await page.screenshot({ path: 'test/powerup-fence.png' }); } catch {}
  try { await browser.close(); } catch {}
  process.exit(1);
}
