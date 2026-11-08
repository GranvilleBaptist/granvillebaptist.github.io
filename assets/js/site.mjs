import { parseCSV, contentError } from './content.mjs';
import { regularFooterEvents } from './events.mjs';

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

export function applyChurchInfo(info, root = document) {
  for (const key of ['address', 'phone', 'email']) {
    root.querySelectorAll(`[data-church-${key}]`).forEach(element => { element.textContent = info.get(key); });
  }
  for (const name of ['facebook', 'instagram', 'twitter', 'youtube']) {
    const value = info.get(`social.${name}`);
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`church-info.csv: social.${name} must be a complete https:// link.`); }
    if (url.protocol !== 'https:') throw new Error(`church-info.csv: social.${name} must start with https://.`);
    root.querySelectorAll(`[data-social="${name}"]`).forEach(element => { element.href = url.href; });
  }
}

export function footerEntries(events, info = new Map()) {
  const sunday = [], weekly = [];
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
  for (const [selector, items, empty] of [
    ['.footer-section.services', entries.sunday, 'No Sunday services listed'],
    ['.footer-section.activities', entries.weekly, 'No weekly activities listed']
  ]) {
    const section = root.querySelector(selector);
    if (!section) continue;
    section.querySelectorAll('p').forEach(element => element.remove());
    for (const text of items.length ? items : [empty]) {
      const paragraph = root.createElement('p');
      paragraph.textContent = text;
      section.append(paragraph);
    }
  }
}
