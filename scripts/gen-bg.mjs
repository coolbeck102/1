// 扫描 public/bg/ 下的图片，生成 bg/list.json 供游戏读取。
// 用法：把美女图丢进 public/bg/，然后 `npm run gen-bg`。
import fs from 'node:fs';
import path from 'node:path';

const dir = 'public/bg';
const out = path.join(dir, 'list.json');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const exts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'];
const files = fs.readdirSync(dir)
  .filter(f => exts.includes(path.extname(f).toLowerCase()) && f !== 'list.json')
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

fs.writeFileSync(out, JSON.stringify(files, null, 2));
console.log(`✅ 已生成 ${out}，共 ${files.length} 张背景图：`);
files.forEach(f => console.log('   -', f));
if (!files.length) console.log('（暂无图片，游戏将回退到渐变底图）');
