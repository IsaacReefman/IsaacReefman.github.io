Promise.all([
  // Add the header
  fetch('/music/header.html')
    .then(res => res.ok ? res.text() : Promise.reject(`header.html HTTP ${res.status}`))
    .then(html => {
      const el = document.getElementById('header');
      if (el) el.innerHTML = html;
    })
    .catch(err => console.warn('Header inject failed:', err)),
  
  // Add the footer, update the year, then init the testimonial carousel
  fetch('/music/footer.html')
    .then(res => res.ok ? res.text() : Promise.reject(`footer.html HTTP ${res.status}`))
    .then(html => {
      const host = document.getElementById('site-footer');
      if (!host) return;
      host.innerHTML = html;
  
      // Update the year inside the injected footer
      const y = host.querySelector('#year-footer');
      if (y) y.textContent = String(new Date().getFullYear());
  
      // Initialize the footer carousel (works even if it's not present)
      initFooterCarousel(host);
    })
    .catch(err => console.warn('Footer inject failed:', err)),
]).then(() => {
  // Now that all the elements are added, make it visible
  document.getElementById('page-content').style.visibility = 'visible';

  // Now activate the play buttons
  document.querySelectorAll('.audio-preview').forEach(preview => {
    const button = preview.querySelector('.preview-toggle');
    const audio = preview.querySelector('audio');

    button.addEventListener('click', () => {
      if (audio.paused) {
        audio.play();
        button.textContent = '⏸';
      } else {
        audio.pause();
        button.textContent = '▶';
      }
    });

    audio.addEventListener('ended', () => {
      button.textContent = '▶';
    });
  });
});

/* ---------- Carousel initializer (no dependencies) ---------- */
function initFooterCarousel(footerHost) {
  const root = footerHost.querySelector('.t-carousel');
  if (!root) return;

  const track   = root.querySelector('.t-track');
  const slides  = Array.from(root.querySelectorAll('.t-slide'));
  const prevBtn = root.querySelector('.t-prev');
  const nextBtn = root.querySelector('.t-next');
  const dotsWrap= root.querySelector('.t-dots');

  if (!slides.length) return;

  // If only one slide: show it and remove controls
  if (slides.length === 1) {
    slides[0].classList.add('is-active');
    root.querySelector('.t-controls')?.remove();
    return;
  }

  // Start index from .is-active, else 0
  let index = Math.max(slides.findIndex(s => s.classList.contains('is-active')), 0);

  // Autoplay from data-autoplay (ms). Respect reduced motion.
  const autoplayMs   = parseInt(root.dataset.autoplay || '0', 10);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer  = null;
  let paused = false;

  // Build dots
  if (dotsWrap) {
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 't-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      dot.setAttribute('role', 'tab');
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });
  }

  function update() {
    slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
    if (dotsWrap) {
      dotsWrap.querySelectorAll('.t-dot').forEach((d, i) => {
        const active = i === index;
        d.classList.toggle('is-active', active);
        d.setAttribute('aria-selected', active ? 'true' : 'false');
        d.setAttribute('tabindex', active ? '0' : '-1');
      });
    }
    // Ensure track height adapts smoothly if your CSS positions slides absolutely
    if (track) {
      const activeSlide = slides[index];
      // Use offsetHeight to get rendered height
      track.style.minHeight = activeSlide ? activeSlide.offsetHeight + 'px' : '';
    }
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    update();
    restart();
  }
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  // Wire controls + keyboard
  prevBtn?.addEventListener('click', prev);
  nextBtn?.addEventListener('click', next);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'ArrowRight') next();
  });

  // Autoplay lifecycle
  function restart() {
    if (timer) clearInterval(timer);
    if (!paused && autoplayMs > 0 && !reduceMotion) {
      timer = setInterval(next, autoplayMs);
    }
  }
  root.addEventListener('mouseenter', () => { paused = true;  restart(); });
  root.addEventListener('mouseleave', () => { paused = false; restart(); });
  root.addEventListener('focusin',  () => { paused = true;  restart(); });
  root.addEventListener('focusout', () => { paused = false; restart(); });
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden || paused;
    restart();
  });

  update();
  restart();
}