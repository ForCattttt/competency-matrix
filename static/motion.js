/* Optional, dependency-free continuity for navigation and disclosures. */
(() => {
  'use strict';
  const app = document.getElementById('app');
  if (!app) return;
  const reduced = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const detailsInMotion = new Map();
  let nav = null, marker = null, navObserver = null, navResize = null;
  let navAnimation = null, navFrame = 0, lastActive = null;
  const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const examPage = () => location.pathname.startsWith('/take/');
  const motionAllowed = () => !reduced.matches && document.visibilityState !== 'hidden' && !examPage();

  function cancelNavigationAnimation() {
    if (!navAnimation) return;
    navAnimation.onfinish = navAnimation.oncancel = null;
    navAnimation.cancel();
    navAnimation = null;
  }
  function translatedY(element) {
    const value = window.getComputedStyle(element).transform;
    if (!value || value === 'none') return 0;
    const matrix = value.match(/^matrix\(([^)]+)\)$/);
    if (matrix) return Number(matrix[1].split(',')[5]) || 0;
    const matrix3d = value.match(/^matrix3d\(([^)]+)\)$/);
    if (matrix3d) return Number(matrix3d[1].split(',')[13]) || 0;
    return Number(value.match(/translateY\(([-.\d]+)px\)/)?.[1]) || 0;
  }
  function alignNavigation(animate = false) {
    if (!nav?.isConnected || !marker) return;
    const active = nav.querySelector('a.active');
    if (!active || examPage()) {
      cancelNavigationAnimation();
      marker.hidden = true;
      nav.classList.remove('motion-nav-ready');
      lastActive = null;
      return;
    }
    const origin = nav.getBoundingClientRect(), destination = active.getBoundingClientRect();
    if (!destination.height || !destination.width) return;
    const top = destination.top - origin.top + nav.scrollTop - nav.clientTop;
    const left = destination.left - origin.left + nav.scrollLeft - nav.clientLeft;
    const from = translatedY(marker);
    const moving = animate && lastActive && lastActive !== active && motionAllowed()
      && typeof marker.animate === 'function' && !marker.hidden;
    cancelNavigationAnimation();
    marker.style.left = `${left}px`;
    marker.style.width = `${destination.width}px`;
    marker.style.height = `${destination.height}px`;
    marker.style.transform = `translateY(${top}px)`;
    marker.hidden = false;
    nav.classList.add('motion-nav-ready');
    lastActive = active;
    if (!moving || Math.abs(top - from) < 1) return;
    try {
      const animation = marker.animate([
        { transform: `translateY(${from}px)` }, { transform: `translateY(${top}px)` }
      ], { duration: 260, easing });
      navAnimation = animation;
      animation.onfinish = () => {
        if (navAnimation === animation) { navAnimation = null; animation.cancel(); }
      };
    } catch { /* The active link keeps its correct, immediately applied state. */ }
  }
  function scheduleNavigation() {
    if (navFrame) return;
    navFrame = requestAnimationFrame(() => { navFrame = 0; alignNavigation(true); });
  }
  function scrollNavigation() { alignNavigation(false); }
  function bindNavigation() {
    const next = app.querySelector('.sidebar .nav');
    if (next === nav) return;
    if (navFrame) cancelAnimationFrame(navFrame);
    navFrame = 0;
    cancelNavigationAnimation();
    navObserver?.disconnect(); navResize?.disconnect();
    nav?.removeEventListener('scroll', scrollNavigation);
    nav?.classList.remove('motion-nav-ready'); marker?.remove();
    nav = next; marker = null; lastActive = null;
    if (!nav) return;
    marker = document.createElement('span');
    marker.className = 'nav-motion-marker';
    marker.setAttribute('aria-hidden', 'true'); marker.hidden = true;
    nav.prepend(marker);
    nav.addEventListener('scroll', scrollNavigation, { passive: true });
    if (typeof MutationObserver === 'function') {
      navObserver = new MutationObserver(records => {
        if (!marker.isConnected && nav.isConnected) nav.prepend(marker);
        if (records.some(record => record.type === 'attributes'
          ? record.target.matches('a[data-route]')
          : [...record.addedNodes, ...record.removedNodes].some(node => node !== marker))) scheduleNavigation();
      });
      navObserver.observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    if (typeof ResizeObserver === 'function') {
      navResize = new ResizeObserver(() => alignNavigation(false));
      navResize.observe(nav);
    }
    alignNavigation(false);
  }

  function finishDisclosure(details, state) {
    if (detailsInMotion.get(details) !== state) return;
    detailsInMotion.delete(details);
    if (state.animation) {
      state.animation.onfinish = state.animation.oncancel = null;
      state.animation.cancel();
    }
    details.open = state.targetOpen;
    details.style.height = state.height;
    details.style.overflow = state.overflow;
    details.classList.remove('motion-details-pending', 'motion-details-closing');
  }
  function finishDisclosures() {
    for (const [details, state] of detailsInMotion) finishDisclosure(details, state);
  }
  function toggleDisclosure(event) {
    if (event.defaultPrevented || event.button > 0 || !motionAllowed()) return;
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    const summary = target?.closest('summary'), details = summary?.parentElement;
    if (!details || details.tagName !== 'DETAILS' || !app.contains(details)
      || typeof details.animate !== 'function') return;
    if (target.closest('a,button,input,select,textarea,label')) return;
    const previous = detailsInMotion.get(details);
    const state = {
      targetOpen: previous ? !previous.targetOpen : !details.open,
      height: previous?.height ?? details.style.height,
      overflow: previous?.overflow ?? details.style.overflow,
      animation: null
    };
    try {
      const from = details.getBoundingClientRect().height;
      if (previous) {
        previous.animation.onfinish = previous.animation.oncancel = null;
        previous.animation.cancel(); detailsInMotion.delete(details);
      }
      details.style.height = state.height;
      details.open = state.targetOpen;
      const to = details.getBoundingClientRect().height;
      details.open = true;
      details.style.height = `${from}px`; details.style.overflow = 'hidden';
      const animation = details.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: state.targetOpen ? 250 : 220, easing
      });
      state.animation = animation;
      detailsInMotion.set(details, state);
      details.classList.add('motion-details-pending');
      details.classList.toggle('motion-details-closing', !state.targetOpen);
      animation.onfinish = animation.oncancel = () => finishDisclosure(details, state);
      event.preventDefault();
    } catch {
      detailsInMotion.delete(details);
      details.style.height = state.height; details.style.overflow = state.overflow;
      details.classList.remove('motion-details-pending', 'motion-details-closing');
      // Let this click's native default action reach exactly the requested state.
      details.open = !state.targetOpen;
    }
  }
  function settleMotion() {
    finishDisclosures(); alignNavigation(false);
  }
  function preferencesChanged() { if (!motionAllowed()) settleMotion(); }
  document.addEventListener('click', toggleDisclosure);
  document.addEventListener('visibilitychange', preferencesChanged);
  window.addEventListener('pagehide', settleMotion);
  window.addEventListener('resize', () => alignNavigation(false), { passive: true });
  if (typeof reduced.addEventListener === 'function') reduced.addEventListener('change', preferencesChanged);
  else if (typeof reduced.addListener === 'function') reduced.addListener(preferencesChanged);
  if (typeof MutationObserver === 'function') {
    const rootObserver = new MutationObserver(() => {
      for (const [details, state] of detailsInMotion) {
        if (!details.isConnected || !motionAllowed()) finishDisclosure(details, state);
      }
      bindNavigation();
    });
    rootObserver.observe(app, { childList: true });
  }
  bindNavigation();
})();
