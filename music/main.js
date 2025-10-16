// Add the header
fetch('/music/header.html')
  .then(res => res.text())
  .then(html => document.getElementById('header').innerHTML = html);

// Add the footer and update the year
fetch('/music/footer.html')
  .then(res => res.text())
  .then(html => {
    document.getElementById('site-footer').innerHTML = html;

    // Now that the footer is in the DOM, update the year
    const el = document.getElementById("year-footer");
    if (el) el.textContent = String(new Date().getFullYear());
  });
