import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNews, parseVerse, selectHomeNews,
  renderHomeNews, renderNewsPage, renderVerse,
} from '../assets/js/news.mjs';
import { normalizePhotoName, parsePhotoManifest } from '../assets/js/gallery.mjs';
import { startCarousel } from '../assets/js/carousel.mjs';

test('news retains file order and selects highlighted active items first', () => {
  const items = parseNews(`# Pastor notes\nactive, Ordinary, Body\nh, inactive, Hidden highlight, Body\nh, active, Highlight one, Body\nh, active, Highlight two, Body\nactive, Last, Body`);
  assert.deepEqual(items.map((item) => item.title), ['Ordinary', 'Hidden highlight', 'Highlight one', 'Highlight two', 'Last']);
  assert.deepEqual(selectHomeNews(items).map((item) => item.title), ['Highlight one', 'Highlight two', 'Ordinary']);
});

test('news keeps quoted commas and escaped quotes as text', () => {
  const [item] = parseNews('h, active, "Dinner, fellowship, and prayer", "He said ""Come"", and join us."');
  assert.equal(item.title, 'Dinner, fellowship, and prayer');
  assert.equal(item.body, 'He said "Come", and join us.');
});

test('invalid news status and missing message report the file and line', () => {
  assert.throws(() => parseNews('# Notes\nactiv, Title, Body'), /church\/news.csv, line 2: use active or inactive/);
  assert.throws(() => parseNews('active, Title, '), /line 1: add an announcement message/);
});

test('verse reads the first real row and validates both fields', () => {
  assert.deepEqual(parseVerse('# Notes\n\nHebrews 10:23, "Let us hold fast, for He is faithful."\nJohn 3:16, Another verse'), {
    title: 'Hebrews 10:23', body: 'Let us hold fast, for He is faithful.',
  });
  assert.equal(parseVerse('# No verse this week'), null);
  assert.throws(() => parseVerse('Hebrews 10:23'), /line 1: include the scripture reference and verse text/);
});

class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.dataset = {}; this.className = ''; this._text = ''; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  querySelectorAll(selector) {
    assert.equal(selector, '.carousel-item');
    return this.children.filter((node) => node.className.split(' ').includes('carousel-item'));
  }
}

function fakeDocument() {
  const nodes = {
    '.news-carousel': new FakeElement('div'),
    '#news-list': new FakeElement('div'),
    '[data-verse-title]': new FakeElement('h3'),
    '[data-verse-body]': new FakeElement('p'),
  };
  return {
    nodes,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => nodes[`#${id}`] || null,
    querySelector: (selector) => nodes[selector] || null,
  };
}

test('rendering fewer or zero homepage announcements removes previous slides', () => {
  const doc = fakeDocument();
  const items = parseNews('active, One, First\nactive, Two, Second\nactive, Three, Third');
  renderHomeNews(items, { document: doc, autoRotate: false });
  assert.equal(doc.nodes['.news-carousel'].children.length, 3);
  renderHomeNews(items.slice(0, 1), { document: doc, autoRotate: false });
  assert.equal(doc.nodes['.news-carousel'].children.length, 1);
  assert.doesNotMatch(doc.nodes['.news-carousel'].textContent, /Two|Three/);
  renderHomeNews([], { document: doc, autoRotate: false });
  assert.equal(doc.nodes['.news-carousel'].children.length, 1);
  assert.match(doc.nodes['.news-carousel'].textContent, /No active news/);
  assert.doesNotMatch(doc.nodes['.news-carousel'].textContent, /First|Second|Third/);
});

test('news page displays only active items in file order, and renders markup literally', () => {
  const doc = fakeDocument();
  renderNewsPage(parseNews('active, Regular, <b>Safe text</b>\nh, active, Highlight, Second\ninactive, Hidden, Third'), { document: doc });
  const articles = doc.nodes['#news-list'].children;
  assert.equal(articles.length, 2);
  assert.equal(articles[0].children[0].textContent, 'Regular');
  assert.equal(articles[0].children[1].textContent, '<b>Safe text</b>');
  assert.equal(articles[0].children[1].children.length, 0);
  assert.equal(articles[1].children[0].textContent, 'Highlight');
  renderNewsPage([], { document: doc });
  assert.equal(doc.nodes['#news-list'].children.length, 1);
  assert.match(doc.nodes['#news-list'].textContent, /No active news/);
});

