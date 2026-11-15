import { loadText, reportContentError } from './content.mjs';
import { startCarousel } from './carousel.mjs';

const PHOTO_DIRECTORY = new URL('../../photos/gallery/', import.meta.url);
const MANIFEST_URL = new URL('photos.json', PHOTO_DIRECTORY);
const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp|bmp)$/i;

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

export async function initGallery({
  document: doc = globalThis.document,
  autoRotate = true,
} = {}) {
  const track = doc?.querySelector('[data-photo-track]') || doc?.getElementById('photo-carousel');
  const gallery = doc?.querySelector('[data-gallery]');
  if (!track && !gallery) return () => {};
  const viewer = doc.querySelector('[data-photo-viewer]');
  const viewerImage = viewer?.querySelector('img');
  const closeButton = viewer?.querySelector('[data-photo-close]');
  let stopCarousel = () => {};
  let disposed = false;

  function message(text) {
    for (const container of [track, gallery].filter(Boolean)) {
      const paragraph = doc.createElement('p');
      paragraph.className = 'gbc-gallery-message';
      paragraph.textContent = text;
      container.replaceChildren(paragraph);
    }
  }

  let filenames;
  try {
    filenames = parsePhotoManifest(await loadText(MANIFEST_URL));
  } catch (error) {
    message('Photos are temporarily unavailable.');
    reportContentError('photos/gallery/photos.json', error, doc);
    return () => {};
  }
  if (!filenames.length) {
    message('No photos are available yet.');
    return () => {};
  }

  function photo(name, index) {
    const image = doc.createElement('img');
    image.src = new URL(encodeURIComponent(name), PHOTO_DIRECTORY).href;
    image.alt = `Church photo ${index + 1}`;
    image.loading = index === 0 ? 'eager' : 'lazy';
    image.decoding = 'async';
    return image;
  }

  const slides = [];
  const buttons = [];
  filenames.forEach((name, index) => {
    if (track) {
      const slide = doc.createElement('div');
      slide.className = `gbc-carousel-slide carousel-item${index === 0 ? ' active' : ''}`;
      const image = photo(name, index);
      image.addEventListener('error', () => {
        if (disposed || !slide.isConnected) return;
        stopCarousel();
        slide.remove();
        if (track.querySelector('.carousel-item')) {
          stopCarousel = startCarousel(track, { document: doc, autoRotate });
        } else {
          const paragraph = doc.createElement('p');
          paragraph.className = 'gbc-gallery-message';
          paragraph.textContent = 'Photos are temporarily unavailable.';
          track.replaceChildren(paragraph);
        }
      }, { once: true });
      slide.append(image);
      slides.push(slide);
    }
    if (gallery) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'gbc-photo';
      button.setAttribute('aria-label', `Enlarge church photo ${index + 1}`);
      const image = photo(name, index);
      button.append(image);
      button.addEventListener('click', () => {
        if (!viewer || !viewerImage) return;
        viewerImage.src = image.src;
        viewerImage.alt = image.alt;
        if (typeof viewer.showModal === 'function') viewer.showModal();
        else viewer.setAttribute('open', '');
      });
      buttons.push(button);
    }
  });
  if (track) {
    track.replaceChildren(...slides);
    stopCarousel = startCarousel(track, { document: doc, autoRotate });
  }
  if (gallery) gallery.replaceChildren(...buttons);

  function close() {
    if (typeof viewer?.close === 'function') viewer.close();
    else viewer?.removeAttribute('open');
    viewerImage?.removeAttribute('src');
  }
  function clearViewer() { viewerImage?.removeAttribute('src'); }
  closeButton?.addEventListener('click', close);
  viewer?.addEventListener('close', clearViewer);
  return () => {
    disposed = true;
    stopCarousel();
    closeButton?.removeEventListener('click', close);
    viewer?.removeEventListener('close', clearViewer);
    if (viewer?.open) close();
  };
}
