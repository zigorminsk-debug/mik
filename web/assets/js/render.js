/* ============================================================
   MikroTik Академия — рендер контента
   ============================================================ */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* инлайновая разметка: **жирный**, `код`, *курсив*, [текст](url) */
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  /* подсветка CLI: комментарии, ключевые слова, строки */
  function hl(code) {
    const lines = String(code).split('\n').map((ln) => {
      const m = ln.match(/^(\s*)(\/\/[^\n]*)$/);
      if (m) return `<span class="c">${esc(m[2])}</span>`;
      let out = esc(ln);
      out = out.replace(/(&quot;[^&]*?&quot;)/g, '<span class="s">$1</span>');
      out = out.replace(/^(\s*)(\/[\w\-\/]+)/, '$1<span class="p">$2</span>');
      out = out.replace(/(\bset\b|\badd\b|\bprint\b|\bget\b|\bremove\b|\benable\b|\bdisable\b|\brestart\b)/g, '<span class="k">$1</span>');
      return out;
    });
    return lines.join('\n');
  }

  function block(b, i) {
    switch (b.t) {
      case 'h': return `<h3 id="s${i}">${inline(b.x)}</h3>`;
      case 'p': return `<p>${inline(b.x)}</p>`;
      case 'ul': return `<ul>${b.x.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol>${b.x.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`;
      case 'code': return codeBox(b.x, b.ttl || 'RouterOS CLI');
      case 'note': {
        const kind = b.k || 'info';
        const titles = { tip: 'Совет', warn: 'Важно', danger: 'Ошибка', info: 'Заметка' };
        return `<div class="note ${kind}"><b>${esc(b.ttl || titles[kind] || 'Заметка')}</b>${inline(b.x)}</div>`;
      }
      case 'table': {
        const head = b.head.map((h) => `<th>${inline(h)}</th>`).join('');
        const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
        return `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
      }
      case 'img': return `<figure style="margin:6px 0 18px"><img src="${esc(b.src)}" alt="${esc(b.cap || '')}" loading="lazy">${b.cap ? `<figcaption class="muted" style="font-size:13px;margin-top:7px">${inline(b.cap)}</figcaption>` : ''}</figure>`;
      case 'quote': return `<blockquote style="border-left:3px solid var(--acc);margin:6px 0 18px;padding:6px 0 6px 14px;color:var(--txt-2)">${inline(b.x)}</blockquote>`;
      default: return '';
    }
  }

  function codeBox(code, ttl) {
    const id = 'c' + Math.random().toString(36).slice(2, 9);
    return `<div class="code"><div class="code-head"><span class="ttl">${esc(ttl)}</span>
      <button type="button" data-copy="${id}">копировать</button></div>
      <pre id="${id}">${hl(code)}</pre></div>`;
  }

  function videoBlock(lesson) {
    if (!lesson.video) return '';
    const t = (lesson.transcript || []).map((p) => `<p>${inline(p)}</p>`).join('');
    return `<div class="video-wrap">
      <video id="vid-${esc(lesson.id)}" preload="metadata" playsinline controls
        poster="${esc(lesson.poster || 'assets/img/poster.svg')}">
        <source src="${esc(lesson.video)}" type="video/mp4">
        Ваш браузер не поддерживает видео.
      </video>
      <div class="vbtn" data-vbtn="${esc(lesson.id)}"><span><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="#fff"/></svg></span></div>
      <div class="video-cap"><span>${esc(lesson.videoCap || 'Поясняющее видео к уроку')}</span>
        ${t ? `<button class="ghost-btn" style="padding:3px 10px;font-size:12px" data-transcript="${esc(lesson.id)}">Текст</button>` : ''}
      </div>
      ${t ? `<div class="transcript" id="tr-${esc(lesson.id)}">${t}</div>` : ''}
    </div>`;
  }

  function stepsBlock(steps) {
    if (!steps || !steps.length) return '';
    return `<div class="steps">${steps.map((s) => `<div class="step">
      <h4>${inline(s.title)}</h4>
      ${s.text ? `<p>${inline(s.text)}</p>` : ''}
      ${s.cmd ? codeBox(s.cmd, s.cmdName || 'RouterOS CLI') : ''}
      ${s.note ? `<div class="note info"><b>Зачем так</b>${inline(s.note)}</div>` : ''}
    </div>`).join('')}</div>`;
  }

  function pitfallsBlock(items) {
    if (!items || !items.length) return '';
    return `<div class="pitfalls">${items.map((p) => `<div class="pitfall"><b>⚠ ${esc(p.t)}</b><span>${inline(p.d)}</span></div>`).join('')}</div>`;
  }

  function checklistBlock(items, id) {
    if (!items || !items.length) return '';
    const done = (window.MIK && MIK.state.checks[id]) || {};
    return `<div class="checklist" data-check="${esc(id)}"><h3>✓ Чек-лист урока</h3>
      ${items.map((c, i) => `<label class="ck"><input type="checkbox" data-ci="${i}" ${done[i] ? 'checked' : ''}><span>${inline(c)}</span></label>`).join('')}
    </div>`;
  }

  function quizBlock(quiz, id) {
    if (!quiz || !quiz.length) return '';
    const saved = (window.MIK && MIK.state.quiz[id]) || null;
    return `<div class="quiz" data-quiz="${esc(id)}">
      <div class="quiz-head"><h3>🧠 Проверка знаний</h3><span class="quiz-score">${quiz.length} вопросов</span></div>
      ${quiz.map((q, qi) => `<div class="q" data-q="${qi}">
        <div class="q-text">${qi + 1}. ${inline(q.q)}</div>
        <div class="opts">${q.o.map((o, oi) => `<button class="opt" data-o="${oi}">
            <span class="mk">${'АБВГД'[oi]}</span><span>${inline(o)}</span></button>`).join('')}</div>
        <div class="explain" hidden></div>
      </div>`).join('')}
      <div class="quiz-actions">
        <button class="btn" data-quiz-check>Проверить ответы</button>
        <button class="btn ghost" data-quiz-reset>Сбросить</button>
        <span class="quiz-score" data-quiz-out>${saved ? 'Прошлый результат: ' + saved + '/' + quiz.length : ''}</span>
      </div>
    </div>`;
  }

  window.MIKR = {
    esc, inline, hl, block, codeBox, videoBlock, stepsBlock, pitfallsBlock, checklistBlock, quizBlock
  };
})();