test('empty verse clears the previous weekly verse', () => {
  const doc = fakeDocument();
  renderVerse({ title: 'Old reference', body: 'Old verse' }, { document: doc });
  renderVerse(null, { document: doc });
  assert.equal(doc.nodes['[data-verse-title]'].textContent, 'Verse of the Week');
  assert.doesNotMatch(doc.nodes['[data-verse-body]'].textContent, /Old verse/);
});

test('gallery preserves file capitalization and manifest order', () => {
  assert.deepEqual(parsePhotoManifest('["img6.JPG", "photos/gallery/img1.JPG", "img6.JPG"]'), ['img6.JPG', 'img1.JPG']);
  assert.equal(normalizePhotoName('./photos/gallery/Church%20Photo.JPG'), 'Church Photo.JPG');
});

test('gallery rejects external paths, traversal, and non-image files', () => {
  for (const value of ['https://example.com/photo.jpg', '//example.com/photo.jpg', '../photo.jpg', 'nested/photo.jpg', 'photo%2fescape.jpg', '..%5cescape.jpg', 'script.html']) {
    assert.equal(normalizePhotoName(value), '');
  }
  assert.throws(() => parsePhotoManifest('{broken'), /photos.json: use a JSON list/);
  assert.throws(() => parsePhotoManifest('["img1.JPG", "../img2.JPG"]'), /item 2/);
});

test('empty and single-slide carousels do not start a timer', () => {
  const doc = fakeDocument();
  const carousel = doc.nodes['.news-carousel'];
  let calls = 0;
  const original = globalThis.setInterval;
  globalThis.setInterval = () => { calls++; return 1; };
  try {
    startCarousel(carousel, { document: doc })();
    const slide = new FakeElement('div'); slide.className = 'carousel-item active'; carousel.append(slide);
    startCarousel(carousel, { document: doc })();
    assert.equal(calls, 0);
  } finally { globalThis.setInterval = original; }
});

test('carousel respects reduced motion and rotates every five seconds when enabled', () => {
  const doc = fakeDocument();
  const carousel = doc.nodes['.news-carousel'];
  const first = new FakeElement('div'); first.className = 'carousel-item active';
  const second = new FakeElement('div'); second.className = 'carousel-item';
  for (const slide of [first, second]) {
    slide.classList = {
      contains: (name) => slide.className.split(' ').includes(name),
      remove: (name) => { slide.className = slide.className.split(' ').filter((item) => item !== name).join(' '); },
      add: (name) => { slide.className += ` ${name}`; },
    };
  }
  carousel.append(first, second);
  let tick, onChange, interval, stopped = 0;
  const motion = { matches: true, addEventListener: (_, listener) => { onChange = listener; }, removeEventListener: () => {} };
  const originals = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, matchMedia: globalThis.matchMedia };
  globalThis.matchMedia = () => motion;
  globalThis.setInterval = (callback, milliseconds) => { tick = callback; interval = milliseconds; return 1; };
  globalThis.clearInterval = () => { stopped++; };
  try {
    const cleanup = startCarousel(carousel, { document: doc });
    assert.equal(tick, undefined);
    motion.matches = false;
    onChange();
    assert.equal(interval, 5000);
    doc.hidden = true;
    tick();
    assert.ok(first.classList.contains('active'));
    doc.hidden = false;
    tick();
    assert.ok(second.classList.contains('active'));
    tick();
    assert.ok(first.classList.contains('active'));
    motion.matches = true;
    onChange();
    assert.equal(stopped, 1);
    cleanup();
  } finally {
    Object.assign(globalThis, originals);
  }
});
