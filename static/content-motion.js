/* Optional content continuity. Business scores always retain their exact text. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app || typeof MutationObserver !== 'function') return;
  const preference = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const numbers = new Map(), counting = new Map(), revealing = new Map();
  let content = null, matrix = null, contentObserver = null, matrixObserver = null;
  let lastRoute = '', lastEmployee = '', numberFrame = 0;
  const route = () => location.pathname.replace(/\/$/, '') || '/dashboard';
  const excluded = () => /^\/(take(?:\/|$)|exam(?:\/|$)|login(?:\/|$))/.test(location.pathname);
  const allowed = () => !excluded() && !preference.matches && document.visibilityState !== 'hidden'
    && typeof content?.animate === 'function' && typeof requestAnimationFrame === 'function';
  const focused = element => document.activeElement && document.activeElement !== document.body
    && element.contains(document.activeElement);

  function finishNumber(element, state) {
    if (counting.get(element) !== state) return;
    counting.delete(element);
    element.textContent = state.text;
    if (state.aria === null) element.removeAttribute('aria-label');
    else element.setAttribute('aria-label', state.aria);
    element.classList.remove('content-counting');
  }
  function finishReveal(element, state) {
    if (revealing.get(element) !== state) return;
    revealing.delete(element);
    state.animation.onfinish = state.animation.oncancel = null;
    state.animation.cancel();
    element.classList.remove('content-revealing');
  }
  function settle() {
    if (numberFrame) cancelAnimationFrame(numberFrame);
    numberFrame = 0;
    for (const [element, state] of counting) finishNumber(element, state);
    for (const [element, state] of revealing) finishReveal(element, state);
  }
  function removeDetached() {
    for (const [element, state] of counting) if (!element.isConnected) finishNumber(element, state);
    for (const [element, state] of revealing) if (!element.isConnected) finishReveal(element, state);
    if (!counting.size && numberFrame) { cancelAnimationFrame(numberFrame); numberFrame = 0; }
  }
  function tickNumbers(now) {
    numberFrame = 0;
    if (!allowed()) { settle(); return; }
    for (const [element, state] of counting) {
      if (!element.isConnected || focused(element)) { finishNumber(element, state); continue; }
      if (state.started === null) state.started = now;
      const progress = Math.min(1, Math.max(0, (now - state.started) / 480));
      if (progress === 1) { finishNumber(element, state); continue; }
      const value = Math.round(state.from + (state.to - state.from) * (1 - Math.pow(1 - progress, 3)));
      state.visual.textContent = String(value);
    }
    if (counting.size) numberFrame = requestAnimationFrame(tickNumbers);
  }
  function summaryNumbers(currentRoute) {
    // Only these management summary counts qualify. Theory/practical/final scores never do.
    if (currentRoute !== '/dashboard') return;
    content.querySelectorAll('.overview-stat dd strong').forEach((element, index) => {
      if (counting.has(element)) return;
      const text = element.textContent.trim();
      if (!/^\d+$/.test(text)) return;
      const value = Number(text), key = `${currentRoute}:${index}`, previous = numbers.get(key);
      if (!Number.isSafeInteger(value)) return;
      numbers.set(key, value);
      if (previous === value || value === (previous ?? 0) || !allowed() || focused(element)) return;
      // Only the visual span changes. Assistive technology receives one stable final value.
      const visual = document.createElement('span'), accessible = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true'); visual.textContent = String(previous ?? 0);
      accessible.className = 'sr-only'; accessible.textContent = text;
      try { element.replaceChildren(visual, accessible); }
      catch { element.textContent = text; return; }
      counting.set(element, { text, aria: element.getAttribute('aria-label'), visual, from: previous ?? 0, to: value, started: null });
      element.classList.add('content-counting');
    });
    if (counting.size && !numberFrame) numberFrame = requestAnimationFrame(tickNumbers);
  }
  function reveal(elements, duration = 280, step = 38, travel = 8) {
    if (!allowed()) return;
    const candidates = [...new Set(elements)].filter(Boolean).filter(element =>
      element.isConnected && !element.closest('#editor') && !focused(element));
    // Avoid nested transforms and bound animation work even on long tables.
    const targets = candidates.filter(element => !candidates.some(parent => parent !== element && parent.contains(element))).slice(0, 10);
    targets.forEach((element, index) => {
      if (typeof element.animate !== 'function') return;
      const previous = revealing.get(element);
      if (previous) finishReveal(element, previous);
      try {
        const animation = element.animate([
          { opacity: 0.42, transform: `translateY(${travel}px)` },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration, delay: Math.min(index * step, 180), easing, fill: 'backwards' });
        const state = { animation };
        revealing.set(element, state);
        element.classList.add('content-revealing');
        animation.onfinish = animation.oncancel = () => finishReveal(element, state);
      } catch { element.classList.remove('content-revealing'); }
    });
  }
  function routeEntrance(currentRoute) {
    const heading = content.querySelector('.page-heading');
    if (currentRoute === '/dashboard') {
      reveal([heading, content.querySelector('.overview-stats'),
        ...content.querySelectorAll('.workflow-step'), ...content.querySelectorAll('.activity-row'),
        content.querySelector('.dashboard-export')]);
    } else if (currentRoute === '/matrix') {
      reveal([heading, ...content.querySelectorAll('.assessment-flow > div'), content.querySelector('.matrix-filter-panel')]);
    } else if (currentRoute === '/settings') {
      reveal([heading, ...content.querySelectorAll('.settings-grid > .panel')]);
    } else if (currentRoute === '/practical') {
      reveal([heading, content.querySelector('.panel')]);
    } else {
      const rows = [...content.querySelectorAll('#table-content tbody > tr')].slice(0, 6);
      reveal([heading, content.querySelector('.table-toolbar'), ...rows,
        ...(!rows.length ? [content.querySelector('.empty')] : [])]);
    }
  }
  function matrixEmployee() {
    removeDetached();
    if (excluded() || route() !== '/matrix' || !matrix) return;
    const heading = matrix.querySelector('.matrix-person-heading');
    if (!heading) { lastEmployee = ''; return; }
    const employee = content.querySelector('[data-filter="matrix_employee"]')?.value
      || matrix.querySelector('.matrix-score-form')?.dataset.employee || '';
    if (!employee) return;
    const key = JSON.stringify([content.querySelector('[data-filter="matrix_workshop"]')?.value || '',
      content.querySelector('[data-filter="matrix_position"]')?.value || '', employee]);
    if (key === lastEmployee) return;
    lastEmployee = key;
    reveal([heading, ...matrix.querySelectorAll('.matrix-theory-score, .matrix-work-result')], 220, 16, 5);
  }
  function bindMatrix() {
    const next = content?.querySelector('#matrix-content') || null;
    if (next !== matrix) {
      matrixObserver?.disconnect();
      matrix = next;
      if (matrix) {
        matrixObserver = new MutationObserver(matrixEmployee);
        matrixObserver.observe(matrix, { childList: true });
      } else matrixObserver = null;
    }
    matrixEmployee();
  }
  function inspectContent() {
    removeDetached();
    if (!content || excluded()) { settle(); return; }
    const currentRoute = route(), changed = currentRoute !== lastRoute;
    content.classList.toggle('content-motion-ready', typeof content.animate === 'function');
    if (changed) { settle(); lastRoute = currentRoute; lastEmployee = ''; routeEntrance(currentRoute); }
    summaryNumbers(currentRoute);
    bindMatrix();
  }
  function bindContent() {
    const next = excluded() ? null : app.querySelector('#content');
    if (next !== content) {
      settle();
      contentObserver?.disconnect(); matrixObserver?.disconnect();
      content?.classList.remove('content-motion-ready');
      content = next; matrix = null; contentObserver = matrixObserver = null;
      lastRoute = ''; lastEmployee = '';
      if (content) {
        contentObserver = new MutationObserver(inspectContent);
        contentObserver.observe(content, { childList: true });
      } else numbers.clear();
    }
    inspectContent();
  }
  const rootObserver = new MutationObserver(bindContent);
  function start() { rootObserver.observe(app, { childList: true }); bindContent(); }
  function stop() {
    settle(); rootObserver.disconnect(); contentObserver?.disconnect(); matrixObserver?.disconnect();
    content?.classList.remove('content-motion-ready');
    content = matrix = null; contentObserver = matrixObserver = null;
  }
  function preferenceChanged() { if (!allowed()) settle(); }
  document.addEventListener('visibilitychange', preferenceChanged);
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', start);
  if (typeof preference.addEventListener === 'function') preference.addEventListener('change', preferenceChanged);
  else if (typeof preference.addListener === 'function') preference.addListener(preferenceChanged);
  start();
})();
