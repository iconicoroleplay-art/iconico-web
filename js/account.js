/**
 * Cuenta del visitante: login con Discord (OAuth2 implicit, sin servidor) y la
 * cuenta de FiveM que vincula Tebex. Se muestra en la barra y se usa en la tienda.
 *
 * Discord devuelve un token en el #hash de la URL; con él se leen el perfil y si
 * es miembro del servidor. Solo se guarda en este navegador hasta que vence.
 */
(function () {
  const cfg = window.ICONICO;
  const dc = cfg.discord || {};
  const KEY = 'iconico_discord';
  const STATE = 'iconico_oauth_state';
  const SKIP = 'iconico_skip_discord';
  const API = 'https://discord.com/api/v10';
  const $ = (id) => document.getElementById(id);

  let session = null; // { token, exp, user: {id, username, avatar}, member: {nick} | null }
  let fivem = null;

  const ls = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin storage */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* sin storage */ } },
  };
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sin storage */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* sin storage */ } },
  };

  const cleanUrl = () => `${location.origin}${location.pathname}`;

  function avatarUrl(u, size = 64) {
    if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.webp?size=${size}`;
    let idx = 0;
    try { idx = Number((BigInt(u.id) >> 22n) % 6n); } catch { /* id raro */ }
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }

  function randomState() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function loginDiscord() {
    if (!dc.clientId) { App.toast('El login con Discord no está configurado.'); return; }
    const state = randomState();
    ss.set(STATE, state);
    const p = new URLSearchParams({
      client_id: dc.clientId,
      response_type: 'token',
      redirect_uri: cleanUrl(),
      scope: dc.scope || 'identify',
      state,
      prompt: 'none',
    });
    location.href = `https://discord.com/oauth2/authorize?${p}`;
  }

  function logout() {
    session = null;
    ls.del(KEY);
    render();
    App.toast('Cerraste sesión de Discord en esta web.');
  }

  async function discordGet(path, tokenValue) {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${tokenValue}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Discord HTTP ${res.status}`);
    return res.json();
  }

  /** Vuelta de Discord: lee el token del #hash, valida el state y arma la sesión. */
  async function fromRedirect() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (!h.has('access_token') && !h.has('error')) return false;
    const expected = ss.get(STATE);
    ss.del(STATE);
    const back = window.Store?.hasPending() ? '#tienda' : '';
    history.replaceState(null, '', `${cleanUrl()}${location.search}${back}`);
    if (h.has('error')) {
      App.toast(h.get('error') === 'access_denied' ? 'Cancelaste el inicio de sesión con Discord.' : 'Discord no pudo iniciar sesión. Probá de nuevo.', 4500);
      return true;
    }
    if (!expected || h.get('state') !== expected) {
      App.toast('El inicio de sesión no es válido. Probá de nuevo.', 4500);
      return true;
    }
    const tokenValue = h.get('access_token');
    try {
      const u = await discordGet('/users/@me', tokenValue);
      const member = dc.guildId ? await discordGet(`/users/@me/guilds/${dc.guildId}/member`, tokenValue).catch(() => null) : null;
      session = {
        token: tokenValue,
        exp: Date.now() + (Number(h.get('expires_in')) || 604800) * 1000,
        user: { id: u.id, username: u.global_name || u.username, avatar: u.avatar },
        member: member ? { nick: member.nick || null } : null,
      };
      ls.set(KEY, session);
      App.toast(`💎 Hola, ${session.member?.nick || session.user.username}. Discord vinculado.`);
    } catch {
      App.toast('No pudimos leer tu perfil de Discord. Probá de nuevo.', 4500);
    }
    return true;
  }

  function restore() {
    const s = ls.get(KEY);
    if (s?.user?.id && s.exp > Date.now()) session = s;
    else ls.del(KEY);
  }

  /* ───── Interfaz ───── */
  const check = '<span class="ok" aria-hidden="true">✓</span>';

  function render() {
    const btn = $('accountBtn');
    const menu = $('accountMenu');
    const u = session?.user;
    const name = session?.member?.nick || u?.username;
    btn.innerHTML = u
      ? `<img src="${App.esc(avatarUrl(u, 64))}" alt="" width="28" height="28" referrerpolicy="no-referrer"><span>${App.esc(name)}</span>`
      : '<span class="acc-ico" aria-hidden="true">👤</span><span>Ingresar</span>';
    btn.classList.toggle('in', Boolean(u));

    const memberLine = !u ? ''
      : session.member ? `<p class="acc-member">${check} Miembro de Íconico</p>`
        : `<p class="acc-member warn">No estás en el Discord · <a href="${App.esc(cfg.links.discord)}" target="_blank" rel="noopener">Unirme</a></p>`;
    menu.innerHTML = `
      ${u ? `<div class="acc-head"><img src="${App.esc(avatarUrl(u, 128))}" alt="" width="44" height="44" referrerpolicy="no-referrer"><div><b>${App.esc(name)}</b>${memberLine}</div></div>`
    : '<p class="acc-intro">Vinculá tus cuentas para comprar más rápido y que sepamos quién sos en la ciudad.</p>'}
      <ul class="acc-links">
        ${linkRow('discord', 'Discord', u ? App.esc(u.username) : null)}
        ${linkRow('fivem', 'FiveM', fivem ? App.esc(fivem) : null)}
      </ul>
      ${u ? '<button type="button" class="acc-out" data-acc="logout">Cerrar sesión</button>' : ''}`;
    renderLinkModal();
  }

  function linkRow(kind, label, value) {
    const ico = kind === 'discord' ? '<svg viewBox="0 0 24 24"><path d="M19.6 5.3A16.6 16.6 0 0 0 15.5 4l-.5 1a15.3 15.3 0 0 0-6 0L8.5 4a16.6 16.6 0 0 0-4.1 1.3C1.8 9.2 1.1 13 1.4 16.7a16.7 16.7 0 0 0 5 2.5l1.1-1.7a10.8 10.8 0 0 1-1.7-.8l.4-.3a11.9 11.9 0 0 0 11.6 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.3-.7-8-2.9-11.4ZM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>'
      : '<b class="fivem-ico">5M</b>';
    return `<li class="acc-row ${kind}">
      <span class="acc-badge">${ico}</span>
      <span class="acc-txt"><b>${label}</b><small>${value ? `${check} ${value}` : 'Sin vincular'}</small></span>
      ${value ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-acc="${kind}">Vincular</button>`}
    </li>`;
  }

  /** Paso a paso antes de comprar: 1) Discord 2) FiveM. */
  function renderLinkModal() {
    const box = $('linkSteps');
    if (!box) return;
    const u = session?.user;
    const skipped = ss.get(SKIP) === '1';
    const step1 = u
      ? `<li class="done"><span class="n">${check}</span><div><b>Discord vinculado</b><small>${App.esc(u.username)}</small></div></li>`
      : `<li class="${skipped ? 'skip' : 'now'}"><span class="n">1</span><div><b>Vinculá tu Discord</b><small>Así tu compra queda a tu nombre y el staff te puede ayudar más rápido.</small></div>
          <button type="button" class="btn btn-sm btn-discord" data-acc="discord">Conectar Discord</button></li>`;
    const ready = u || skipped;
    const step2 = fivem
      ? `<li class="done"><span class="n">${check}</span><div><b>FiveM vinculado</b><small>${App.esc(fivem)}</small></div></li>`
      : `<li class="${ready ? 'now' : 'wait'}"><span class="n">2</span><div><b>Iniciá sesión con FiveM</b><small>Tebex te pide tu cuenta de FiveM (Cfx.re) para entregarte los puntos.</small></div>
          <button type="button" class="btn btn-sm btn-glow" data-acc="fivem" ${ready ? '' : 'disabled'}>Vincular FiveM</button></li>`;
    box.innerHTML = step1 + step2;
    $('linkSkip').hidden = Boolean(u) || skipped;
  }

  function openLink() {
    render();
    const m = $('linkModal');
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
  }
  function closeLink() {
    const m = $('linkModal');
    m.classList.remove('open');
    m.setAttribute('aria-hidden', 'true');
  }

  function toggleMenu(open) {
    const menu = $('accountMenu');
    const btn = $('accountBtn');
    const next = open ?? !menu.classList.contains('open');
    menu.classList.toggle('open', next);
    btn.setAttribute('aria-expanded', String(next));
  }

  function onAction(action) {
    if (action === 'discord') loginDiscord();
    else if (action === 'fivem') { closeLink(); toggleMenu(false); window.Store?.linkFiveM(); }
    else if (action === 'logout') logout();
  }

  window.Account = {
    user: () => session?.user || null,
    /** true si hay que mostrar el paso a paso antes de comprar. */
    needsLinking: () => !session?.user && ss.get(SKIP) !== '1',
    openLink,
  };

  document.addEventListener('DOMContentLoaded', async () => {
    restore();
    render();
    $('accountBtn').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-acc]');
      if (a) { onAction(a.dataset.acc); return; }
      if (!e.target.closest('#accountMenu')) toggleMenu(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleMenu(false); closeLink(); } });
    $('linkModal').addEventListener('click', (e) => { if (e.target.id === 'linkModal' || e.target.closest('[data-link-close]')) closeLink(); });
    $('linkSkip').addEventListener('click', () => { ss.set(SKIP, '1'); renderLinkModal(); });
    document.addEventListener('iconico:basket', (e) => {
      const next = e.detail?.username || null;
      if (next !== fivem) { fivem = next; render(); }
    });

    const returned = await fromRedirect();
    render();
    // Volvió de Discord en medio de una compra: seguir con el paso 2.
    if (returned && session?.user && window.Store?.hasPending() && !fivem) openLink();
  });
}());
