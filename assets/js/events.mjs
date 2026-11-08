import { parseCSV } from './content.mjs';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS = new Map([
  ['sunday', 0], ['sun', 0], ['monday', 1], ['mon', 1], ['tuesday', 2], ['tue', 2], ['tues', 2],
  ['wednesday', 3], ['wed', 3], ['thursday', 4], ['thu', 4], ['thur', 4], ['thurs', 4],
  ['friday', 5], ['fri', 5], ['saturday', 6], ['sat', 6],
]);
const STATUSES = new Set(['active', 'inactive', 'cancelled', 'canceled', 'cancel']);

function invalid(file, line, message) {
  const error = new Error(`${file}, line ${line}: ${message}`);
  error.file = file;
  error.line = line;
  throw error;
}

export function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDate(value) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (match[3].length === 2) year += year <= 69 ? 2000 : 1900;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toISODate(date);
}

function parseRecurrence(value) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  const weekday = WEEKDAYS.get(normalized.toLowerCase());
  if (weekday !== undefined) return { recurrence: 'weekly', weekday, day: DAY_NAMES[weekday], date: null, ordinals: [] };
  const date = parseDate(normalized);
  if (date) return { recurrence: 'dated', weekday: null, day: normalized, date, ordinals: [] };
  const monthly = normalized.match(/^(.+) ([a-z]+)$/i);
  if (!monthly) return null;
  const monthlyWeekday = WEEKDAYS.get(monthly[2].toLowerCase());
  if (monthlyWeekday === undefined) return null;
  const tokens = monthly[1].split(/\s*(?:&|,|\band\b)\s*/i);
  const ordinals = [];
  for (const token of tokens) {
    const match = token.match(/^([1-5])(?:st|nd|rd|th)$/i);
    const ordinal = token.toLowerCase() === 'last' ? 'last' : match ? Number(match[1]) : null;
    if (ordinal === null) return null;
    if (!ordinals.includes(ordinal)) ordinals.push(ordinal);
  }
  return { recurrence: 'monthly', weekday: monthlyWeekday, day: normalized, date: null, ordinals };
}

function parseTime(value, file, line) {
  const time = value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!time) return { time: '', timeMinutes: null };
  const match = time.match(/^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/);
  if (!match) invalid(file, line, 'Use a time such as 08:30 AM or 6:30 PM, or leave it blank.');
  const hour = Number(match[1]) % 12 + (match[3] === 'PM' ? 12 : 0);
  return { time, timeMinutes: hour * 60 + Number(match[2]) };
}

/** Records retain the editable title/time plus recurrence, active, and showInFooter. */
export function parseEvents(text, { file = 'events.csv' } = {}) {
  // A header names the new column, letting old unquoted comma titles remain readable.
  const explicitFooterColumn = /^\s*#.*\bshow_in_footer\b/im.test(text);
  const events = parseCSV(text, { file }).map(({ fields: inputFields, line }) => {
    const fields = inputFields.slice();
    let status = (fields[0] || '').toLowerCase();
    if (!STATUSES.has(status) && parseRecurrence(fields[0] || '') && fields.length >= 3) {
      fields.unshift('active');
      status = 'active';
    }
    if (!STATUSES.has(status)) invalid(file, line, 'Status must be active, inactive, cancelled, or cancel.');
    if (fields.length < 4) invalid(file, line, 'Each event needs a status, day or date, time (which may be blank), and title.');
    const recurrence = parseRecurrence(fields[1]);
    if (!recurrence) invalid(file, line, 'Use a weekday, valid MM/DD/YY date, or monthly rule such as 1st Sunday.');
    const time = parseTime(fields[2], file, line);
    let showInFooter = false;
    const final = fields.at(-1).trim().toLowerCase();
    if (fields.length >= 5 && (final === 'yes' || final === 'no')) {
      showInFooter = final === 'yes';
      fields.pop();
    } else if (fields.length >= 5 && explicitFooterColumn) {
      invalid(file, line, 'show_in_footer must be yes or no. Quote titles that contain commas.');
    }
    const title = fields.slice(3).join(',').trim();
    if (!title) invalid(file, line, 'Enter an event title.');
    const action = status === 'cancel' ? 'cancel' : 'event';
    if (action === 'cancel' && recurrence.recurrence !== 'dated') invalid(file, line, 'A cancel override needs one specific MM/DD/YY date.');
    if (showInFooter && (recurrence.recurrence === 'dated' || action === 'cancel')) invalid(file, line, 'Only recurring events can have show_in_footer set to yes.');
    return { ...recurrence, ...time, title, name: title, active: status === 'active', showInFooter, action, line };
  });
  for (const override of events.filter(event => event.action === 'cancel')) {
    const date = localDate(override.date);
    if (!events.some(event => event.action === 'event' && matchesDate(event, date) && cancellationMatches(override, event))) {
      invalid(file, override.line, `No event named "${override.title}" matches this cancellation date and time.`);
    }
  }
  return events;
}

function localDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function matchesDate(event, date) {
  if (event.recurrence === 'dated') return event.date === toISODate(date);
  if (event.weekday !== date.getDay()) return false;
  if (event.recurrence === 'weekly') return true;
  const occurrence = Math.floor((date.getDate() - 1) / 7) + 1;
  const nextWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
  return event.ordinals.includes(occurrence) || (event.ordinals.includes('last') && nextWeek.getMonth() !== date.getMonth());
}

function cancellationMatches(override, event) {
  return override.title.toLocaleLowerCase() === event.title.toLocaleLowerCase()
    && (override.timeMinutes === null || override.timeMinutes === event.timeMinutes);
}

export function compareEvents(a, b) {
  return Number(b.active) - Number(a.active)
    || (a.timeMinutes ?? Infinity) - (b.timeMinutes ?? Infinity)
    || a.line - b.line;
}

/** A dated cancel row disables the matching occurrence without altering its recurrence. */
export function eventsForDate(events, date) {
  const overrides = events.filter(event => event.action === 'cancel' && matchesDate(event, date));
  return events.filter(event => event.action === 'event' && matchesDate(event, date)).map(event =>
    overrides.some(override => cancellationMatches(override, event))
      ? { ...event, active: false, cancelledOccurrence: true }
      : event
  ).sort(compareEvents);
}

export function regularFooterEvents(events) {
  return events.filter(event => event.action === 'event' && event.recurrence !== 'dated' && event.active && event.showInFooter)
    .sort((a, b) => a.weekday - b.weekday || compareEvents(a, b));
}
