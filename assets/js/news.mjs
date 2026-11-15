import { contentError, parseCSV } from './content.mjs';
import { startCarousel } from './carousel.mjs';

export function parseNews(text, { file = 'church/news.csv' } = {}) {
  return parseCSV(text, { file }).map(({ fields, line }) => {
    const highlighted = (fields[0] || '').toLowerCase() === 'h';
    const offset = highlighted ? 1 : 0;
    if (fields.length < offset + 3) {
      throw contentError(file, line, 'include status, title, and message.');
    }

    const status = fields[offset].toLowerCase();
    if (!['active', 'inactive'].includes(status)) {
      throw contentError(file, line, 'use active or inactive for the news status.');
    }
    const title = fields[offset + 1].trim();
    const body = fields.slice(offset + 2).join(',').trim();
    if (!title) throw contentError(file, line, 'add an announcement title.');
    if (!body) throw contentError(file, line, 'add an announcement message.');
    return { active: status === 'active', highlighted, title, body };
  });
}

export function selectHomeNews(items, maxItems = 3) {
  const active = items.filter((item) => item.active);
  return [
    ...active.filter((item) => item.highlighted),
    ...active.filter((item) => !item.highlighted),
  ].slice(0, maxItems);
}

export function parseVerse(text, { file = 'church/verseoftheweek.csv' } = {}) {
  const first = parseCSV(text, { file })[0];
  if (!first) return null;
  const { fields, line } = first;
  if (fields.length < 2) {
    throw contentError(file, line, 'include the scripture reference and verse text.');
  }
  const title = fields[0].trim();
  const body = fields.slice(1).join(',').trim();
  if (!title || !body) {
    throw contentError(file, line, 'include both the scripture reference and verse text.');
  }
  return { title, body };
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderNewsPage(items, { document: doc = globalThis.document, info = new Map() } = {}) {
  const list = doc?.querySelector('[data-news-list]') || doc?.getElementById('news-list');
  if (!list) return;
  const active = items.filter((item) => item.active);
  const nodes = active.map((item) => {
    const article = element(doc, 'article', 'gbc-news-item');
    article.append(
      element(doc, 'h3', '', info.get(`news_label.${item.title}`) || item.title),
      element(doc, 'p', '', item.body),
    );
    return article;
  });
  if (!nodes.length) {
    nodes.push(element(doc, 'p', 'news-empty', 'No active news items right now.'));
  }
  list.replaceChildren(...nodes);
}

export function renderHomeNews(items, {
  document: doc = globalThis.document,
  autoRotate = true,
} = {}) {
  const carousel = doc?.querySelector('.news-carousel');
  if (!carousel) return () => {};
  const selected = selectHomeNews(items);
  const nodes = selected.map((item, index) => {
    const slide = element(doc, 'div', `carousel-item${index === 0 ? ' active' : ''}`);
    const article = element(doc, 'div', 'news-item-container');
    const title = element(doc, 'h4', '', item.title);
    const body = element(doc, 'p', '', item.body);
    title.dataset.newsTitle = String(index + 1);
    body.dataset.newsBody = String(index + 1);
    article.append(title, body);
    slide.append(article);
    return slide;
  });
  if (!nodes.length) {
    const slide = element(doc, 'div', 'carousel-item active');
    const article = element(doc, 'div', 'news-item-container');
    article.append(element(doc, 'p', '', 'No active news items right now.'));
    slide.append(article);
    nodes.push(slide);
  }
  carousel.replaceChildren(...nodes);

  return startCarousel(carousel, { document: doc, autoRotate });
}

export function renderVerse(verse, { document: doc = globalThis.document } = {}) {
  const title = doc?.querySelector('[data-verse-title]');
  const body = doc?.querySelector('[data-verse-body]');
  const reference = doc?.querySelector('[data-verse-reference]');
  if (title) title.textContent = 'Verse of the Week';
  if (reference) reference.textContent = verse?.title || '';
  if (body) body.textContent = verse?.body || "This week's verse will be shared soon.";
}
