const cleanups = new WeakMap();

/** Keep both reels on the same cadence without starting timers on other pages. */
export function startCarousel(carousel, {
  document: doc = globalThis.document,
  interval = 5000,
  autoRotate = true,
} = {}) {
  if (!carousel) return () => {};
  cleanups.get(carousel)?.();
  const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let timer;

  const stop = () => {
    if (timer !== undefined) globalThis.clearInterval(timer);
    timer = undefined;
  };
  const configure = () => {
    stop();
    if (!autoRotate || motion?.matches || carousel.querySelectorAll('.carousel-item').length < 2) return;
    timer = globalThis.setInterval(() => {
      if (doc?.hidden) return;
      const items = Array.from(carousel.querySelectorAll('.carousel-item'));
      if (items.length < 2) { stop(); return; }
      const current = items.findIndex((item) => item.classList.contains('active'));
      items.forEach((item) => item.classList.remove('active'));
      items[(current + 1) % items.length].classList.add('active');
    }, interval);
  };
  const cleanup = () => {
    stop();
    motion?.removeEventListener?.('change', configure);
    cleanups.delete(carousel);
  };
  motion?.addEventListener?.('change', configure);
  cleanups.set(carousel, cleanup);
  configure();
  return cleanup;
}
