import { churchToday, eventsOnDate } from './upcoming.mjs';

const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' });

function createElement(doc, tag, className, text) {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function eventName(event) {
  return event.canceled ? `${event.title} · Canceled` : event.title;
}

export function initCalendar(events, {
  document: doc = globalThis.document,
  info = new Map(),
  today = churchToday(),
} = {}) {
  const heading = doc?.querySelector('[data-calendar-month]');
  const dateHeading = doc?.querySelector('[data-calendar-date]');
  const grid = doc?.querySelector('[data-calendar-grid]');
  const details = doc?.querySelector('[data-calendar-details]');
  if (!heading || !dateHeading || !grid || !details) return () => {};

  let month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  let selected;

  function selectDate(date, button, dayEvents) {
    selected?.setAttribute('aria-pressed', 'false');
    selected = button;
    button.setAttribute('aria-pressed', 'true');
    dateHeading.textContent = dateFormat.format(date);
    const rows = dayEvents.map(event => {
      const row = createElement(doc, 'li', 'gbc-calendar-detail');
      const description = [event.time, event.location].filter(Boolean).join(' · ');
      row.append(createElement(doc, 'strong', '', eventName(event)), createElement(doc, 'span', '', description));
      return row;
    });
    details.replaceChildren(...(rows.length ? rows : [createElement(doc, 'li', 'gbc-calendar-detail', 'No events scheduled')]));
  }

  function renderMonth(preferred = month) {
    heading.textContent = monthFormat.format(month);
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const weeks = [];
    const dates = [];

    for (let firstDay = 1 - month.getUTCDay(); firstDay <= dayCount; firstDay += 7) {
      const row = doc.createElement('tr');
      for (let offset = 0; offset < 7; offset++) {
        const cell = doc.createElement('td');
        row.append(cell);
        const day = firstDay + offset;
        if (day < 1 || day > dayCount) continue;

        const date = new Date(Date.UTC(year, monthIndex, day));
        const dayEvents = eventsOnDate(events, date, info);
        const button = createElement(doc, 'button', 'gbc-calendar-date');
        button.type = 'button';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', [dateFormat.format(date), ...dayEvents.map(eventName)].join(', '));
        if (date.getTime() === today.getTime()) button.setAttribute('aria-current', 'date');
        button.append(createElement(doc, 'span', 'gbc-calendar-number', String(day)));
        for (const event of dayEvents) button.append(createElement(doc, 'span', 'gbc-calendar-chip', eventName(event)));
        if (dayEvents.length) button.append(createElement(doc, 'span', 'gbc-calendar-marker'));
        button.addEventListener('click', () => selectDate(date, button, dayEvents));
        cell.append(button);
        dates.push({ date, button, events: dayEvents });
      }
      weeks.push(row);
    }

    grid.replaceChildren(...weeks);
    const initial = dates.find(day => day.date >= preferred && day.events.length)
      ?? dates.find(day => day.date >= preferred)
      ?? dates[0];
    selectDate(initial.date, initial.button, initial.events);
  }

  const controls = Array.from(doc.querySelectorAll('[data-calendar-step]'), control => {
    const click = () => {
      const step = Number(control.dataset.calendarStep);
      month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + step, 1));
      renderMonth();
    };
    control.addEventListener('click', click);
    return { control, click };
  });

  renderMonth(today);
  return () => {
    for (const { control, click } of controls) control.removeEventListener('click', click);
  };
}
