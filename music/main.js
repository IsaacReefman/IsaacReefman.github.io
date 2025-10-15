fetch(‘/music/header.html’)
  .then(res => res.text())
  .then(html => document.getElementById(‘header’).innerHtml = html);
  
fetch(‘/music/footer.html’)
  .then(res => res.text())
  .then(html => document.getElementById(‘site-footer’).innerHtml = html);

(function () {
  // ---- find base /music/ path regardless of site root or capitalization
  function getMusicBasePath(folderName = 'music') {
    const segments = window.location.pathname.split('/').filter(Boolean); // e.g., ['Repo','music','weddings']
    const idx = segments.findIndex(s => s.toLowerCase() === folderName.toLowerCase());
    if (idx >= 0) {
      const base = '/' + segments.slice(0, idx + 1).join('/') + '/'; // e.g., '/Repo/music/'
      return base;
    }
    // Fallbacks (works if you're at /music/ already or testing locally)
    if (window.location.pathname.toLowerCase().includes('/' + folderName.toLowerCase() + '/')) {
      const cut = window.location.pathname.toLowerCase().indexOf('/' + folderName.toLowerCase() + '/') + folderName.length + 2;
      return window.location.pathname.slice(0, cut);
    }
    return './'; // last resort
  }

  // ---- rewrite relative links within an injected fragment to be relative to /music/
  function normalizeLinksWithin(container, base) {
    if (!container) return;
    container.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      // Leave absolute, hash, mailto, tel, and root-absolute links alone
      if (
        href.startsWith('http://') || href.startsWith('https://') ||
        href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') ||
        href.startsWith('/')
      ) return;
      // Otherwise, make it relative to /music/
      a.setAttribute('href', base + href);
    });
  }

  async function injectFragment(placeholderId, fileName) {
    const host = document.getElementById(placeholderId);
    if (!host) return null;
    const base = getMusicBasePath('music');
    const url = base + fileName;

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${fileName} -> HTTP ${res.status}`);
      const html = await res.text();
      host.innerHTML = html;
      host.removeAttribute('aria-hidden');
      normalizeLinksWithin(host, base);
      return host;
    } catch (err) {
      console.warn(`Failed to inject ${fileName} from ${url}`, err);
      return null;
    }
  }

  // ---- optional: append page context (data-occasion) to footer mailto subject
  function addOccasionToMailtoSubject(footerHost) {
    const occasion = document.body?.dataset?.occasion;
    if (!occasion) return;
    const link = footerHost?.querySelector('a[href^="mailto:"]');
    if (!link) return;
    try {
      // Construct a URL-like parser for the mailto (works in modern browsers)
      const mailto = new URL(link.href);
      const subject = mailto.searchParams.get('subject') || 'Music Enquiry - Website';
      if (!subject.toLowerCase().includes(occasion.toLowerCase())) {
        mailto.searchParams.set('subject', `${subject} (${occasion})`);
        link.href = mailto.toString();
      }
    } catch {
      // If the browser can't parse mailto, leave as-is
    }
  }

  // ---- quality-of-life: only one audio at a time, smooth scroll, footer year
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
  function stampYear(ids = ['year', 'year-footer']) {
    const y = String(new Date().getFullYear());
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = y; });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await injectFragment('header', 'header.html');
    const footerHost = await injectFragment('site-footer', 'footer.html');

    if (footerHost) addOccasionToMailtoSubject(footerHost);

    onlyOneAudioAtATime();
    smoothScrollAnchors();
    stampYear();
  });
})();
