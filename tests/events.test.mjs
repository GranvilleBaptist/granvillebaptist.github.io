import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseEvents, eventsForDate, regularFooterEvents } from '../assets/js/events.mjs';
import { initCalendar } from '../assets/js/calendar.mjs';

const header = '# Status, day/date, time, title, show_in_footer\n';
const date = (year, month, day) => new Date(year, month - 1, day);

test('only active recurring events explicitly marked yes enter the footer', () => {
  const events = parseEvents(header + [
    'active, Sunday, 08:30 AM, Sunday School, yes',
    'active, Sunday, 09:30 AM, Sermon',
    'inactive, Thursday, 6:00 PM, Prayer, yes',
    'active, 11/08/26, , Lunch, no',
    'active, 1st Sunday, , Fellowship, no',
  ].join('\n'));
  assert.deepEqual(regularFooterEvents(events).map(event => event.title), ['Sunday School']);
  assert.ok(eventsForDate(events, date(2026, 11, 8)).some(event => event.title === 'Lunch'));
});

test('a dated cancellation changes only that occurrence and retains its time', () => {
  const events = parseEvents(header + 'active, Wednesday, 06:30 PM, Bible Study, yes\ncancel, 11/04/26, , Bible Study, no');
  const cancelled = eventsForDate(events, date(2026, 11, 4));
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].active, false);
  assert.equal(cancelled[0].time, '06:30 PM');
  assert.equal(eventsForDate(events, date(2026, 11, 11))[0].active, true);
  assert.equal(regularFooterEvents(events)[0].active, true);
});

test('a cancellation can target one time when the same title occurs twice', () => {
  const events = parseEvents(header + [
    'active, Wednesday, 09:00 AM, Bible Study, no',
    'active, Wednesday, 06:30 PM, Bible Study, no',
    'cancel, 11/04/26, 06:30 PM, Bible Study, no',
  ].join('\n'));
  assert.deepEqual(eventsForDate(events, date(2026, 11, 4)).map(event => [event.time, event.active]), [
    ['09:00 AM', true], ['06:30 PM', false],
  ]);
});

test('monthly rules support multiple ordinals, last weekdays, and quoted commas', () => {
  const events = parseEvents(header + [
    'active, 2nd & 4th & 5th Sunday, , Coffee, no',
    'active, last Sunday, , Last Sunday, no',
    'active, "2nd, 4th Wednesday", , Midweek, no',
  ].join('\n'));
  assert.deepEqual(eventsForDate(events, date(2026, 11, 8)).map(event => event.title), ['Coffee']);
  assert.deepEqual(eventsForDate(events, date(2026, 11, 15)), []);
  assert.deepEqual(eventsForDate(events, date(2026, 11, 29)).map(event => event.title), ['Coffee', 'Last Sunday']);
  assert.deepEqual(eventsForDate(events, date(2026, 11, 11)).map(event => event.title), ['Midweek']);
});

test('times sort chronologically across AM and PM, with blank times last', () => {
  const events = parseEvents(header + [
    'active, Sunday, 06:00 PM, Evening, no',
    'active, Sunday, , No time, no',
    'active, Sunday, 12:00 PM, Noon, no',
    'active, Sunday, 08:30 AM, Morning, no',
  ].join('\n'));
  assert.deepEqual(eventsForDate(events, date(2026, 11, 8)).map(event => event.title), ['Morning', 'Noon', 'Evening', 'No time']);
});

test('quoted title commas and quotes work, as do legacy rows without the new column', () => {
  assert.equal(parseEvents('active, Sunday, , "Lunch, games, and ""fellowship""", no')[0].title, 'Lunch, games, and "fellowship"');
  assert.equal(parseEvents('Sunday, 9:00 AM, Legacy')[0].active, true);
  assert.equal(parseEvents('active, Sunday, , Lunch, games')[0].title, 'Lunch,games');
  assert.equal(parseEvents('active, Sunday, , Legacy')[0].showInFooter, false);
});

