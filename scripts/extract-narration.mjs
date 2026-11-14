/* Извлекает транскрипции и CLI-примеры уроков для видео.
   Вывод: media/narration.json */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DATA_DIR = path.resolve('web/assets/data');
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.js')).sort();
const sandbox = { window: { MIK_DATA: { chapters: [], lessons: {} } } };
vm.createContext(sandbox);
for (const f of files) vm.runInContext(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'), sandbox, { filename: f });

const { chapters, lessons } = sandbox.window.MIK_DATA;
const order = [];
for (const ch of chapters) for (const id of ch.lessons) order.push(id);

const LIMIT = 1400;
const out = [];

for (const id of order) {
  const l = lessons[id];
  const paragraphs = (l.transcript || []).map((p) => p.trim());

  const parts = [];
  let cur = '';
  for (const p of paragraphs) {
    if ((cur + ' ' + p).trim().length > LIMIT && cur) { parts.push(cur.trim()); cur = p; }
    else cur = (cur + ' ' + p).trim();
  }
  if (cur) parts.push(cur.trim());

  // CLI-примеры для слайдов с командами
  const codes = [];
  for (const s of l.steps || []) {
    if (s.cmd && codes.length < 6) codes.push({ title: s.title, cmd: s.cmd });
  }
  for (const b of l.blocks || []) {
    if (b.t === 'code' && codes.length < 8) codes.push({ title: b.ttl || 'RouterOS CLI', cmd: b.x });
  }

  const ch = chapters.find((c) => (c.lessons || []).includes(id)) || {};

  out.push({
    id,
    title: l.title,
    chapter: ch.title || '',
    level: l.level,
    paragraphs,
    codes,
    parts,
    partTexts: parts.map((p) => p.split('\n').join(' '))
  });
}

fs.mkdirSync('media', { recursive: true });
fs.writeFileSync('media/narration.json', JSON.stringify(out, null, 2), 'utf8');

console.log(`Уроков: ${out.length}, частей озвучки: ${out.reduce((a, x) => a + x.parts.length, 0)}, CLI-слайдов: ${out.reduce((a, x) => a + x.codes.length, 0)}`);
