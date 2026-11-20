/**
 * Arranque general: links desde config, menú, sección activa, toast y carrito.
 */
(function () {
  const cfg = window.ICONICO;

  function toast(msg, ms = 3200) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function wireLinks() {
    document.querySelectorAll('[data-link]').forEach((a) => {
      const url = cfg.links[a.dataset.link];
      if (url) a.href = url;
    });
  }

  function nav() {
    const bar = document.getElementById('nav');
    const links = document.getElementById('navLinks');
    const toggle = document.getElementById('navToggle');
    const setOpen = (open) => {
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!links.classList.contains('open')));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (!('IntersectionObserver' in window)) return;
    const anchors = [...links.querySelectorAll('a')];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        anchors.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    anchors.forEach((a) => {
      const sec = document.querySelector(a.getAttribute('href'));
      if (sec) io.observe(sec);
    });
  }

  function drawer() {
    const d = document.getElementById('drawer');
    const open = () => { d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); };
    const close = () => { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); };
    document.getElementById('basketBtn').addEventListener('click', open);
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return { open, close };
  }

  /** Escapa texto para meterlo en HTML. */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.App = { toast, esc, drawer: null };

  document.addEventListener('DOMContentLoaded', () => {
    wireLinks();
    nav();
    window.App.drawer = drawer();
  });
}());
