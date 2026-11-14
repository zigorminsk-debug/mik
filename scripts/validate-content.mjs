/* Проверка целостности данных курса: node scripts/validate-content.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const DATA_DIR = path.resolve('web/assets/data');
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.js')).sort();

const sandbox = { window: { MIK_DATA: { chapters: [], lessons: {} } } };
vm.createContext(sandbox);
for (const f of files) {
  const code = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.error(`✗ ${f}: ${e.message}`);
    process.exit(1);
  }
}

const { chapters, lessons } = sandbox.window.MIK_DATA;
const errors = [];
const warnings = [];

// 1. уроки существуют и принадлежат главам
const ids = Object.keys(lessons);
console.log(`Файлов: ${files.length}, глав: ${chapters.length}, уроков: ${ids.length}`);

const seen = new Set();
for (const ch of chapters) {
  if (!ch.lessons || !ch.lessons.length) errors.push(`Глава ${ch.num} (${ch.title}) без уроков`);
  for (const id of ch.lessons || []) {
    if (seen.has(id)) errors.push(`Урок ${id} продублирован в главах`);
    seen.add(id);
    if (!lessons[id]) errors.push(`Глава ${ch.num}: урок ${id} не найден в данных`);
  }
}
for (const id of ids) {
  if (!seen.has(id)) errors.push(`Урок ${id} не закреплён ни за одной главой`);
}

// 2. структура урока
let quizTotal = 0, cheatTotal = 0, videoTotal = 0, transcriptTotal = 0;
for (const id of ids) {
  const l = lessons[id];
  const need = ['title', 'lead', 'level', 'time', 'blocks', 'checklist', 'quiz'];
  for (const k of need) if (!l[k]) errors.push(`${id}: нет поля ${k}`);
  if (!Array.isArray(l.quiz) || l.quiz.length < 4) warnings.push(`${id}: мало вопросов (${(l.quiz || []).length})`);
  if (!Array.isArray(l.checklist) || l.checklist.length < 5) warnings.push(`${id}: короткий чек-лист`);
  if (!l.video) warnings.push(`${id}: нет видео`);
  if (!l.transcript || l.transcript.length < 4) warnings.push(`${id}: короткая транскрипция`);
  quizTotal += (l.quiz || []).length;
  cheatTotal += (l.cheat || []).length;
  videoTotal += l.video ? 1 : 0;
  transcriptTotal += (l.transcript || []).length;

  // корректность вопросов
  (l.quiz || []).forEach((q, i) => {
    if (!Array.isArray(q.o) || q.o.length < 3) errors.push(`${id}: вопрос ${i + 1} — мало вариантов`);
    if (typeof q.a !== 'number' || q.a < 0 || q.a >= (q.o || []).length) errors.push(`${id}: вопрос ${i + 1} — неверный индекс ответа`);
    if (!q.why) warnings.push(`${id}: вопрос ${i + 1} — нет пояснения`);
  });

  // поиск посторонних символов (китайский, японский, корейский)
  const dump = JSON.stringify(l);
  const cjk = dump.match(/[぀-ヿ㐀-䶿一-鿿가-힯]/g);
  if (cjk) errors.push(`${id}: посторонние символы: ${[...new Set(cjk)].join(' ')}`);
}

// 3. дубли id видео и файлов
const videos = ids.map((id) => lessons[id].video).filter(Boolean);
const dup = videos.filter((v, i) => videos.indexOf(v) !== i);
if (dup.length) errors.push(`Дубликаты видео: ${[...new Set(dup)].join(', ')}`);

// 4. ссылки на несуществующие media
for (const v of videos) {
  if (!v.startsWith('assets/media/video/')) errors.push(`Некорректный путь видео: ${v}`);
}

console.log(`Вопросов: ${quizTotal}, команд в шпаргалке: ${cheatTotal}, уроков с видео: ${videoTotal}`);
console.log(`Абзацев транскрипции: ${transcriptTotal}`);

if (warnings.length) {
  console.log('\nПредупреждения:');
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.log('\nОшибки:');
  errors.forEach((e) => console.log('  ✗ ' + e));
  process.exit(1);
}
console.log('\n✔ Данные курса корректны.');
