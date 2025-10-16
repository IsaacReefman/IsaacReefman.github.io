fetch('/music/header.html')
  .then(res => res.text())
  .then(html => document.getElementById('header').innerHTML = html);
  
fetch('/music/footer.html')
  .then(res => res.text())
  .then(html => document.getElementById('site-footer').innerHTML = html);

const y = String(new Date().getFullYear());
ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = y; });
