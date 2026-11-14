/* Дымовой тест веб-приложения на jsdom: node scripts/test-app.mjs */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve('web');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  if (/Not implemented: window\.scrollTo/.test(e.message)) return;
  errors.push('jsdomError: ' + (e.stack || e.message));
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

/* Локальный сервер: приложение тестируется с нормальным origin (как в браузере и WebView) */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: base + '/index.html',
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
window.scrollTo = () => {};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = [];
const bad = [];
function check(name, cond, extra = '') {
  (cond ? ok : bad).push(name + (extra ? ' → ' + extra : ''));
}

await new Promise((res) => {
  if (window.document.readyState === 'complete') res();
  else window.addEventListener('load', res);
});
await wait(400);

// 1. данные курса загрузились
const MIK = window.MIK;
check('Данные курса загружены', !!MIK && !!MIK.DATA && MIK.DATA.lessons && Object.keys(MIK.DATA.lessons).length >= 20,
  MIK ? Object.keys(MIK.DATA.lessons).length + ' уроков' : 'нет данных');
check('Главы загружены', !!MIK && MIK.DATA.chapters.length === 14, MIK ? MIK.DATA.chapters.length + ' глав' : '');

// 2. сайдбар
const links = window.document.querySelectorAll('.lesson-link');
check('Сайдбар: ссылки на уроки', links.length >= 20, links.length + ' ссылок');
check('Сайдбар: главы отрисованы', window.document.querySelectorAll('.ch-head').length === 14);

// 3. главная страница
check('Главная: заголовок', window.document.querySelector('.hero-home h1') !== null);

// 4. урок
window.location.hash = '#/lesson/l05';
await wait(250);
const body = window.document.querySelector('#lesson-body');
check('Урок: контент отрисован', !!body && body.innerHTML.length > 2000, body ? body.innerHTML.length + ' симв.' : 'нет');
check('Урок: есть блоки команд', window.document.querySelectorAll('.code pre').length >= 2,
  window.document.querySelectorAll('.code pre').length + ' блоков');
check('Урок: есть чек-лист', window.document.querySelectorAll('.checklist .ck').length >= 5);
check('Урок: есть тест', window.document.querySelectorAll('.quiz .q').length >= 4);
check('Урок: есть видео', window.document.querySelectorAll('#lesson-body video').length === 1);
check('Урок: есть таблица', window.document.querySelectorAll('#lesson-body table').length >= 1);
check('Урок: заголовок H1', (window.document.querySelector('.hero h1')?.textContent || '').includes('IP-адресация'));

// 5. интерактив чек-листа
const cb = window.document.querySelector('.checklist input[data-ci="0"]');
cb.checked = true;
cb.dispatchEvent(new window.Event('change'));
await wait(80);
const stored = JSON.parse(window.localStorage.getItem('mik.state.v1') || '{}');
check('Чек-лист сохраняется', stored.checks && stored.checks.l05 && stored.checks.l05['0'] === true);

// 6. тест: выбираем ВЕРНЫЕ ответы — ожидаем полный балл
const quizData = window.MIK_DATA.lessons['l05'].quiz;
const questions = [...window.document.querySelectorAll('.quiz .q')];
questions.forEach((qq, qi) => {
  const right = qq.querySelector('.opt[data-o="' + quizData[qi].a + '"]');
  right.dispatchEvent(new window.Event('click', { bubbles: true }));
});
window.document.querySelector('[data-quiz-check]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(120);
const quizOut = window.document.querySelector('[data-quiz-out]').textContent;
check('Тест: верные ответы дают полный балл', quizOut.includes('Результат: ' + quizData.length + '/' + quizData.length), quizOut.trim());
check('Тест: верный ответ помечен correct', window.document.querySelectorAll('.quiz .opt.correct').length === quizData.length);
check('Тест: разбор ответа показан', window.document.querySelectorAll('.quiz .explain:not([hidden])').length === quizData.length);

// 6b. сброс и неверные ответы — ожидаем 0
window.document.querySelector('[data-quiz-reset]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
questions.forEach((qq, qi) => {
  const wrong = qq.querySelector('.opt:not([data-o="' + quizData[qi].a + '"])');
  wrong.dispatchEvent(new window.Event('click', { bubbles: true }));
});
window.document.querySelector('[data-quiz-check]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(120);
const quizOut2 = window.document.querySelector('[data-quiz-out]').textContent;
check('Тест: неверные ответы дают 0', quizOut2.includes('Результат: 0/' + quizData.length), quizOut2.trim());
check('Тест: неверный ответ помечен wrong', window.document.querySelectorAll('.quiz .opt.wrong').length === quizData.length);

// 7. копирование команды (кнопка есть)
check('Кнопка копирования есть', window.document.querySelectorAll('[data-copy]').length >= 2);

// 8. поиск
window.document.querySelector('#btn-search').dispatchEvent(new window.Event('click'));
await wait(120);
const si = window.document.querySelector('#search-input');
si.value = 'маскарадин';
si.dispatchEvent(new window.Event('input'));
await wait(150);
const res = window.document.querySelectorAll('#search-results .sr-item');
check('Поиск находит результаты', res.length >= 1, res.length + ' совпадений');

// 9. шпаргалка
window.location.hash = '#/cheat';
await wait(200);
check('Шпаргалка отрисована', window.document.querySelectorAll('.cheat-item').length >= 50,
  window.document.querySelectorAll('.cheat-item').length + ' команд');

// 10. экзамен
window.location.hash = '#/exam';
await wait(200);
check('Экзамен отрисован', window.document.querySelector('#exam-start') !== null);
window.document.querySelector('#exam-start').dispatchEvent(new window.Event('click'));
await wait(200);
check('Экзамен: вопрос начался', window.document.querySelectorAll('.exam-card .q').length === 1);
const eopt = window.document.querySelector('.exam-card .opt');
eopt.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(80);
check('Экзамен: ответ засчитан', window.document.querySelector('.exam-card .explain').hidden === false);

// 11. тема
window.document.querySelector('#btn-theme').dispatchEvent(new window.Event('click'));
await wait(60);
check('Тема переключается', window.document.documentElement.getAttribute('data-theme') === 'light');

// 12. мобильный сайдбар
check('Кнопка меню есть', window.document.querySelector('#btn-menu') !== null);

window.close();
server.close();

console.log('Пройдено:');
ok.forEach((o) => console.log('  ✓ ' + o));
if (bad.length) {
  console.log('Не пройдено:');
  bad.forEach((b) => console.log('  ✗ ' + b));
}
if (errors.length) {
  console.log('Ошибки скриптов:');
  [...new Set(errors)].slice(0, 10).forEach((e) => console.log('  ! ' + e.slice(0, 300)));
}
console.log(`\nИтог: ${ok.length} ок, ${bad.length} провалено, ${errors.length} ошибок JS.`);
process.exit(bad.length || errors.length ? 1 : 0);