test('invalid fields produce a useful file and line number', () => {
  const invalid = [
    ['active, Sunday, , Study, yess', /show_in_footer must be yes or no/],
    ['active, 02/30/26, , Study, no', /valid MM\/DD\/YY/],
    ['active, Sunday, 25:10 PM, Study, no', /Use a time/],
    ['active, 11/08/26, , Study, yes', /Only recurring events/],
    ['cancel, Sunday, , Study, no', /one specific/],
    ['cancel, 11/04/26, , Missing Study, no', /No event named/],
  ];
  for (const [row, message] of invalid) {
    assert.throws(() => parseEvents(header + row, { file: 'church/events.csv' }), error => {
      assert.match(error.message, /church\/events.csv, line 2:/);
      assert.match(error.message, message);
      return true;
    });
  }
});

test('the saved schedule has five footer entries and a single cancelled Bible Study occurrence', async () => {
  const events = parseEvents(await readFile(new URL('../church/events.csv', import.meta.url), 'utf8'));
  assert.deepEqual(regularFooterEvents(events).map(event => [event.title, event.time]), [
    ['Sunday School', '08:30 AM'], ['Sermon', '09:30 AM'], ['Bible Study', '06:30 PM'],
    ['Corporate Prayer', '06:00 PM'], ["Men's Breakfast @ Pine Grove", '09:00 AM'],
  ]);
  const cancelled = eventsForDate(events, date(2026, 11, 4));
  assert.equal(cancelled.length, 1);
  assert.equal(cancelled[0].title, 'Bible Study');
  assert.equal(cancelled[0].active, false);
});

test('calendar retains its layout classes and renders edited titles as text', () => {
  const monthly = { innerHTML: '', querySelectorAll: () => [] };
  const weekly = { innerHTML: '' };
  const weekDate = { textContent: '' };
  const root = { querySelector: selector => ({
    '.monthly-calendar': monthly, '.weekly-calendar': weekly, '#weekDate': weekDate,
  })[selector] || null };
  const events = parseEvents(header + 'inactive, Sunday, , <img src=x onerror=alert(1)>, no');
  initCalendar(events, { root, now: date(2026, 11, 8) });
  assert.match(monthly.innerHTML, /class="month-header">November 2026/);
  assert.match(monthly.innerHTML, /class="day today has-event has-cancelled" data-date="2026-11-08"/);
  assert.match(weekly.innerHTML, /class="week-view"/);
  assert.match(weekly.innerHTML, /class="day-column"/);
  assert.match(weekly.innerHTML, /class="events-container"/);
  assert.match(weekly.innerHTML, /class="event-name" style="text-decoration:line-through; margin-left:6px;">&lt;img/);
  assert.doesNotMatch(weekly.innerHTML, /<img/);
  assert.equal(weekDate.textContent, 'Nov 8 - Nov 14');
});

test('the monthly grid ends on Saturday with a complete final week', () => {
  for (const [year, month, expectedCells, expectedTrailing] of [
    [2026, 1, 35, 0], // January ends on Saturday.
    [2026, 5, 42, 6], // May ends on Sunday.
    [2026, 11, 35, 5],
  ]) {
    const monthly = { innerHTML: '', querySelectorAll: () => [] };
    const root = { querySelector: selector => ({
      '.monthly-calendar': monthly, '.weekly-calendar': { innerHTML: '' }, '#weekDate': { textContent: '' },
    })[selector] || null };
    initCalendar([], { root, now: date(year, month, 1) });
    const cells = [...monthly.innerHTML.matchAll(/<div class="day(?: [^"]*)?"[^>]*>(\d+)<\/div>/g)];
    assert.equal(cells.length, expectedCells, `${year}-${month} cell count`);
    assert.equal(cells.length % 7, 0, `${year}-${month} complete weeks`);
    const lastScheduled = cells.findLastIndex(cell => cell[0].includes('data-date='));
    assert.equal(cells.length - lastScheduled - 1, expectedTrailing, `${year}-${month} trailing dates`);
    assert.equal(cells.at(-1)[1], String(expectedTrailing || new Date(year, month, 0).getDate()));
  }
});
