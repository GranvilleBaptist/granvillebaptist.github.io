import { eventsForDate } from './events.mjs';

const easternDateFormat = new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'America/New_York',
});
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });
const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const weekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

export function churchToday(now = new Date()) {
  const parts = easternDateFormat.formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  return new Date(Date.UTC(values.year, values.month - 1, values.day));
}

function addDays(date, count) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + count));
}

function eventSetting(event, info, key, dateKey) {
  const title = event.sourceTitle || event.title;
  return (dateKey && info.get(`${key}.${dateKey}.${title}`)) || info.get(`${key}.${title}`) || '';
}

export function scheduleTime(event, info = new Map(), dateKey = '') {
  const start = event.time.replace(/^0/, '');
  if (!start) return eventSetting(event, info, 'event_time', dateKey);
  const end = eventSetting(event, info, 'event_end_time', dateKey).trim().replace(/\s+/g, ' ').toUpperCase().replace(/^0/, '');
  if (!end) return start;
  if (!/^(?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/.test(end)) {
    throw new Error(`church-info.csv: the end time for ${event.sourceTitle || event.title} must look like 8:00 PM.`);
  }
  return `${start.slice(-2) === end.slice(-2) ? start.slice(0, -3) : start}–${end}`;
}

export function eventsOnDate(events, date, info = new Map()) {
  const civilDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  const dateKey = date.toISOString().slice(0, 10);
  return eventsForDate(events, civilDate).map(event => {
    const setting = key => eventSetting(event, info, key, dateKey);
    return {
      ...event,
      sourceTitle: event.title,
      title: setting('event_label') || event.title,
      time: scheduleTime(event, info, dateKey),
      location: setting('event_location') || '',
      canceled: !event.active,
    };
  });
}

export function upcomingDays(events, today = churchToday(), info = new Map(), daysAhead = 7) {
  const days = [];
  for (let offset = 0; offset <= daysAhead; offset++) {
    const date = addDays(today, offset);
    const dayEvents = eventsOnDate(events, date, info);
    if (dayEvents.length) days.push({ date, events: dayEvents });
  }
  return days;
}

function createElement(doc, tag, className, text) {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function eventName(event) {
  return event.canceled ? `${event.title} · Canceled` : event.title;
}

function renderNotices(doc, days) {
  const messages = days.flatMap(({ date, events }) => events.filter(event => event.canceled)
    .map(event => `${event.title} is canceled on ${dateFormat.format(date)}.`));
  for (const notice of doc.querySelectorAll('[data-gbc-schedule-notice]')) {
    notice.querySelector('ul').replaceChildren(...messages.map(message => createElement(doc, 'li', '', message)));
    notice.hidden = messages.length === 0;
  }
}

export function initUpcoming(events, info = new Map(), {
  document: doc = globalThis.document,
  now = () => new Date(),
} = {}) {
  const list = doc?.querySelector('[data-upcoming-list]');
  const range = doc?.querySelector('[data-upcoming-range]');
  if (!doc) return () => {};
  let renderedDate;

  function refresh() {
    const today = churchToday(now());
    const key = today.toISOString();
    if (key === renderedDate) return;
    const days = upcomingDays(events, today, info);
    renderNotices(doc, days);

    if (list) {
      const rows = days.map(({ date, events: dayEvents }) => {
        const row = createElement(doc, 'li', 'gbc-event');
        const badge = createElement(doc, 'time', 'gbc-date', weekdayFormat.format(date));
        badge.dateTime = date.toISOString().slice(0, 10);
        badge.setAttribute('aria-label', dateFormat.format(date));
        badge.append(createElement(doc, 'span', '', monthDayFormat.format(date)));
        const group = createElement(doc, 'ul', 'gbc-day-events');
        group.setAttribute('role', 'list');
        for (const event of dayEvents) {
          const item = doc.createElement('li');
          item.append(createElement(doc, 'h3', '', eventName(event)),
            createElement(doc, 'p', '', [event.time, event.location].filter(Boolean).join(' · ')));
          group.append(item);
        }
        row.append(badge, group);
        return row;
      });
      list.replaceChildren(...(rows.length ? rows : [createElement(doc, 'li', 'gbc-upcoming-empty', 'No events scheduled')]));
    }

    if (range) range.textContent = monthDayFormat.formatRange(today, addDays(today, 7));
    renderedDate = key;
  }

  const visibility = () => {
    if (!doc.hidden) refresh();
  };
  const timer = doc.defaultView?.setInterval(refresh, 60_000);
  doc.addEventListener('visibilitychange', visibility);
  refresh();
  return () => {
    doc.defaultView?.clearInterval(timer);
    doc.removeEventListener('visibilitychange', visibility);
  };
}
