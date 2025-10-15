(function () {
  const MUSIC_FOLDER_NAME = 'music'; // case-insensitive

  function getMusicBasePath() {
    const path = window.location.pathname;
    const segments = path.match(/\/[^\/]+\/?/g) || [];
    let accum = '';
    for (const seg of segments) {
      accum += seg;
      if (seg.toLowerCase() === `/${MUSIC_FOLDER_NAME}/`) return accum;
    }
    if (path.toLowerCase().includes(`/${MUSIC_FOLDER_NAME}/`)) {
      return path.slice(0, path.toLowerCase().indexOf(`/${MUSIC_FOLDER_NAME}/`) + (`/${MUSIC_FOLDER_NAME}/`).length);
    }
    return './';
  }

  async function injectPartial(placeholderId, partialRelPath) {
    const base = getMusicBasePath();
    const url = `${base}${partialRelPath}`;
    const host = document.getElementById(placeholderId);
    if (!host) return null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${partialRelPath} -> ${res.status}`);
      host.innerHTML = await res.text();
      host.removeAttribute('aria-hidden');

      // Normalise any data-href links inside this partial
      const nav = host.querySelector('[data-href], .nav a[data-href], a[data-href]');
      if (nav) {
        host.querySelectorAll('a[data-href]').forEach(a => {
          const data = a.getAttribute('data-href') || '';
          a.setAttribute('href', data.startsWith('#') ? data : `${base}${data}`);
        });
      }
      return host;
    } catch (e) {
      console.warn('Inject failed:', e);
      return null;
    }
  }

  function onlyOneAudioAtATime() {
    const audios = document.querySelectorAll('audio');
    audios.forEach(a => a.addEventListener('play', () => {
      audios.forEach(b => { if (b !== a) b.pause(); });
    }));
  }

  function smoothScrollAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  function updateYear(ids = ['year', 'year-footer']) {
    const y = String(new Date().getFullYear());
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = y; });
  }

  function initMailtoOccasion(footerHost) {
    const occasion = document.body.dataset.occasion;
    const btn = footerHost?.querySelector('#contact-btn');
    if (!btn || !occasion) return;
    try {
      const url = new URL(btn.href);
      const subject = url.searchParams.get('subject') || 'Music Enquiry - Website';
      // Append occasion if not already present
      if (!subject.toLowerCase().includes(occasion.toLowerCase())) {
        url.searchParams.set('subject', `${subject} (${occasion})`);
        btn.href = url.toString();
      }
    } catch { /* noop for malformed mailto on some browsers */ }
  }

  function initCarousel(footerHost) {
    const root = footerHost?.querySelector('.t-carousel');
    if (!root) return;
    const track = root.querySelector('.t-track');
    const slides = Array.from(root.querySelectorAll('.t-slide'));
    const prev = root.querySelector('.t-prev');
    const next = root.querySelector('.t-next');
    const dotsWrap = root.querySelector('.t-dots');

    if (slides.length <= 1) {
      root.querySelector('.t-controls')?.remove();
      return; // nothing to rotate
    }

    let index = Math.max(slides.findIndex(s => s.classList.contains('is-active')), 0);
    const autoplayMs = parseInt(root.dataset.autoplay || '0', 10);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = null;
    let paused = false;

    // Create dots
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 't-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      dot.setAttribute('role', 'tab');
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    function update() {
      slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
      dotsWrap.querySelectorAll('.t-dot').forEach((d, i) => {
        d.classList.toggle('is-active', i === index);
        d.setAttribute('aria-selected', i === index ? 'true' : 'false');
        d.setAttribute('tabindex', i === index ? '0' : '-1');
      });
    }

    function goTo(i) { index = (i + slides.length) % slides.length; update(); restart(); }
    function nextSlide() { goTo(index + 1); }
    function prevSlide() { goTo(index - 1); }

    prev?.addEventListener('click', prevSlide);
    next?.addEventListener('click', nextSlide);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    });

    function restart() {
      if (timer) clearInterval(timer);
      if (!paused && autoplayMs > 0 && !reduceMotion) {
        timer = setInterval(nextSlide, autoplayMs);
      }
    }

    // Pause on hover/focus
    root.addEventListener('mouseenter', () => { paused = true; restart(); });
    root.addEventListener('mouseleave', () => { paused = false; restart(); });
    root.addEventListener('focusin', () => { paused = true; restart(); });
    root.addEventListener('focusout', () => { paused = false; restart(); });

    update();
    restart();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await injectPartial('site-header', 'partials/header.html');
    const footerHost = await injectPartial('site-footer', 'partials/footer.html');

    smoothScrollAnchors();
    onlyOneAudioAtATime();
    updateYear();

    if (footerHost) {
      initMailtoOccasion(footerHost);
      initCarousel(footerHost);
    }
  });
})();
