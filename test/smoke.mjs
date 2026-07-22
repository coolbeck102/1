// 浏览器自动化冒烟测试（针对「昆虫防线」H5 游戏 · 无限关 + 解锁 + 相册 + 存档版）
// 使用本机已安装的 Microsoft Edge（Chromium 内核）以无头模式运行，
// 验证：页面加载 / canvas / 开始界面 / 选关锁状态 / 相册 / 存档 /
//       点击开始进入运行态 / 暂停-恢复 / 过关揭晓动画 / 广告 mock 解锁。
import { chromium } from 'playwright-core';

const URL = process.env.URL || 'http://localhost:5173/';

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

const page = await browser.newPage({ viewport: { width: 900, height: 800 } });

const errors = [];
const badResponses = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) {
    errors.push(m.text());
  }
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) {
    badResponses.push(r.status() + ' ' + r.url());
  }
});

const result = {};
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  // 清空存档，保证测试从干净状态开始
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load', timeout: 30000 });

  // 1) canvas 尺寸
  await page.waitForSelector('#game', { timeout: 10000 });
  result.canvas = await page.evaluate(() => {
    const c = document.querySelector('#game');
    return c ? [c.width, c.height] : null;
  });

  // 2) 开始界面
  result.startVisible = await page.evaluate(() => {
    const el = document.querySelector('#startScreen');
    return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  });

  // 3) 当前关显示：应显示"当前第 1 关"（maxCleared=0 → lvl=1），不再有选关网格
  const cur = await page.evaluate(() => {
    const el = document.querySelector('#levelGrid .cur-lvl');
    return el ? el.textContent : null;
  });
  result.currentLevelText = cur;
  result.hasLevelGrid = await page.evaluate(() => !!document.querySelector('#levelGrid'));

  // 4) 相册界面可打开并关闭
  await page.click('#galleryBtn');
  await page.waitForFunction(() => !document.querySelector('#galleryScreen')?.classList.contains('hidden'), { timeout: 4000 });
  result.galleryOpened = true;
  await page.click('#galleryBack');
  await page.waitForFunction(() => document.querySelector('#galleryScreen')?.classList.contains('hidden'), { timeout: 4000 });

  // 5) 存档基线：全新存档
  result.saveBaseline = await page.evaluate(() => window.__h5test && window.__h5test.getSave());

  // 6) 开始游戏 -> 运行态
  await page.click('#startBtn');
  await page.waitForFunction(() => document.querySelector('#startScreen')?.classList.contains('hidden'), { timeout: 8000 });
  result.started = true;

  // 7) 暂停 -> 恢复
  await page.keyboard.press('p');
  await page.waitForFunction(() => !document.querySelector('#pauseScreen')?.classList.contains('hidden'), { timeout: 4000 });
  result.pauseShown = true;
  await page.keyboard.press('p');
  await page.waitForFunction(() => document.querySelector('#pauseScreen')?.classList.contains('hidden'), { timeout: 4000 });
  result.resumed = true;

  // 8) 运行 3 秒
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test/screenshot.png' });

  // 9) 过关揭晓动画：强制触发，断言图片 100% 露出后再弹结算
  const triggered = await page.evaluate(() => window.__h5test && window.__h5test.triggerVictory());
  result.victoryTriggered = !!triggered;
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test/screenshot-victory.png' });
  const cov = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 200; i++) {
      const s = window.__h5test && window.__h5test.victoryState();
      if (s && s.uncovered === 0) return s;
      await wait(50);
    }
    return window.__h5test && window.__h5test.victoryState();
  });
  result.victoryFullyRevealed = !!(cov && cov.uncovered === 0);
  await page.waitForFunction(
    () => !document.querySelector('#levelResult')?.classList.contains('hidden'),
    { timeout: 6000 }
  );
  result.victoryResultShown = true;
  // 过关后应写入存档（解锁了第 1 张图）
  result.saveAfterVictory = await page.evaluate(() => window.__h5test && window.__h5test.getSave());

  // 10) 解锁流程：构造"已通关到第10关"的存档 -> 当前关变为第11关(未解锁) ->
  //     开始按钮变"解锁并继续" -> 点击弹解锁框 -> 看广告 mock -> 断言 adBlocks+1
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kcfx_save_v1') || '{}');
    s.maxCleared = 10; // 通关第10关后，下一关为第11关，超出免费范围需解锁
    localStorage.setItem('kcfx_save_v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  const curLocked = await page.evaluate(() => {
    const el = document.querySelector('#levelGrid .cur-lvl');
    return el ? el.textContent : null;
  });
  result.curLevelWhenLocked = curLocked;
  result.startBtnText = await page.evaluate(() => document.querySelector('#startBtn').textContent);
  await page.click('#startBtn'); // 当前关未解锁 -> 弹解锁框
  await page.waitForFunction(() => !document.querySelector('#unlockModal')?.classList.contains('hidden'), { timeout: 4000 });
  result.unlockModalShown = true;
  await page.click('#adUnlockBtn'); // 触发广告 mock
  await page.waitForFunction(() => !document.querySelector('#adOverlay')?.classList.contains('hidden'), { timeout: 4000 });
  await page.click('#adSkip'); // 测试跳过
  await page.waitForFunction(
    () => (window.__h5test && window.__h5test.getSave().adBlocks >= 1),
    { timeout: 6000 }
  );
  result.adUnlocked = true;

  await browser.close();

  console.log('SMOKE TEST RESULT:', JSON.stringify(result, null, 2));

  const fail = [];
  if (errors.length) fail.push('CONSOLE ERRORS:\n' + errors.join('\n'));
  if (badResponses.length) fail.push('BAD RESPONSES:\n' + badResponses.join('\n'));
  if (!result.canvas || result.canvas[0] !== 800 || result.canvas[1] !== 600) fail.push('canvas 尺寸异常: ' + result.canvas);
  if (!result.startVisible) fail.push('开始界面未显示');
  if (!result.currentLevelText || !result.currentLevelText.includes('第 1 关')) fail.push('当前关显示异常: ' + result.currentLevelText);
  if (!result.hasLevelGrid) fail.push('关卡显示容器缺失');
  if (!result.galleryOpened) fail.push('相册未能打开');
  if (!result.saveBaseline || result.saveBaseline.purchased !== false || result.saveBaseline.maxCleared !== 0) fail.push('存档基线异常: ' + JSON.stringify(result.saveBaseline));
  if (!result.started) fail.push('点击开始后未进入运行态');
  if (!result.pauseShown || !result.resumed) fail.push('暂停/恢复异常');
  if (!result.victoryTriggered) fail.push('过关动画未能触发');
  if (!result.victoryFullyRevealed) fail.push('过关时图片未完全揭示(仍存在未覆盖黑块)');
  if (!result.victoryResultShown) fail.push('过关动画后结算界面未弹出');
  if (!result.saveAfterVictory || result.saveAfterVictory.maxCleared < 1) fail.push('过关后未写入存档(已解锁图): ' + JSON.stringify(result.saveAfterVictory));
  if (!result.unlockModalShown) fail.push('当前关未解锁时点击开始未弹出解锁弹窗');
  if (result.curLevelWhenLocked && !result.curLevelWhenLocked.includes('第 11 关')) fail.push('未解锁时当前关应显示第11关: ' + result.curLevelWhenLocked);
  if (result.startBtnText !== '解锁并继续') fail.push('未解锁关开始按钮文案异常: ' + result.startBtnText);
  if (!result.adUnlocked) fail.push('看广告 mock 后未解锁后续关卡');

  if (fail.length) {
    console.error('\n❌ SMOKE TEST FAILED:\n' + fail.join('\n'));
    process.exit(2);
  }
  console.log('\n✅ SMOKE TEST PASSED —— 昆虫防线(无限关/解锁/相册/存档)本地功能验证通过');
  process.exit(0);
} catch (err) {
  console.error('SMOKE TEST FAILED:', err.message);
  if (errors.length) console.error('CONSOLE ERRORS:\n' + errors.join('\n'));
  try { await page.screenshot({ path: 'test/screenshot-fail.png' }); } catch {}
  try { await browser.close(); } catch {}
  process.exit(1);
}
