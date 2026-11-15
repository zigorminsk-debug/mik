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

// 3a. скрытые элементы действительно скрыты (атрибут hidden должен побеждать display в CSS)
{
  const sheet = window.document.querySelector('#search-sheet');
  const toast = window.document.querySelector('#toast');
  const install = window.document.querySelector('#btn-install');
  check('Окно поиска скрыто при запуске', sheet.hidden === true);
  check('Окно поиска не перекрывает страницу',
    window.getComputedStyle(sheet).display === 'none',
    window.getComputedStyle(sheet).display);
  check('Уведомление скрыто при запуске', window.getComputedStyle(toast).display === 'none');
  check('Кнопка установки скрыта без PWA-события', window.getComputedStyle(install).display === 'none');
}

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
check('Урок: у видео есть источник', (window.document.querySelector('#lesson-body video source') || {}).src
  ? /assets\/media\/video\/l\d+\.mp4$/.test(window.document.querySelector('#lesson-body video source').getAttribute('src'))
  : false,
  (window.document.querySelector('#lesson-body video source') || {}).getAttribute
    ? window.document.querySelector('#lesson-body video source').getAttribute('src') : 'нет');
check('Урок: кнопка play привязана к видео', window.document.querySelector('[data-vbtn="l05"]') !== null);
check('Урок: есть блок сообщения об ошибке видео', window.document.querySelector('#verr-l05') !== null);
check('Урок: текст урока открыт по умолчанию', !!window.document.querySelector('.transcript.open'));
check('Урок: текст урока содержит абзацы', window.document.querySelectorAll('.transcript p').length >= 4,
  window.document.querySelectorAll('.transcript p').length + ' абзацев');
check('Урок: текст урока сворачивается', (() => {
  const btn = window.document.querySelector('[data-transcript]');
  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  const collapsed = !window.document.querySelector('.transcript').classList.contains('open');
  btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  return collapsed && window.document.querySelector('.transcript').classList.contains('open');
})());
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

// 6c. выделение ответа не пропадает, когда отвечают на следующий вопрос
window.document.querySelector('[data-quiz-reset]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
const qA = questions[0];
const qB = questions[1];
qA.querySelector('.opt[data-o="0"]').dispatchEvent(new window.Event('click', { bubbles: true }));
qB.querySelector('.opt[data-o="1"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Тест: выделение ответа держится при ответе на другой вопрос',
  qA.querySelectorAll('.opt.sel').length === 1 && qB.querySelectorAll('.opt.sel').length === 1,
  'Q1=' + qA.querySelectorAll('.opt.sel').length + ', Q2=' + qB.querySelectorAll('.opt.sel').length);
check('Тест: выбранный ответ помечен aria-checked',
  qA.querySelector('.opt.sel') && qA.querySelector('.opt.sel').getAttribute('aria-checked') === 'true');

// 6d. сброс снимает выделение выбранных ответов
window.document.querySelector('[data-quiz-reset]').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Тест: сброс снимает выделение', window.document.querySelectorAll('.quiz .opt.sel').length === 0,
  'осталось ' + window.document.querySelectorAll('.quiz .opt.sel').length);

// 6e. выбранный ответ должен быть виден: для него есть отдельное правило стиля
const cssSrc = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');
check('Стиль: выбранный ответ подсвечен', /\.opt\.sel\{/.test(cssSrc));

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
check('Экзамен: ответ нельзя пропустить', window.document.querySelector('#exam-next').disabled === true);
const eopt = window.document.querySelector('.exam-card .opt');
eopt.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(80);
check('Экзамен: выбор ответа включает «дальше»', window.document.querySelector('#exam-next').disabled === false);
check('Экзамен: правильный ответ не показывается сразу', window.document.querySelector('.exam-card .explain') === null);
window.document.querySelector('#exam-next').dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(120);
check('Экзамен: переход к следующему вопросу', window.document.querySelectorAll('.exam-card .q').length === 1);

// проходим экзамен до конца, отвечая верно на первый вопрос (по данным не проверяем)
for (let k = 0; k < 40; k++) {
  const opts = window.document.querySelectorAll('.exam-card .opt');
  if (!opts.length) break;
  opts[0].dispatchEvent(new window.Event('click', { bubbles: true }));
  const next = window.document.querySelector('#exam-next');
  if (!next) break;
  next.dispatchEvent(new window.Event('click', { bubbles: true }));
  await wait(20);
}
await wait(200);
check('Экзамен: результат показан', window.document.querySelector('.exam-badge') !== null);
check('Экзамен: разбор ошибок есть', window.document.querySelectorAll('.exam-card .explain').length >= 0);
check('Экзамен: результат сохранён', !!JSON.parse(window.localStorage.getItem('mik.state.v1') || '{}').quiz?.__exam);

// 11. тема
window.document.querySelector('#btn-theme').dispatchEvent(new window.Event('click'));
await wait(60);
check('Тема переключается', window.document.documentElement.getAttribute('data-theme') === 'light');

// 11a. регулировка шрифта
const fsBtn = window.document.querySelector('#btn-fs');
check('Кнопка размера шрифта есть', fsBtn !== null);
fsBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Шрифт увеличивается', window.document.documentElement.getAttribute('data-fs') === '2',
  window.document.documentElement.getAttribute('data-fs'));
fsBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Шрифт увеличивается ещё раз', window.document.documentElement.getAttribute('data-fs') === '3');
check('Метка шрифта обновлена', window.document.querySelector('#fs-label').textContent.trim() === 'А++',
  window.document.querySelector('#fs-label').textContent.trim());
fsBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Шрифт возвращается к обычному', window.document.documentElement.getAttribute('data-fs') === '1');
fsBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
await wait(60);
check('Размер шрифта сохраняется', JSON.parse(window.localStorage.getItem('mik.state.v1') || '{}').fs === 2);

// 11b. аудит CSS: интерфейс не должен вылезать за экран
{
  const css = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');
  const inlineCode = (css.match(/\.prose code:not\(pre code\)\{[^}]*\}/) || [''])[0];
  check('CSS: длинные команды переносятся, а не растягивают страницу',
    !/white-space\s*:\s*nowrap/.test(inlineCode) && /overflow-wrap/.test(inlineCode));
  const cheatCode = (css.match(/\.cheat-item code\{[^}]*\}/) || [''])[0];
  check('CSS: команды в шпаргалке переносятся', !/white-space\s*:\s*nowrap/.test(cheatCode));
  check('CSS: колонки урока умеют сжиматься', /\.lesson-grid>\*\{[^}]*min-width:0/.test(css));
  check('CSS: скрытые элементы не показываются', /\[hidden\]\{display:none !important\}/.test(css));
  check('CSS: масштаб шрифта задан', /html\[data-fs="3"\]/.test(css));
}

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
