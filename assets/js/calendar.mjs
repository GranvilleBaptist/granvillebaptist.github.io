import { DAY_NAMES, eventsForDate, toISODate } from './events.mjs';
import { escapeHTML } from './content.mjs';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Attach the existing month/week calendar to parsed event data. */
export function initCalendar(events, { root = document, now = new Date() } = {}) {
  const monthly = root.querySelector('.monthly-calendar');
  const weekly = root.querySelector('.weekly-calendar');
  const weekDate = root.querySelector('#weekDate');
  if (!monthly || !weekly || !weekDate) return;
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  function renderEventRow(event) {
    const time = escapeHTML(event.time);
    const title = escapeHTML(event.title);
    if (event.active) {
      return `<div class="event">
            <span class="event-time">${time}</span>
            <span class="event-name">${title}</span>
          </div>`;
    }
    return `<div class="event" style="opacity:0.6;">
          <div>
            <span class="event-time" style="text-decoration:line-through;">${time}</span>
            <span class="event-name" style="text-decoration:line-through; margin-left:6px;">${title}</span>
          </div>
          <div style="font-size:0.85em; margin-top:2px;">Cancelled</div>
        </div>`;
  }

  function showWeeklyCalendar(selectedDate) {
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - selectedDate.getDay());
    const weekEnd = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + 6);
    const dateOptions = { month: 'short', day: 'numeric' };
    weekDate.textContent = `${firstDay.toLocaleDateString('en-US', dateOptions)} - ${weekEnd.toLocaleDateString('en-US', dateOptions)}`;
    let html = '<div class="week-view">';
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + i);
      const dayEvents = eventsForDate(events, dayDate);
      const dayLabel = `${DAY_NAMES[dayDate.getDay()]} ${dayDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}`;
      if (!dayEvents.length) {
        html += `<div class="day-column no-event-day">
              <div class="no-events">${dayLabel} No Events</div>
            </div>`;
      } else {
        html += `<div class="day-column">
            <div class="day-header">${dayLabel}</div>
            <div class="events-container">${dayEvents.map(renderEventRow).join('')}</div></div>`;
      }
    }
    weekly.innerHTML = `${html}</div>`;
  }

  function generateMonthlyCalendar() {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const prevLastDay = new Date(viewYear, viewMonth, 0).getDate();
    const nextDays = (6 - lastDay.getDay() + 7) % 7;
    let html = `<div class="month-header">${MONTH_NAMES[viewMonth]} ${viewYear}</div>`;
    html += '<div class="weekdays"><div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div></div><div class="days">';
    for (let i = prevLastDay - firstDay.getDay() + 1; i <= prevLastDay; i++) html += `<div class="day other-month">${i}</div>`;
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(viewYear, viewMonth, i);
      const iso = toISODate(date);
      const dayEvents = eventsForDate(events, date);
      const hasAny = dayEvents.length > 0;
      const onlyCancelled = hasAny && !dayEvents.some(event => event.active);
      html += `<div class="day ${iso === toISODate(now) ? 'today' : ''} ${hasAny ? 'has-event' : ''} ${onlyCancelled ? 'has-cancelled' : ''}" data-date="${iso}" title="${hasAny ? (onlyCancelled ? 'Only cancelled events' : 'Events scheduled') : ''}">${i}</div>`;
    }
    for (let i = 1; i <= nextDays; i++) html += `<div class="day other-month">${i}</div>`;
    monthly.innerHTML = `${html}</div>`;
    monthly.querySelectorAll('.day:not(.other-month)').forEach(day => {
      day.addEventListener('click', () => {
        const [year, month, date] = day.dataset.date.split('-').map(Number);
        showWeeklyCalendar(new Date(year, month - 1, date));
      });
    });
  }

  function changeMonth(direction) {
    const month = new Date(viewYear, viewMonth + direction, 1);
    viewYear = month.getFullYear();
    viewMonth = month.getMonth();
    generateMonthlyCalendar();
  }

  const heading = root.querySelector('.monthly-calendar-wrapper h3');
  if (heading && !heading.querySelector('.month-nav-btn')) {
    const ownerDocument = heading.ownerDocument || root;
    for (const direction of [-1, 1]) {
      const button = ownerDocument.createElement('button');
      button.type = 'button';
      button.className = 'month-nav-btn';
      button.textContent = direction === -1 ? '<' : '>';
      button.setAttribute('aria-label', direction === -1 ? 'Previous month' : 'Next month');
      button.style[direction === -1 ? 'marginRight' : 'marginLeft'] = '8px';
      button.addEventListener('click', () => changeMonth(direction));
      if (direction === -1) heading.prepend(button);
      else heading.append(button);
    }
  }
  generateMonthlyCalendar();
  showWeeklyCalendar(now);
}
