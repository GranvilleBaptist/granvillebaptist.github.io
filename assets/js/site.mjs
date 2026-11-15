import { parseCSV, contentError } from './content.mjs';
import { regularFooterEvents } from './events.mjs';
import { scheduleTime } from './upcoming.mjs';

export function parseChurchInfo(text, { file = 'church-info.csv' } = {}) {
  const info = new Map();
  for (const { fields, line } of parseCSV(text, { file })) {
    if (fields.length !== 2 || !fields[0]) throw contentError(file, line, 'Use setting name, value. Put quotes around values containing commas.');
    if (info.has(fields[0])) throw contentError(file, line, `The setting ${fields[0]} is listed twice.`);
    info.set(fields[0], fields[1]);
  }
  for (const key of ['address', 'phone', 'email']) {
    if (!info.get(key)) throw contentError(file, 1, `Add a value for ${key}.`);
  }
  return info;
}

function accountURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || !url.pathname.replaceAll('/', '')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function applyChurchInfo(info, root = document) {
  for (const key of ['address', 'phone', 'email']) {
    root.querySelectorAll(`[data-church-${key}]`).forEach(element => {
      const value = info.get(key) || '';
      element.textContent = value;
      if (element.tagName === 'A' && key === 'phone') element.href = 'tel:' + value.replace(/[^\d+]/g, '');
      if (element.tagName === 'A' && key === 'email') element.href = 'mailto:' + value;
    });
  }
  root.querySelectorAll('[data-directions]').forEach(element => {
    element.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.get('address') || '');
  });
  root.querySelectorAll('[data-church-email-link]').forEach(element => {
    element.href = 'mailto:' + (info.get('email') || '');
  });
  for (const key of ['welcome', 'details']) {
    root.querySelectorAll(`[data-visitor-${key}]`).forEach(element => {
      const value = info.get(`visitor.${key}`) || '';
      element.textContent = value;
      element.hidden = !value;
    });
  }
  for (const name of ['facebook', 'instagram', 'twitter', 'youtube', 'spotify']) {
    const url = accountURL(info.get(`social.${name}`) || (name === 'twitter' ? info.get('social.x') : ''));
    root.querySelectorAll(`[data-social="${name}"]`).forEach(element => {
      if (url) element.href = url;
      else element.removeAttribute('href');
      const item = element.closest('[data-social-item]') || element;
      item.hidden = !url;
    });
  }
  root.querySelectorAll('[data-social-list]').forEach(list => {
    list.hidden = !list.querySelector('[data-social][href]');
  });
}

export function footerEntries(events, info = new Map()) {
  const sunday = [];
  const weekly = [];
  for (const event of regularFooterEvents(events)) {
    const customLabel = info.get(`footer_label.${event.day}.${event.title}`);
    const label = customLabel || (event.weekday === 0 && event.recurrence === 'weekly' ? event.title : `${event.day} ${event.title}`);
    const text = event.time ? `${label}: ${event.time.replace(/^0/, '')}` : label;
    (event.weekday === 0 ? sunday : weekly).push(text);
  }
  if (info.get('footer_sunday_note')) sunday.push(info.get('footer_sunday_note'));
  return { sunday, weekly };
}

export function renderFooter(events, info = new Map(), root = document) {
  const entries = footerEntries(events, info);
  const doc = root.ownerDocument || root;
  for (const [selector, items, empty] of [
    ['.footer-section.services', entries.sunday, 'No Sunday services listed'],
    ['.footer-section.activities', entries.weekly, 'No weekly activities listed'],
  ]) {
    const section = root.querySelector(selector);
    if (!section) continue;
    section.querySelectorAll('p').forEach(element => element.remove());
    for (const text of items.length ? items : [empty]) {
      const paragraph = doc.createElement('p');
      paragraph.textContent = text;
      section.append(paragraph);
    }
  }
}

export function renderSchedules(events, info = new Map(), root = document) {
  const regular = regularFooterEvents(events);
  const doc = root.ownerDocument || root;
  for (const container of root.querySelectorAll('[data-schedule]')) {
    const sunday = container.dataset.schedule === 'sunday';
    const selected = regular.filter(event => sunday ? event.weekday === 0 : event.weekday > 0 && event.weekday < 6);
    const rows = selected.map(event => {
      const row = doc.createElement('div');
      const title = doc.createElement('dt');
      const time = doc.createElement('dd');
      title.textContent = info.get(`event_label.${event.title}`) || event.title;
      const label = event.recurrence === 'weekly' ? event.day + 's' : event.day;
      const eventTime = scheduleTime(event, info);
      time.textContent = sunday ? eventTime : [label, eventTime].filter(Boolean).join(' · ');
      row.append(title, time);
      return row;
    });
    container.replaceChildren(...rows);
  }
  root.querySelectorAll('[data-fellowship]').forEach(element => {
    element.textContent = info.get('footer_sunday_note') || '';
    element.hidden = !element.textContent;
  });
}
