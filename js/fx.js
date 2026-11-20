/**
 * Efectos visuales: polvo de diamante, apariciones al hacer scroll, brillo que
 * sigue al mouse, inclinación 3D de los paquetes y la explosión de diamantes.
 * Todo se apaga solo si el usuario pidió menos movimiento.
 */
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Polvo de diamante: partículas que titilan y suben despacio. */
  function dust() {
    const canvas = document.getElementById('dust');
    if (!canvas || reduced) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let parts = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const n = Math.min(140, Math.floor((window.innerWidth * window.innerHeight) / 11000));
      parts = Array.from({ length: n }, () => spawn(true));
    }

    function spawn(anywhere) {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 10,
        r: (Math.random() * 1.4 + 0.3) * dpr,
        vy: (Math.random() * 0.18 + 0.04) * dpr,
        vx: (Math.random() - 0.5) * 0.08 * dpr,
        t: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.75 ? 205 : 188,
      };
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        p.y -= p.vy;
        p.x += p.vx;
        p.t += 0.02;
        if (p.y < -10) parts[i] = spawn(false);
        const a = 0.25 + Math.abs(Math.sin(p.t)) * 0.65;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.r > 1.3 * dpr && a > 0.8) {
          ctx.fillStyle = `hsla(${p.hue}, 100%, 90%, ${a * 0.35})`;
          ctx.fillRect(p.x - p.r * 4, p.y - 0.5, p.r * 8, 1);
          ctx.fillRect(p.x - 0.5, p.y - p.r * 4, 1, p.r * 8);
        }
      }
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }

  /* Apariciones suaves al entrar en pantalla. Se puede llamar de nuevo para elementos nuevos. */
  let observer = null;
  function reveal(root = document) {
    const items = root.querySelectorAll('.reveal:not(.in)');
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    observer = observer || new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
        el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 6) * 70}ms`;
        el.classList.add('in');
        observer.unobserve(el);
      });
    }, { threshold: 0.12 });
    items.forEach((el) => observer.observe(el));
  }

  /* Brillo que sigue al mouse dentro de las tarjetas. */
  function glow() {
    const sel = '.step, .stat, .panel, .feature, .social, .pkg';
    document.querySelectorAll(sel).forEach((el) => el.classList.add('glow-card'));
    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest?.('.glow-card');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  /* Inclinación 3D de los paquetes de la tienda. */
  function tilt(el) {
    if (reduced || window.matchMedia('(hover: none)').matches) return;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }

  /* Explosión de diamantes desde un punto. */
  function burst(x, y, n = 18) {
    if (reduced) return;
    const icons = ['💎', '✦', '✧', '💠'];
    for (let i = 0; i < n; i += 1) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = icons[i % icons.length];
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 90 + Math.random() * 140;
      s.style.left = `${x - 11}px`;
      s.style.top = `${y - 11}px`;
      s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      s.style.setProperty('--rot', `${Math.random() * 360}deg`);
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  /* Easter egg: cinco clics al logo. */
  function logoEgg() {
    const logo = document.getElementById('heroLogo');
    if (!logo) return;
    let clicks = 0;
    let timer = null;
    logo.addEventListener('click', (e) => {
      clicks += 1;
      clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 1200);
      burst(e.clientX, e.clientY, 8);
      if (clicks >= 5) {
        clicks = 0;
        const r = logo.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 40);
        window.App?.toast('💎 Sos Íconico. Nos vemos en la ciudad.');
      }
    });
  }

  window.FX = { reveal, tilt, burst, glow };

  document.addEventListener('DOMContentLoaded', () => {
    dust();
    reveal();
    glow();
    logoEgg();
  });
}());
