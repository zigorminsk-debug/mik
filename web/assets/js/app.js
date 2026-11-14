/* ============================================================
   MikroTik Академия — состояние, роутер, поиск, прогресс
   ============================================================ */
(function () {
  'use strict';
  const R = window.MIKR;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));

  /* ---------------- данные ---------------- */
  const DATA = window.MIK_DATA || { chapters: [], lessons: {} };
  const LESSONS = DATA.lessons;
  const ORDER = [];
  DATA.chapters.forEach((ch) => (ch.lessons || []).forEach((id) => ORDER.push(id)));

  /* ---------------- состояние ---------------- */
  const KEY = 'mik.state.v1';
  const defState = { checks: {}, quiz: {}, theme: 'dark', bigtext: 0, last: null };

  /* localStorage может быть недоступен (file://, приватный режим) — работаем без него */
  const LS = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { } }
  };

  let state;
  try { state = Object.assign({}, defState, JSON.parse(LS.get(KEY) || '{}')); }
  catch (e) { state = Object.assign({}, defState); }
  state.checks = state.checks || {};
  state.quiz = state.quiz || {};

  function save() { LS.set(KEY, JSON.stringify(state)); }
  window.MIK = { state: state, save: save, DATA: DATA, ORDER: ORDER };

  /* ---------------- тема ---------------- */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme || 'dark');
    document.body.setAttribute('data-bigtext', state.bigtext ? '1' : '0');
    const m = $('meta[name=theme-color]');
    if (m) m.setAttribute('content', state.theme === 'light' ? '#f4f6fa' : '#0d1117');
  }
  applyTheme();

  /* ---------------- sidebar ---------------- */
  function buildSidebar() {
    const nav = $('#chapters');
    nav.innerHTML = DATA.chapters.map((ch) => {
      const ids = ch.lessons || [];
      const done = ids.filter((id) => isLessonDone(id)).length;
      const head = `<div class="ch-head ${done === ids.length && ids.length ? 'done' : ''}">
          <span class="ch-idx">${done === ids.length && ids.length ? '✓' : ch.num}</span>
          <span>${R.esc(ch.title)}</span></div>`;
      const items = ids.map((id) => {
        const l = LESSONS[id];
        return `<a class="lesson-link ${isLessonDone(id) ? 'done' : ''}" href="#/lesson/${id}" data-id="${id}">
          <span class="dot"></span><span>${R.esc(l.title)}</span><span class="lv">${l.level}</span></a>`;
      }).join('');
      return head + items;
    }).join('');
    updateProgress();
  }

  function isLessonDone(id) {
    const l = LESSONS[id];
    if (!l) return false;
    const c = state.checks[id] || {};
    const cl = (l.checklist || []).length;
    const ck = Object.keys(c).filter((k) => c[k]).length;
    const q = state.quiz[id];
    const qok = q != null && q >= Math.ceil((l.quiz || []).length * 0.7);
    return (cl > 0 && ck === cl) || qok;
  }

  function updateProgress() {
    const total = ORDER.length;
    const done = ORDER.filter(isLessonDone).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ring = $('#progress-ring');
    if (ring) ring.style.setProperty('--p', pct);
    const p = $('#progress-pct'); if (p) p.textContent = pct + '%';
    const s = $('#progress-sub'); if (s) s.textContent = done + ' из ' + total + ' уроков';
    const t = $('#progress-title'); if (t) t.textContent = pct === 100 ? 'Курс пройден! 🎉' : 'Прогресс курса';
  }

  /* ---------------- главная ---------------- */
  function renderHome() {
    const totalQ = ORDER.reduce((a, id) => a + ((LESSONS[id].quiz || []).length), 0);
    const totalT = ORDER.reduce((a, id) => a + (parseInt((LESSONS[id].time || '0').replace(/\D/g, ''), 10) || 0), 0);
    const h = `
      <section class="hero-home">
        <h1>RouterOS <em>с нуля</em> и до продакшена</h1>
        <p>Полный практический курс по MikroTik: 14 глав, ${ORDER.length} уроков, ${totalQ} вопросов для самопроверки
           и ${Math.round(totalT / 60)} часа видео. Каждый урок — теория, готовые конфиги, разбор типичных ошибок и тест.</p>
        <div class="cta-row">
          <a class="btn" href="#/lesson/${ORDER[0]}">Начать с первого урока →</a>
          <a class="btn ghost" href="#/cheat">📘 Шпаргалка команд</a>
          <a class="btn ghost" href="#/exam">🎓 Итоговый экзамен</a>
        </div>
        <div class="badge-row" style="margin-top:18px">
          <span class="badge">RouterOS 7.x</span><span class="badge">Winbox / CLI / API</span>
          <span class="badge">Офлайн-режим</span><span class="badge">Видео + текст</span>
          <span class="badge">Без регистрации</span>
        </div>
      </section>

      <div class="sec-title">Как устроен курс</div>
      <div class="grid-cards">
        ${DATA.chapters.map((ch) => `
          <a class="card" href="#/lesson/${ch.lessons[0]}">
            <span class="ci">${ch.icon}</span>
            <b>${ch.num}. ${R.esc(ch.title)}</b>
            <small>${R.esc(ch.summary)}</small>
            <small style="margin-top:7px;color:var(--acc-2)">${ch.lessons.length} урока →</small>
          </a>`).join('')}
      </div>

      <div class="sec-title">Что вы научитесь делать</div>
      <div class="grid-cards">
        <div class="card"><span class="ci">🧱</span><b>Строить сети</b><small>VLAN, bridge, bonding, адресация, DHCP, статические и динамические маршруты</small></div>
        <div class="card"><span class="ci">🛡️</span><b>Защищать</b><small>Firewall, NAT, mangle, Raw, address-list, доступ по SSH/Winbox, сертификаты</small></div>
        <div class="card"><span class="ci">📶</span><b>Управлять Wi-Fi</b><small>Точки доступа, CAPsMAN, гостевые сети, мощность, покрытие</small></div>
        <div class="card"><span class="ci">⚡</span><b>Тюнить скорость</b><small>Simple queues, PCQ, HTB, шейпинг, честная делёжка канала</small></div>
        <div class="card"><span class="ci">🌐</span><b>Связывать филиалы</b><small>PPPoE, L2TP, GRE, EoIP, WireGuard, IPsec, OSPF</small></div>
        <div class="card"><span class="ci">🤖</span><b>Автоматизировать</b><small>Скрипты, scheduler, netwatch, REST API, Ansible</small></div>
      </div>

      <div class="sec-title">Советы</div>
      <div class="note tip"><b>Как проходить курс</b>Читайте урок, повторяйте команды на реальном устройстве или в <code>CHR</code>/<code>Docker</code>,
        отмечайте чек-лист и проходите тест. Прогресс сохраняется на устройстве и работает без интернета.</div>
      <div class="note info"><b>Быстрый старт</b>Если нет железа — установите RouterOS CHR (Cloud Hosted Router) или соберите образ
        в Docker: <code>docker run -it --rm -p 37215:37215 mikrotik/routeros:latest</code>. Уроки 1–3 рассчитаны именно на нём.</div>
    `;
    $('#main').innerHTML = h;
  }

  /* ---------------- урок ---------------- */
  function renderLesson(id) {
    const l = LESSONS[id];
    if (!l) { location.hash = '#/'; return; }
    const ch = DATA.chapters.filter((c) => (c.lessons || []).indexOf(id) >= 0)[0];
    const idx = ORDER.indexOf(id);
    const prev = idx > 0 ? ORDER[idx - 1] : null;
    const next = idx < ORDER.length - 1 ? ORDER[idx + 1] : null;

    const toc = [];
    (l.sections || []).forEach((b, i) => { if (b.t === 'h') toc.push({ i: i, x: b.x }); });
    (l.steps || []).forEach((s, i) => toc.push({ i: 's' + i, x: s.title }));

    const html = `
      <div class="hero">
        <div class="crumb"><b>Глава ${ch.num}</b> · ${R.esc(ch.title)} <span>·</span> Урок ${idx + 1} из ${ORDER.length}</div>
        <h1>${R.esc(l.title)}</h1>
        <p class="lead">${R.esc(l.lead)}</p>
        <div class="meta-row">
          <span class="tag lv">Уровень ${l.level}/10</span>
          <span class="tag time">⏱ ${R.esc(l.time || '')}</span>
          ${(l.tags || []).map((t) => `<span class="tag">${R.esc(t)}</span>`).join('')}
        </div>
      </div>

      <div class="lesson-grid">
        <article class="prose" id="lesson-body">
          ${R.videoBlock(l)}
          ${(l.blocks || []).map((b, i) => R.block(b, i)).join('')}
          ${R.stepsBlock(l.steps)}
          ${R.pitfallsBlock(l.pitfalls)}
          ${l.summary ? `<h3 style="margin-top:28px">Итог урока</h3><div class="note tip"><b>Запомни</b>${R.inline(l.summary)}</div>` : ''}
          ${R.checklistBlock(l.checklist, id)}
          ${R.quizBlock(l.quiz, id)}
          <div class="lesson-nav">
            ${prev ? `<a class="nav-btn" href="#/lesson/${prev}"><small>← Назад</small><b>${R.esc(LESSONS[prev].title)}</b></a>` : '<span style="flex:1"></span>'}
            ${next ? `<a class="nav-btn next" href="#/lesson/${next}"><small>Вперёд →</small><b>${R.esc(LESSONS[next].title)}</b></a>`
              : `<a class="nav-btn next" href="#/exam"><small>Финиш →</small><b>Итоговый экзамен</b></a>`}
          </div>
        </article>
        <aside class="toc">
          <b>Содержание урока</b>
          ${toc.map((t) => `<a href="#/lesson/${id}" data-toc="${t.i}">${R.esc(t.x)}</a>`).join('')}
        </aside>
      </div>`;
    $('#main').innerHTML = html;
    bindLesson(id, l);
    $('#main').scrollTop = 0;
    window.scrollTo(0, 0);
    state.last = id; save();
    markActive(id);
  }

  function markActive(id) {
    $$('.lesson-link').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
  }

  /* ---------------- события урока ---------------- */
  function bindLesson(id, l) {
    // копирование команд
    $$('[data-copy]').forEach((b) => b.addEventListener('click', () => {
      const el = document.getElementById(b.dataset.copy);
      const txt = el ? el.innerText : '';
      copyText(txt);
    }));

    // чек-лист
    const box = $('[data-check]');
    if (box) {
      const upd = () => {
        const st = {};
        $$('input[data-ci]', box).forEach((i) => { st[i.dataset.ci] = i.checked; });
        state.checks[id] = st; save(); updateProgress(); buildSidebar();
      };
      $$('input[data-ci]', box).forEach((i) => i.addEventListener('change', upd));
    }

    // квиз
    const q = $('[data-quiz]');
    if (q) {
      const out = $('[data-quiz-out]', q);
      $('[data-quiz-check]', q).addEventListener('click', () => {
        let correct = 0;
        $$('.q', q).forEach((qq, qi) => {
          const picked = $('input[type=radio]:checked', qq);
          const opts = $$('.opt', qq);
          const ans = l.quiz[qi].a;
          const ex = $('.explain', qq);
          opts.forEach((o) => { o.classList.remove('correct', 'wrong'); o.disabled = true; });
          if (opts[ans]) opts[ans].classList.add('correct');
          if (picked) {
            if (picked.dataset.o == ans) { correct++; }
            else { picked.classList.add('wrong'); }
          }
          ex.hidden = false;
          ex.innerHTML = '<b>Правильный ответ: ' + 'АБВГД'[ans] + '.</b> ' + R.inline(l.quiz[qi].why || '');
        });
        state.quiz[id] = correct; save(); updateProgress(); buildSidebar();
        if (out) out.textContent = 'Результат: ' + correct + '/' + l.quiz.length + (correct === l.quiz.length ? ' — отлично!' : '');
        toast('Тест: ' + correct + ' из ' + l.quiz.length);
      });
      $('[data-quiz-reset]', q).addEventListener('click', () => {
        $$('.q', q).forEach((qq) => {
          $$('.opt', qq).forEach((o) => { o.disabled = false; o.classList.remove('correct', 'wrong'); });
          const ex = $('.explain', qq); if (ex) { ex.hidden = true; ex.innerHTML = ''; }
        });
        if (out) out.textContent = '';
      });
      // выбор ответа
      $$('.q', q).forEach((qq, qi) => {
        $$('.opt', qq).forEach((o) => o.addEventListener('click', () => {
          if (o.disabled) return;
          $$('.opt', qq).forEach((x) => x.classList.remove('sel'));
          o.classList.add('sel');
          o.setAttribute('aria-checked', 'true');
        }));
      });
    }

    // видео
    const v = document.getElementById('vid-' + id);
    const vb = $('[data-vbtn="' + id + '"]');
    if (v && vb) {
      vb.addEventListener('click', () => { v.play(); vb.classList.add('hide'); });
      v.addEventListener('play', () => vb.classList.add('hide'));
      v.addEventListener('pause', () => { if (!v.ended) vb.classList.remove('hide'); });
      v.addEventListener('ended', () => vb.classList.add('hide'));
    }
    const tb = $('[data-transcript="' + id + '"]');
    if (tb) tb.addEventListener('click', () => {
      const tr = document.getElementById('tr-' + id);
      if (tr) tr.classList.toggle('open');
    });

    // оглавление
    $$('[data-toc]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = a.dataset.toc;
      const el = String(t).indexOf('s') === 0 && String(t).length > 1 && /^\d+$/.test(String(t).slice(1))
        ? document.querySelectorAll('.step')[parseInt(String(t).slice(1), 10)]
        : document.getElementById('s' + t);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => toast('Команда скопирована'), () => toast('Не удалось скопировать'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Команда скопирована'); } catch (e) { }
      ta.remove();
    }
  }

  /* ---------------- шпаргалка ---------------- */
  function renderCheat() {
    const groups = {};
    ORDER.forEach((id) => {
      (LESSONS[id].cheat || []).forEach((c) => {
        const g = c.g || 'Общее';
        (groups[g] = groups[g] || []).push(c);
      });
    });
    const html = `
      <div class="hero">
        <div class="crumb"><b>Справочник</b></div>
        <h1>Шпаргалка команд RouterOS</h1>
        <p class="lead">Все ключевые команды курса в одном месте. Нажмите «копировать» — команда попадёт в буфер обмена.</p>
      </div>
      <input class="cheat-search" id="cheat-q" type="search" placeholder="Фильтр: ip, firewall, wireless, queue…">
      <div id="cheat-body"></div>`;
    $('#main').innerHTML = html;
    const paint = (q) => {
      const ql = (q || '').toLowerCase();
      const out = Object.keys(groups).map((g) => {
        const items = groups[g].filter((c) => !ql || (c.c + ' ' + c.d + ' ' + g).toLowerCase().indexOf(ql) >= 0);
        if (!items.length) return '';
        return `<div class="cheat-group"><h3>${R.esc(g)}</h3>${items.map((c) => `
          <div class="cheat-item"><code>${R.esc(c.c)}</code><span>${R.inline(c.d)}</span>
          <button class="ghost-btn" style="margin-left:auto;padding:2px 9px;font-size:11.5px" data-copytxt="${R.esc(c.c)}">копировать</button></div>`).join('')}</div>`;
      }).join('');
      $('#cheat-body').innerHTML = out || '<p class="muted">Ничего не найдено.</p>';
      $$('[data-copytxt]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copytxt)));
    };
    paint('');
    $('#cheat-q').addEventListener('input', (e) => paint(e.target.value));
  }

  /* ---------------- итоговый экзамен ---------------- */
  function renderExam() {
    const pool = [];
    ORDER.forEach((id) => {
      (LESSONS[id].quiz || []).forEach((q) => pool.push({ q: q, from: LESSONS[id].title }));
    });
    const pick = [];
    const step = Math.max(1, Math.floor(pool.length / 20));
    for (let i = 0; i < pool.length && pick.length < 20; i += step) pick.push(pool[i]);

    const html = `
      <div class="hero">
        <div class="crumb"><b>Финал</b></div>
        <h1>Итоговый экзамен</h1>
        <p class="lead">20 вопросов из всего курса. Порог для «сдачи» — 70%. Результат сохраняется на устройстве.</p>
      </div>
      <div class="exam-card">
        <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
          <div><div class="muted" style="font-size:12.5px;text-transform:uppercase;letter-spacing:.07em">Вопросов</div><div class="exam-score">${pick.length}</div></div>
          <div><div class="muted" style="font-size:12.5px;text-transform:uppercase;letter-spacing:.07em">Порог</div><div class="exam-score">70%</div></div>
          <div style="flex:1;min-width:200px">
            <button class="btn" id="exam-start">Начать экзамен</button>
            <button class="btn ghost" id="exam-reset">Сбросить результат</button>
          </div>
        </div>
        <div id="exam-res"></div>
      </div>`;
    $('#main').innerHTML = html;

    $('#exam-start').addEventListener('click', () => startExam(pick));
    $('#exam-reset').addEventListener('click', () => { delete state.quiz.__exam; save(); $('#exam-res').innerHTML = ''; });
    const old = state.quiz.__exam;
    if (old) showExamResult(pick, old.correct, old.total);
  }

  function startExam(pick) {
    let i = 0, correct = 0;
    const answers = [];
    const box = $('#exam-res');
    function step() {
      if (i >= pick.length) {
        state.quiz.__exam = { correct: correct, total: pick.length, at: Date.now() }; save();
        showExamResult(pick, correct, pick.length);
        return;
      }
      const item = pick[i];
      box.innerHTML = `
        <div class="q" style="margin-top:16px">
          <div class="muted" style="font-size:12.5px">Вопрос ${i + 1} из ${pick.length} · ${R.esc(item.from)}</div>
          <div class="q-text" style="margin-top:6px">${R.inline(item.q.q)}</div>
          <div class="opts">${item.q.o.map((o, oi) => `<button class="opt" data-o="${oi}"><span class="mk">${'АБВГД'[oi]}</span><span>${R.inline(o)}</span></button>`).join('')}</div>
          <div class="explain" hidden></div>
          <button class="btn" id="exam-next" style="margin-top:12px">${i === pick.length - 1 ? 'Завершить' : 'Следующий вопрос'}</button>
        </div>`;
      $$('.opt', box).forEach((o) => o.addEventListener('click', () => {
        $$('.opt', box).forEach((x) => x.classList.remove('sel'));
        o.classList.add('sel');
        const ans = item.q.a;
        const ex = $('.explain', box);
        ex.hidden = false;
        ex.innerHTML = '<b>Ответ: ' + 'АБВГД'[ans] + '.</b> ' + R.inline(item.q.why || '');
        if (parseInt(o.dataset.o, 10) === ans) correct++;
        $('#exam-next').disabled = false;
      }));
      const nb = $('#exam-next');
      nb.disabled = true;
      nb.addEventListener('click', () => { i++; step(); });
    }
    step();
  }

  function showExamResult(pick, correct, total) {
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= 70;
    const box = $('#exam-res');
    if (!box) return;
    box.innerHTML = `
      <div class="exam-badge" style="${passed ? '' : 'border-color:rgba(210,153,34,.4);background:rgba(210,153,34,.08)'}">
        <b>${passed ? '🎉 Экзамен сдан' : '📖 Ещё немного практики'}</b>
        <div class="exam-score" style="margin:6px 0">${correct} / ${total}</div>
        <div class="muted">${pct}% — ${passed ? 'отличный результат, материал усвоен' : 'нужно 70%, повторите уроки со слабыми местами'}</div>
      </div>`;
  }

  /* ---------------- поиск ---------------- */
  function lessonText(l) {
    const parts = [l.title || '', l.lead || '', (l.tags || []).join(' '), (l.transcript || []).join(' '), l.summary || ''];
    (l.blocks || []).forEach((b) => {
      if (typeof b.x === 'string') parts.push(b.x);
      else if (Array.isArray(b.x)) parts.push(b.x.join(' '));
      if (b.rows) parts.push(b.rows.map((r) => r.join(' ')).join(' '));
      if (b.head) parts.push(b.head.join(' '));
      if (b.ttl) parts.push(b.ttl);
    });
    (l.steps || []).forEach((s) => parts.push(s.title || '', s.text || '', s.cmd || '', s.note || ''));
    (l.pitfalls || []).forEach((p) => parts.push(p.t || '', p.d || ''));
    (l.quiz || []).forEach((q) => {
      parts.push(q.q || '', q.why || '');
      (q.o || []).forEach((o) => parts.push(o));
    });
    return parts.join(' ').toLowerCase();
  }

  function buildSearchIndex() {
    const idx = [];
    ORDER.forEach((id) => {
      const l = LESSONS[id];
      idx.push({ kind: 'lesson', title: l.title, sub: l.lead, id: id, hay: lessonText(l) });
      (l.cheat || []).forEach((c) => idx.push({ kind: 'cmd', title: c.c, sub: c.d, id: id, hay: (c.c + ' ' + c.d).toLowerCase() }));
    });
    return idx;
  }
  let SEARCH_IDX = null;
  function search(q) {
    if (!SEARCH_IDX) SEARCH_IDX = buildSearchIndex();
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    const words = ql.split(/\s+/);
    const res = [];
    SEARCH_IDX.forEach((it) => {
      let score = 0;
      words.forEach((w) => {
        if (it.title.toLowerCase().indexOf(w) >= 0) score += 6;
        else if (it.hay.indexOf(w) >= 0) score += 2;
      });
      if (score) res.push({ it: it, score: score + (it.kind === 'lesson' ? 1 : 0) });
    });
    return res.sort((a, b) => b.score - a.score).slice(0, 40);
  }

  function openSearch() {
    $('#search-sheet').hidden = false;
    $('#search-input').value = '';
    paintSearch('');
    setTimeout(() => $('#search-input').focus(), 30);
  }
  function paintSearch(q) {
    const box = $('#search-results');
    if (!q) {
      box.innerHTML = `<div class="sr-group">Быстрый переход</div>` +
        ORDER.slice(0, 8).map((id) => `<a class="sr-item" href="#/lesson/${id}"><b>${R.esc(LESSONS[id].title)}</b><small>${R.esc(LESSONS[id].lead)}</small></a>`).join('');
      return;
    }
    const res = search(q);
    if (!res.length) { box.innerHTML = '<div class="sr-group">Ничего не найдено</div>'; return; }
    let html = '';
    let lastKind = '';
    res.forEach((r) => {
      if (r.it.kind !== lastKind) {
        html += `<div class="sr-group">${r.it.kind === 'lesson' ? 'Уроки' : 'Команды'}</div>`;
        lastKind = r.it.kind;
      }
      html += `<a class="sr-item" href="#/lesson/${r.it.id}" data-close-search>
        ${r.it.kind === 'cmd' ? `<code>${R.esc(r.it.title)}</code>` : `<b>${R.esc(r.it.title)}</b>`}
        <small>${R.esc(r.it.sub)}</small></a>`;
    });
    box.innerHTML = html;
    $$('[data-close-search]', box).forEach((a) => a.addEventListener('click', closeSearch));
  }

  /* ---------------- тост ---------------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ---------------- роутер ---------------- */
  function route() {
    const h = location.hash || '#/';
    const parts = h.replace('#', '').split('/').filter(Boolean);
    if (parts[0] === 'lesson' && parts[1]) renderLesson(parts[1]);
    else if (parts[0] === 'cheat') renderCheat();
    else if (parts[0] === 'exam') renderExam();
    else { renderHome(); markActive(null); }
    closeSidebar();
    window.scrollTo(0, 0);
  }

  /* ---------------- сайдбар (мобильный) ---------------- */
  function openSidebar() { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); }
  function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); }
  function closeSearch() { $('#search-sheet').hidden = true; }

  /* ---------------- init ---------------- */
  function init() {
    buildSidebar();
    route();
    window.addEventListener('hashchange', route);

    $('#btn-menu').addEventListener('click', openSidebar);
    $('#scrim').addEventListener('click', closeSidebar);
    $('#btn-search').addEventListener('click', openSearch);
    $('#search-close').addEventListener('click', closeSearch);
    $('#search-input').addEventListener('input', (e) => paintSearch(e.target.value));
    $('#search-sheet').addEventListener('click', (e) => { if (e.target.id === 'search-sheet') closeSearch(); });
    $('#btn-cheat').addEventListener('click', () => { location.hash = '#/cheat'; });
    $('#btn-exam').addEventListener('click', () => { location.hash = '#/exam'; });
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('Сбросить весь прогресс курса?')) return;
      state.checks = {}; state.quiz = {}; save(); buildSidebar(); route(); toast('Прогресс сброшен');
    });
    $('#btn-theme').addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light'; save(); applyTheme();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') { closeSearch(); closeSidebar(); }
    });

    // сеть
    const netPill = $('#net-pill');
    const netUp = () => { netPill.textContent = 'онлайн'; netPill.classList.remove('off'); };
    const netDown = () => { netPill.textContent = 'офлайн'; netPill.classList.add('off'); };
    if (!navigator.onLine) netDown();
    window.addEventListener('online', netUp); window.addEventListener('offline', netDown);

    // PWA install
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferred = e; $('#btn-install').hidden = false;
    });
    $('#btn-install').addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt(); await deferred.userChoice; deferred = null; $('#btn-install').hidden = true;
    });

    // service worker
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }

    // спрятать splash
    setTimeout(() => { const s = $('#splash'); if (s) s.classList.add('hide'); }, 420);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
