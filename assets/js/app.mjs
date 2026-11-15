import { loadText, reportContentError } from './content.mjs';
import { parseEvents } from './events.mjs';
import { initCalendar } from './calendar.mjs';
import { initUpcoming } from './upcoming.mjs';
import { initBulletin } from './bulletin.mjs';
import { parseChurchInfo, applyChurchInfo, renderFooter, renderSchedules } from './site.mjs';
import { parseNews, parseVerse, renderNewsPage, renderVerse } from './news.mjs';
import { initGallery } from './gallery.mjs';

const siteRoot = new URL('../../', import.meta.url);
const page = document.body.dataset.page;

async function readContent(file, parse, fallback) {
  try {
    return parse(await loadText(new URL(`church/${file}`, siteRoot)));
  } catch (error) {
    reportContentError(file, error);
    return fallback;
  }
}

const [events, info, news, verse] = await Promise.all([
  readContent('events.csv', parseEvents, []),
  readContent('church-info.csv', parseChurchInfo, new Map()),
  page === 'home' || page === 'news' ? readContent('news.csv', parseNews, []) : [],
  page === 'home' ? readContent('verseoftheweek.csv', parseVerse, null) : null,
]);

applyChurchInfo(info);
renderFooter(events, info);
renderSchedules(events, info);
const cleanups = [initUpcoming(events, info)];

if (page === 'calendar') cleanups.push(initCalendar(events, { info }));
if (page === 'news') renderNewsPage(news, { info });
if (page === 'home') {
  renderVerse(verse);
  cleanups.push(initBulletin({ news, events, info }));
}
if (page === 'home' || page === 'photos') {
  try {
    cleanups.push(await initGallery());
  } catch (error) {
    reportContentError('photos/gallery/photos.json', error);
  }
}

addEventListener('pagehide', event => {
  if (event.persisted) return;
  for (const cleanup of cleanups) cleanup?.();
});
