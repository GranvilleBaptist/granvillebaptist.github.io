import { loadText, reportContentError } from './content.mjs';
import { startCarousel } from './carousel.mjs';

const PHOTO_DIRECTORY = new URL('../../photos/gallery/', import.meta.url);
const MANIFEST_URL = new URL('photos.json', PHOTO_DIRECTORY);
const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|bmp)$/i;

/** Accept local filenames and the old gallery-relative form, preserving case. */
export function normalizePhotoName(value) {
  if (typeof value !== 'string') return '';
  let name = value.trim().replace(/\\/g, '/');
  if (/^[a-z][a-z\d+.-]*:/i.test(name) || name.startsWith('//')) return '';
  name = name.split(/[?#]/, 1)[0];
  try { name = decodeURIComponent(name); } catch { return ''; }
  name = name.replace(/^\.\//, '').replace(/^\//, '');
  if (name.startsWith('photos/gallery/')) name = name.slice('photos/gallery/'.length);
  if (!name || /[/\\]/.test(name) || /[\u0000-\u001f\u007f]/.test(name) || !IMAGE_EXTENSION.test(name)) return '';
  return name;
}

/** The manifest order is the slideshow order; nothing depends on directory listings. */
export function parsePhotoManifest(text, { file = 'photos/gallery/photos.json' } = {}) {
  let manifest;
  try { manifest = JSON.parse(text); }
  catch { throw new Error(`${file}: use a JSON list of quoted photo filenames.`); }
  if (!Array.isArray(manifest)) throw new Error(`${file}: use a list of photo filenames.`);
  const seen = new Set();
  return manifest.flatMap((value, index) => {
    const name = normalizePhotoName(value);
    if (!name) throw new Error(`${file}, item ${index + 1}: use an image filename from photos/gallery.`);
    if (seen.has(name)) return [];
    seen.add(name);
    return [name];
  });
}

function showPlaceholder(carousel, doc, text) {
  const slide = doc.createElement('div');
  slide.className = 'carousel-item active';
  const placeholder = doc.createElement('div');
  placeholder.className = 'reel-placeholder';
  placeholder.textContent = text;
  slide.append(placeholder);
  carousel.replaceChildren(slide);
}

export async function initGallery({
  document: doc = globalThis.document,
  autoRotate = true,
} = {}) {
  const carousel = doc?.getElementById('photo-carousel');
  if (!carousel) return () => {};
  let filenames;
  try {
    filenames = parsePhotoManifest(await loadText(MANIFEST_URL));
  } catch (error) {
    showPlaceholder(carousel, doc, 'Photos are temporarily unavailable.');
    reportContentError('photos/gallery/photos.json', error, doc);
    return () => {};
  }
  if (!filenames.length) {
    showPlaceholder(carousel, doc, 'No photos found in photos/gallery.');
    return () => {};
  }

  const slides = filenames.map((name, index) => {
    const slide = doc.createElement('div');
    slide.className = `carousel-item${index === 0 ? ' active' : ''}`;
    const image = doc.createElement('img');
    image.src = new URL(encodeURIComponent(name), PHOTO_DIRECTORY).href;
    image.alt = `Church photo ${index + 1}`;
    image.className = 'reel-photo';
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      if (!slide.isConnected) return;
      slide.remove();
      const remaining = Array.from(carousel.querySelectorAll('.carousel-item'));
      if (!remaining.length) showPlaceholder(carousel, doc, 'Photos are temporarily unavailable.');
      else if (!remaining.some((item) => item.classList.contains('active'))) remaining[0].classList.add('active');
      reportContentError('photos/gallery/photos.json', new Error(`The photo ${name} could not be loaded. Check its filename and capitalization.`), doc);
    }, { once: true });
    slide.append(image);
    return slide;
  });
  carousel.replaceChildren(...slides);
  return startCarousel(carousel, { document: doc, autoRotate });
}
