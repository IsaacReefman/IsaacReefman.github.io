fetch('/music/header.html')
  .then(res => res.text())
  .then(html => document.getElementById('header').innerHTML = html);
  
fetch('/music/footer.html')
  .then(res => res.text())
  .then(html => document.getElementById('site-footer').innerHTML = html);