import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCSV, loadText } from '../assets/js/content.mjs';
import { parseEvents, eventsForDate } from '../assets/js/events.mjs';
import { parseChurchInfo, footerEntries } from '../assets/js/site.mjs';

const data = name => readFile(new URL(`../church/${name}`, import.meta.url), 'utf8');

test('CSV comments, escaped quotes and quoted paragraphs retain original line numbers', () => {
  const rows = parseCSV('\ufeff# Note\r\n\r\nactive, "Lunch, games", "He said ""welcome"".\r\nSecond line."\r\n', { file: 'example.csv' });
  assert.deepEqual(rows, [{ fields: ['active', 'Lunch, games', 'He said "welcome".\nSecond line.'], line: 3 }]);
  assert.throws(() => parseCSV('# Note\nactive, "Unclosed', { file: 'example.csv' }), /example.csv, line 2/);
});

test('shared content loading fetches one consistent copy per URL and retries failures', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => ({ ok: true, text: async () => { requests++; return 'content'; } });
  try {
    assert.deepEqual(await Promise.all([loadText('https://example.test/site-test.csv'), loadText('https://example.test/site-test.csv')]), ['content', 'content']);
    assert.equal(requests, 1);
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    await assert.rejects(loadText('https://example.test/retry-test.csv'), /503/);
    globalThis.fetch = async () => ({ ok: true, text: async () => 'recovered' });
    assert.equal(await loadText('https://example.test/retry-test.csv'), 'recovered');
  } finally { globalThis.fetch = original; }
});

test('actual schedule and optional labels provide the common footer', async () => {
  const entries = footerEntries(parseEvents(await data('events.csv')), parseChurchInfo(await data('church-info.csv')));
  assert.deepEqual(entries, {
    sunday: ['Bible School: 8:30 AM', 'Sermon: 9:30 AM', 'Fellowship to follow'],
    weekly: ['Wednesday Study: 6:30 PM', 'Thursday Prayer: 6:00 PM', 'Saturday Breakfast: 9:00 AM']
  });
});

test('calendar-only events cannot change the footer even with a similar title', async () => {
  const text = await data('events.csv');
  const info = parseChurchInfo(await data('church-info.csv'));
  const expected = footerEntries(parseEvents(text), info);
  const extended = parseEvents(text + '\nactive, Thursday, 01:00 PM, Corporate Prayer Planning Dinner, no\nactive, 11/15/26, , Church Dinner, no');
  assert.deepEqual(footerEntries(extended, info), expected);
  assert.ok(eventsForDate(extended, new Date(2026, 10, 15)).some(event => event.title === 'Church Dinner'));
});

test('one source time updates footer and calendar; cancellation leaves regular schedule intact', async () => {
  const text = await data('events.csv');
  const info = parseChurchInfo(await data('church-info.csv'));
  const updated = parseEvents(text.replace('active, Thursday, 06:00 PM', 'active, Thursday, 07:00 PM'));
  assert.ok(footerEntries(updated, info).weekly.includes('Thursday Prayer: 7:00 PM'));
  assert.ok(eventsForDate(updated, new Date(2026, 10, 12)).some(event => event.title === 'Corporate Prayer' && event.time === '07:00 PM'));
  const original = parseEvents(text);
  const november4 = eventsForDate(original, new Date(2026, 10, 4)).filter(event => event.title === 'Bible Study');
  assert.equal(november4.length, 1);
  assert.equal(november4[0].active, false);
  assert.ok(footerEntries(original, info).weekly.includes('Wednesday Study: 6:30 PM'));
});

test('monthly footer labels retain recurrence and site settings report actionable mistakes', () => {
  const events = parseEvents('active, 1st Sunday, , Monthly Fellowship, yes');
  assert.deepEqual(footerEntries(events).sunday, ['1st Sunday Monthly Fellowship']);
  assert.throws(() => parseChurchInfo('address, One\naddress, Two'), /church-info.csv, line 2/);
  assert.throws(() => parseChurchInfo('phone, 555-0100\nemail, example@example.test'), /Add a value for address/);
});
