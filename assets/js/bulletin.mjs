import { selectHomeNews } from './news.mjs';
import { churchToday, upcomingDays } from './upcoming.mjs';

const cleanups = new WeakMap();
const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });

export function bulletinItems(news, events, info = new Map(), today = churchToday()) {
  const cards = upcomingDays(events, today, info).flatMap(({ date, events: entries }) => entries.map(event => ({
    date: date.toISOString().slice(0, 10),
    sourceTitle: event.sourceTitle,
    label: 'Coming Up at GBC',
    title: event.title + (event.canceled ? ' · Canceled' : ''),
    details: [fullDate.format(date), event.time, event.location].filter(Boolean).join(' · '),
  })));
  const todayKey = today.toISOString().slice(0, 10);
  const announcements = selectHomeNews(news, Infinity).filter(item => {
    const date = info.get(`news_date.${item.title}`);
    if (date && date < todayKey) return false;
    const related = info.get(`news_event.${item.title}`);
    return !related || !cards.some(card => card.sourceTitle === related && (!date || card.date === date));
  }).map(item => ({
    label: 'Church News',
    title: info.get(`news_label.${item.title}`) || item.title,
    details: item.body,
  }));
  return announcements.concat(cards).slice(0, 10);
}

export function initBulletin({
  news = [],
  events = [],
  info = new Map(),
  document: doc = globalThis.document,
  autoRotate = true,
} = {}) {
  const stage = doc?.querySelector('[data-bulletin-stage]');
  const verse = stage?.querySelector('.gbc-verse');
  if (!stage || !verse) return () => {};
  cleanups.get(stage)?.();
  const view = doc.defaultView || globalThis;
  const reducedMotion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let slides = [verse];
  let current = 0;
  let scheduleDate;
  let timer;
  let transition;
  let disposed = false;
  let observer;
  let inView = typeof view.IntersectionObserver !== 'function';

  function element(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function refreshSlides() {
    const today = churchToday();
    const key = today.toISOString();
    if (key === scheduleDate) return;
    const cards = bulletinItems(news, events, info, today).map(item => {
      const panel = element('article', 'gbc-verse gbc-bulletin-panel');
      panel.dataset.bulletinGroup = item.label;
      panel.setAttribute('aria-hidden', 'true');
      const content = element('div', 'gbc-wrap');
      const viewport = element('div', 'gbc-bulletin-window');
      const body = element('div', 'gbc-bulletin-body');
      body.append(element('h3', '', item.title), element('p', 'gbc-bulletin-info', item.details));
      viewport.append(body);
      content.append(element('p', 'gbc-eyebrow', item.label), viewport);
      panel.append(content);
      return panel;
    });
    slides = [verse, ...cards];
    stage.replaceChildren(...slides);
    scheduleDate = key;
  }

  function show(index) {
    slides[current].classList.remove('gbc-bulletin-current');
    slides[current].setAttribute('aria-hidden', 'true');
    current = index;
    slides[current].classList.add('gbc-bulletin-current');
    slides[current].removeAttribute('aria-hidden');
  }

  function stopTransition() {
    if (!transition) return;
    const pending = transition;
    transition = undefined;
    pending.incoming.classList.remove('gbc-bulletin-incoming', 'gbc-bulletin-same-group');
    for (const animation of pending.animations) animation.cancel();
  }

  const canPlay = () => !disposed && autoRotate && slides.length > 1 && inView
    && !doc.hidden && !reducedMotion?.matches;

  function advance() {
    timer = undefined;
    if (current === 0) refreshSlides();
    if (!canPlay()) return;
    const next = (current + 1) % slides.length;
    const outgoing = slides[current];
    const incoming = slides[next];
    if (typeof outgoing.animate !== 'function') {
      show(next);
      syncPlayback();
      return;
    }

    const axis = current === 0 || next === 0 ? 'Y' : 'X';
    const direction = next === 0 ? 1 : -1;
    const resting = { transform: `translate${axis}(0)` };
    const leaving = { transform: `translate${axis}(${direction * 100}%)` };
    const entering = { transform: `translate${axis}(${-direction * 100}%)` };
    const timing = { duration: 520, easing: 'ease-in-out', fill: 'both' };
    const sameGroup = axis === 'X' && outgoing.dataset.bulletinGroup === incoming.dataset.bulletinGroup;
    const outgoingTarget = sameGroup ? outgoing.querySelector('.gbc-bulletin-body') : outgoing;
    const incomingTarget = sameGroup ? incoming.querySelector('.gbc-bulletin-body') : incoming;
    incoming.classList.add('gbc-bulletin-incoming');
    if (sameGroup) incoming.classList.add('gbc-bulletin-same-group');
    const animations = [
      outgoingTarget.animate([resting, leaving], timing),
      incomingTarget.animate([entering, resting], timing),
    ];
    transition = { incoming, animations };
    animations[1].onfinish = () => {
      if (transition?.animations !== animations || disposed) return;
      show(next);
      stopTransition();
      syncPlayback();
    };
  }

  function syncPlayback() {
    if (disposed) return;
    if (current === 0 && !transition && !doc.hidden) refreshSlides();
    if (canPlay()) {
      if (timer === undefined && !transition) timer = view.setTimeout(advance, current === 0 ? 8000 : 6000);
      return;
    }
    if (timer !== undefined) view.clearTimeout(timer);
    timer = undefined;
    stopTransition();
    if (reducedMotion?.matches && current !== 0) show(0);
  }

  function cleanup() {
    disposed = true;
    if (timer !== undefined) view.clearTimeout(timer);
    timer = undefined;
    stopTransition();
    show(0);
    observer?.disconnect();
    doc.removeEventListener?.('visibilitychange', syncPlayback);
    reducedMotion?.removeEventListener?.('change', syncPlayback);
    if (cleanups.get(stage) === cleanup) cleanups.delete(stage);
  }

  doc.addEventListener('visibilitychange', syncPlayback);
  reducedMotion?.addEventListener?.('change', syncPlayback);
  if (typeof view.IntersectionObserver === 'function') {
    observer = new view.IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }, { threshold: 0.15 });
    observer.observe(stage);
  }
  cleanups.set(stage, cleanup);
  syncPlayback();
  return cleanup;
}
