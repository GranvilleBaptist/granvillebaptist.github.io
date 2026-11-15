const cleanups = new WeakMap();

export function startCarousel(carousel, {
  document: doc = globalThis.document,
  interval = 5000,
  autoRotate = true,
} = {}) {
  if (!carousel) return () => {};
  cleanups.get(carousel)?.();
  const view = doc?.defaultView || globalThis;
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let timer;
  let transition;
  let loopSlide;
  let disposed = false;

  const items = () => Array.from(carousel.querySelectorAll('.carousel-item'));

  function show(target) {
    const slides = items();
    const selected = slides.includes(target) ? target : slides[0];
    for (const slide of slides) {
      slide.classList.toggle('active', slide === selected);
      slide.setAttribute('aria-hidden', String(slide !== selected));
    }
    const index = Math.max(0, slides.indexOf(selected));
    carousel.style.transform = `translateX(-${index * 100}%)`;
  }

  function stopTransition(target) {
    const animation = transition;
    transition = undefined;
    show(target || items().find(slide => slide.classList.contains('active')));
    loopSlide?.remove();
    loopSlide = undefined;
    animation?.cancel();
  }

  function advance() {
    if (disposed || doc?.hidden || motion?.matches || transition) return;
    const slides = items();
    if (slides.length < 2) return;
    const current = Math.max(0, slides.findIndex(slide => slide.classList.contains('active')));
    const next = (current + 1) % slides.length;
    if (typeof carousel.animate !== 'function') {
      show(slides[next]);
      return;
    }
    let destination = next;
    if (next === 0) {
      loopSlide = slides[0].cloneNode(true);
      loopSlide.classList.remove('carousel-item', 'active');
      loopSlide.setAttribute('aria-hidden', 'true');
      carousel.append(loopSlide);
      destination = slides.length;
    }
    const animation = carousel.animate([
      { transform: `translateX(-${current * 100}%)` },
      { transform: `translateX(-${destination * 100}%)` },
    ], { duration: 500, easing: 'ease-in-out', fill: 'both' });
    transition = animation;
    animation.onfinish = () => {
      if (transition === animation && !disposed) stopTransition(slides[next]);
    };
    animation.oncancel = () => {
      if (transition === animation) stopTransition(slides[current]);
    };
  }

  function configure() {
    if (timer !== undefined) view.clearInterval(timer);
    timer = undefined;
    stopTransition();
    if (!disposed && autoRotate && !doc?.hidden && !motion?.matches && items().length > 1) {
      timer = view.setInterval(advance, interval);
    }
  }

  function cleanup() {
    disposed = true;
    configure();
    motion?.removeEventListener?.('change', configure);
    doc?.removeEventListener?.('visibilitychange', configure);
    if (cleanups.get(carousel) === cleanup) cleanups.delete(carousel);
  }

  motion?.addEventListener?.('change', configure);
  doc?.addEventListener?.('visibilitychange', configure);
  cleanups.set(carousel, cleanup);
  configure();
  return cleanup;
}
