/**
 * Tienda con Tebex Headless API: los paquetes se leen de Tebex, el jugador vincula
 * Discord (opcional, recomendado) y FiveM, y paga en la ventana oficial de Tebex.
 * Si la API no responde, se muestran los paquetes de config y "Comprar" abre la tienda.
 *
 * Flujo: Discord → crear carrito (con el Discord adentro) → login FiveM (redirige
 * y vuelve) → agregar paquete → pagar. Tebex.js se carga recién al pagar.
 */
(function () {
  const cfg = window.ICONICO;
  const token = cfg.tebex.publicToken;
  const API = 'https://headless.tebex.io/api';
  const TEBEX_JS = 'https://js.tebex.io/v/1.js';
  const KEY = 'iconico_basket';
  const PENDING = 'iconico_pending_pkg';
  const $ = (id) => document.getElementById(id);

  let packages = [];
  let basket = null;
  let headless = false;

  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin storage */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* sin storage */ } },
  };

  async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.detail || body.title || `HTTP ${res.status}`), { status: res.status });
    return body.data ?? body;
  }

  function money(n, cur = 'USD') {
    try {
      return new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);
    } catch {
      return `$${Number(n).toFixed(2)}`;
    }
  }

  const pointsOf = (name) => Number(String(name).replace(/\./g, '').match(/\d+/)?.[0]) || 0;

  /** Avisa a la cuenta (account.js) cómo quedó el carrito: usuario de FiveM, etc. */
  function announce() {
    document.dispatchEvent(new CustomEvent('iconico:basket', { detail: basket }));
  }

  function renderPackages() {
    const wrap = $('packages');
    if (!packages.length) {
      wrap.innerHTML = '<p class="empty">No hay paquetes disponibles ahora.</p>';
      return;
    }
    const perK = packages.map((p) => (p.points ? p.price / (p.points / 1000) : Infinity));
    const best = perK.indexOf(Math.min(...perK));
    const base = perK[0];
    const inBasket = new Set((basket?.packages || []).map((p) => p.id));
    wrap.innerHTML = packages.map((p, i) => {
      const save = p.points && Number.isFinite(base) && perK[i] < base ? Math.round((1 - perK[i] / base) * 100) : 0;
      return `
      <article class="pkg reveal ${i === best && save ? 'best' : ''} ${inBasket.has(p.id) ? 'in-basket' : ''}" data-i="${i}">
        ${i === best && save ? '<span class="pkg-badge">MEJOR VALOR</span>' : save ? `<span class="pkg-badge">-${save}%</span>` : ''}
        <div class="gem">${window.Gem ? Gem.svg(i, packages.length) : ''}</div>
        <h3>${p.points ? p.points.toLocaleString('es-AR') : App.esc(p.name)}</h3>
        <p class="pkg-sub">${p.points ? 'Puntos de bonificación' : ''}</p>
        <div class="price">${money(p.price, p.currency)}</div>
        <div class="per">${p.points ? `${money(perK[i], p.currency)} cada 1.000 puntos` : '&nbsp;'}</div>
        <button type="button" class="btn btn-glow" data-buy="${i}">${inBasket.has(p.id) ? '✓ En el carrito' : 'Comprar'}</button>
      </article>`;
    }).join('');
    wrap.querySelectorAll('.pkg').forEach((el) => { window.FX?.tilt(el); el.classList.add('glow-card'); });
    window.FX?.reveal(wrap);
  }

  async function loadPackages() {
    if (token) {
      try {
        const cats = await api(`/accounts/${token}/categories?includePackages=1`);
        const list = cats.flatMap((c) => c.packages || []);
        if (list.length) {
          packages = list.map((p) => ({
            id: p.id, name: p.name, price: Number(p.total_price ?? p.base_price ?? 0), currency: p.currency || 'USD', points: pointsOf(p.name),
          })).sort((a, b) => a.price - b.price);
          headless = true;
        }
      } catch { /* se usa el respaldo */ }
    }
    if (!headless) packages = cfg.tebex.fallback.map((p, i) => ({ id: `f${i}`, ...p }));
    renderPackages();
  }

  /* ───── Carrito ───── */
  const cleanUrl = () => `${location.origin}${location.pathname}`;

  async function getBasket() {
    const ident = store.get(KEY);
    if (!ident) return null;
    try {
      return await api(`/accounts/${token}/baskets/${ident}`);
    } catch {
      store.del(KEY);
      return null;
    }
  }

  /** Crea el carrito; si hay Discord vinculado, va adentro para saber quién compró. */
  async function createBasket() {
    const user = window.Account?.user();
    const b = await api(`/accounts/${token}/baskets`, {
      method: 'POST',
      body: JSON.stringify({
        complete_url: `${cleanUrl()}?compra=ok#tienda`,
        cancel_url: `${cleanUrl()}?compra=cancelada#tienda`,
        complete_auto_redirect: true,
        ...(user ? { custom: { discord_id: user.id, discord_name: user.username } } : {}),
      }),
    });
    store.set(KEY, b.ident);
    return b;
  }

  async function ensureBasket() {
    basket = basket || (await getBasket()) || (await createBasket());
    return basket;
  }

  /** Manda al jugador a loguearse con FiveM; vuelve a la web con ?auth=1. */
  async function login(b) {
    const links = await api(`/accounts/${token}/baskets/${b.ident}/auth?returnUrl=${encodeURIComponent(`${cleanUrl()}?auth=1#tienda`)}`);
    const url = (Array.isArray(links) ? links : [links]).find((l) => l?.url)?.url;
    if (!url) throw new Error('Tebex no devolvió el link de inicio de sesión');
    App.toast('Te llevamos a iniciar sesión con FiveM…');
    setTimeout(() => { location.href = url; }, 600);
  }

  /** Vincular FiveM desde la cuenta o el paso 2 del modal. */
  async function linkFiveM() {
    if (!headless) { window.open(cfg.links.tienda, '_blank', 'noopener'); return; }
    try {
      await ensureBasket();
      if (basket.username) { announce(); App.toast(`FiveM ya vinculado: ${basket.username}`); return; }
      await login(basket);
    } catch (err) {
      App.toast(`No se pudo vincular FiveM: ${err.message}`, 5000);
    }
  }

  async function addPackage(pkg) {
    basket = await api(`/baskets/${basket.ident}/packages`, { method: 'POST', body: JSON.stringify({ package_id: pkg.id, quantity: 1 }) });
    renderPackages();
    renderBasket();
    const btn = $('basketBtn');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    App.toast(`💎 ${pkg.name} agregado al carrito`);
    App.drawer?.open();
  }

  async function buy(i, ev) {
    const pkg = packages[i];
    if (!pkg) return;
    if (!headless) { window.open(cfg.links.tienda, '_blank', 'noopener'); return; }
    // Sin cuentas vinculadas: primero el paso a paso (Discord → FiveM).
    if (!basket?.username && window.Account?.needsLinking()) {
      store.set(PENDING, String(pkg.id));
      window.Account.openLink();
      return;
    }
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      await ensureBasket();
      if (!basket.username) {
        store.set(PENDING, String(pkg.id));
        await login(basket);
        return;
      }
      if ((basket.packages || []).some((p) => p.id === pkg.id)) { App.drawer?.open(); return; }
      await addPackage(pkg);
      window.FX?.burst(ev.clientX, ev.clientY, 14);
    } catch (err) {
      App.toast(`No se pudo agregar: ${err.message}. Probá desde la tienda de Tebex.`, 5000);
    } finally {
      btn.disabled = false;
    }
  }

  async function removePackage(id) {
    try {
      basket = await api(`/baskets/${basket.ident}/packages/remove`, { method: 'POST', body: JSON.stringify({ package_id: id }) });
      renderPackages();
      renderBasket();
    } catch (err) {
      App.toast(`No se pudo quitar: ${err.message}`);
    }
  }

  function renderBasket() {
    const items = basket?.packages || [];
    const user = window.Account?.user();
    $('basketCount').textContent = items.length;
    $('drawerUser').innerHTML = basket?.username
      ? `Comprando como <b>${App.esc(basket.username)}</b>${user ? ` · Discord <b>${App.esc(user.username)}</b>` : ''}`
      : 'Al comprar vinculás tu Discord y tu cuenta de FiveM.';
    $('drawerItems').innerHTML = items.length
      ? items.map((p) => `<li><span>💎</span><b>${App.esc(p.name)}</b><button type="button" data-remove="${p.id}">Quitar</button></li>`).join('')
      : '<li class="empty">Tu carrito está vacío. Elegí un paquete en la tienda.</li>';
    $('drawerTotal').textContent = items.length ? money(basket.total_price, basket.currency) : '—';
    $('checkoutBtn').disabled = !items.length;
    announce();
  }

  /** Carga Tebex.js una sola vez, recién cuando hace falta. */
  let tebexLoading = null;
  function loadTebex() {
    if (window.Tebex?.checkout) return Promise.resolve(window.Tebex);
    tebexLoading = tebexLoading || new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TEBEX_JS;
      s.async = true;
      s.onload = () => resolve(window.Tebex);
      s.onerror = () => { tebexLoading = null; reject(new Error('no cargó Tebex.js')); };
      document.head.appendChild(s);
    });
    return tebexLoading;
  }

  async function checkout() {
    if (!basket?.packages?.length) return;
    const btn = $('checkoutBtn');
    btn.disabled = true;
    try {
      const Tebex = await loadTebex();
      Tebex.checkout.init({ ident: basket.ident, theme: 'dark', colors: [{ name: 'primary', color: '#3b9dff' }] });
      Tebex.checkout.on?.('payment:complete', done);
      Tebex.checkout.launch();
    } catch {
      if (basket.links?.checkout) location.href = basket.links.checkout;
      else App.toast('No se pudo abrir el pago. Probá de nuevo en un momento.', 5000);
    } finally {
      btn.disabled = false;
    }
  }

  function done() {
    store.del(KEY);
    basket = null;
    renderBasket();
    renderPackages();
    App.drawer?.close();
    window.FX?.burst(window.innerWidth / 2, window.innerHeight / 2, 50);
    App.toast('💎 ¡Gracias por tu compra! Revisá tu mail y canjeá con /canjear en la ciudad.', 7000);
  }

  /** Vuelta del login de FiveM o del pago. */
  async function resume() {
    const q = new URLSearchParams(location.search);
    if (q.has('compra')) {
      if (q.get('compra') === 'ok') done();
      else App.toast('Pago cancelado. Tu carrito sigue guardado.');
    }
    if (q.has('auth') || q.has('compra')) history.replaceState(null, '', `${cleanUrl()}#tienda`);
    if (!headless) return;
    basket = await getBasket();
    const pending = store.get(PENDING);
    if (q.has('auth') && basket?.username && pending) {
      store.del(PENDING);
      const pkg = packages.find((p) => String(p.id) === pending);
      if (pkg) await addPackage(pkg).catch((e) => App.toast(`No se pudo agregar: ${e.message}`));
    } else if (q.has('auth') && basket?.username) {
      App.toast(`✓ FiveM vinculado: ${basket.username}`);
    } else if (q.has('auth') && !basket?.username) {
      App.toast('No pudimos confirmar tu sesión de FiveM. Probá de nuevo.');
    }
    renderPackages();
    renderBasket();
  }

  window.Store = {
    linkFiveM,
    hasPending: () => Boolean(store.get(PENDING)),
    clearPending: () => store.del(PENDING),
    fivemUser: () => basket?.username || null,
  };

  document.addEventListener('DOMContentLoaded', async () => {
    $('packages').addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) buy(Number(b.dataset.buy), { currentTarget: b, clientX: e.clientX, clientY: e.clientY });
    });
    $('drawerItems').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remove]');
      if (b) removePackage(Number(b.dataset.remove));
    });
    $('checkoutBtn').addEventListener('click', checkout);
    renderBasket();
    await loadPackages();
    await resume().catch(() => {});
  });
}());
