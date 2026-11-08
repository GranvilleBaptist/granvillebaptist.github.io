import { loadText, reportContentError } from './content.mjs';
import { parseEvents } from './events.mjs';
import { initCalendar } from './calendar.mjs';
import { parseChurchInfo, applyChurchInfo, renderFooter } from './site.mjs';
import { parseNews, parseVerse, renderNewsPage, renderHomeNews, renderVerse } from './news.mjs';
import { initGallery } from './gallery.mjs';

const siteRoot = new URL('../../', import.meta.url);
const contentURL = file => new URL(`church/${file}`, siteRoot);
const page = document.body.dataset.page;

function report(file) {
  return error => { reportContentError(file, error); throw error; };
}

// All sections on one page share the same parsed copy of each content file.
const events = loadText(contentURL('events.csv')).then(text => parseEvents(text)).catch(report('events.csv'));
const info = loadText(contentURL('church-info.csv')).then(text => {
  const settings = parseChurchInfo(text);
  applyChurchInfo(settings);
  return settings;
}).catch(report('church-info.csv'));

const work = [
  info,
  Promise.all([events, info]).then(([entries, settings]) => renderFooter(entries, settings)).catch(() => {
    document.querySelectorAll('.footer-section.services p, .footer-section.activities p').forEach(element => {
      element.textContent = 'Schedule unavailable';
    });
  })
];

if (page === 'news') work.push(events.then(entries => initCalendar(entries)).catch(() => {
  document.querySelectorAll('.monthly-calendar, .weekly-calendar').forEach(element => {
    element.textContent = 'Calendar data could not be loaded.';
  });
}));

if (page === 'home' || page === 'news') {
  work.push(loadText(contentURL('news.csv')).then(text => {
    const items = parseNews(text);
    if (page === 'home') renderHomeNews(items);
    else renderNewsPage(items);
  }).catch(error => {
    reportContentError('news.csv', error);
    if (page === 'home') renderHomeNews([]);
    else renderNewsPage([]);
  }));
}

if (page === 'home') {
  work.push(loadText(contentURL('verseoftheweek.csv')).then(text => renderVerse(parseVerse(text))).catch(error => {
    reportContentError('verseoftheweek.csv', error);
    renderVerse(null);
  }));
  work.push(initGallery());
}

await Promise.allSettled(work);
