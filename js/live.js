/**
 * Datos en vivo: lee data/live.json (lo sube el bot de Discord) y llena el
 * estado del hero, los contadores, negocios, staff, bandas, el ticker y Kick.
 */
(function () {
  const cfg = window.ICONICO;
  const $ = (id) => document.getElementById(id);
  const KIND = { restaurante: '🍽️', tienda: '🛒', taller: '🔧' };
  const WHERE = { ciudad: 'En la ciudad', voz: 'En Discord', off: 'Desconectado' };
  let kickShown = false;

  function ago(iso) {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!Number.isFinite(min)) return '';
    if (min < 1) return 'hace instantes';
    if (min < 60) return `hace ${min} min`;
    return `hace ${Math.round(min / 60)} h`;
  }

  /** Cuenta animada hasta el número. */
  function countTo(el, value) {
    const target = Number(value) || 0;
    const from = Number(el.dataset.v) || 0;
    el.dataset.v = target;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || from === target) {
      el.textContent = target.toLocaleString('es-AR');
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 1200);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = Math.round(from + (target - from) * eased).toLocaleString('es-AR');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function hero(d, stale) {
    const el = $('liveHero');
    const s = d.server || {};
    const on = s.online && !stale;
    $('liveDot').className = `dot ${on ? 'on' : ''}`;
    el.innerHTML = on
      ? `<span class="dot on"></span><span><b>${s.players}</b>${s.max ? ` / ${s.max}` : ''} ciudadanos en la ciudad ahora</span>`
      : `<span class="dot down"></span><span>${stale ? 'Sin datos recientes de la ciudad' : 'La ciudad está cerrada en este momento'}</span>`;
  }

  function negocios(n) {
    const list = $('negocios');
    const items = (n?.items || []).slice().sort((a, b) => b.open - a.open || a.label.localeCompare(b.label));
    const open = items.filter((i) => i.open).length;
    $('negociosHint').textContent = items.length ? `${open} de ${items.length} abiertos` : '';
    if (!items.length) {
      list.innerHTML = '<li class="empty">Todavía no hay negocios registrados.</li>';
      return open;
    }
    list.innerHTML = items.map((i) => `
      <li class="${i.open ? 'open' : ''}">
        <span class="b-ico">${KIND[i.kind] || '🏪'}</span>
        <span><span class="b-name">${App.esc(i.label)}</span>
        <span class="b-state">${i.open ? `● Abierto · ${i.count} en servicio` : 'Cerrado'}</span></span>
      </li>`).join('');
    return open;
  }

  function staff(list) {
    const ul = $('staff');
    if (!list?.length) {
      ul.innerHTML = '<li class="empty">El equipo aparece acá cuando el bot publica los datos.</li>';
      return 0;
    }
    ul.innerHTML = list.map((s) => `
      <li class="${s.status}">
        <span class="avatar"><img src="${App.esc(s.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer"><i></i></span>
        <span><span class="s-name">${App.esc(s.name)}</span><span class="s-rank" style="${s.color ? `color:${App.esc(s.color)}` : ''}">${App.esc(s.rank)}</span></span>
        <span class="s-where">${WHERE[s.status] || ''}</span>
      </li>`).join('');
    return list.filter((s) => s.status !== 'off').length;
  }

  function bandas(list) {
    const panel = $('bandasPanel');
    if (!list?.length) { panel.hidden = true; return; }
    panel.hidden = false;
    $('bandas').innerHTML = list.map((g) => {
      const color = /^#?[0-9a-f]{6}$/i.test(g.color || '') ? `#${g.color.replace('#', '')}` : '';
      return `<li style="${color ? `--gc:${color}` : ''}">${App.esc(g.label)}<small>${g.members} miembros</small></li>`;
    }).join('');
  }

  function ticker(d, openCount, staffCount) {
    const items = [];
    const s = d.server || {};
    if (s.online) items.push(`🟢 <b>${s.players}</b> ciudadanos en la calle`);
    (d.negocios?.items || []).filter((i) => i.open).forEach((i) => items.push(`${KIND[i.kind] || '🏪'} <b>${App.esc(i.label)}</b> está abierto`));
    if (staffCount) items.push(`🛡️ <b>${staffCount}</b> del staff activos`);
    if (d.kick?.live) items.push(`🔴 <b>${App.esc(cfg.kickChannel)}</b> está en vivo en Kick`);
    if (d.discord?.members) items.push(`💎 <b>${Number(d.discord.members).toLocaleString('es-AR')}</b> en la comunidad`);
    if (!openCount) items.push('🍔 Los negocios abren cuando sus empleados entran en servicio');
    items.push('📜 Leé la normativa antes de entrar', '🛒 Puntos de bonificación en la tienda oficial');
    const html = items.map((t) => `<span>${t}</span>`).join('');
    $('ticker').innerHTML = html + html; // duplicado para que el loop no tenga corte
  }

  function kick(k) {
    const box = $('kickLive');
    const card = document.querySelector('.social.kick');
    const live = Boolean(k?.live);
    card.classList.toggle('is-live', live);
    $('kickStatus').textContent = live ? `🔴 En vivo${k.viewers ? ` · ${k.viewers} viendo` : ''}` : `kick.com/${cfg.kickChannel}`;
    box.hidden = !live;
    if (!live) { $('kickFrame').innerHTML = ''; kickShown = false; return; }
    $('kickTitle').textContent = k.title || `${cfg.kickChannel} está transmitiendo`;
    $('kickViewers').textContent = k.viewers ? `${k.viewers} espectadores` : '';
    if (!kickShown) {
      $('kickFrame').innerHTML = `<iframe src="https://player.kick.com/${encodeURIComponent(cfg.kickChannel)}?muted=true&autoplay=true" allowfullscreen loading="lazy" title="Directo de Kick"></iframe>`;
      kickShown = true;
    }
  }

  function render(d) {
    const stale = !d.updatedAt || Date.now() - new Date(d.updatedAt).getTime() > cfg.live.staleMin * 60000;
    hero(d, stale);
    const openCount = negocios(d.negocios);
    const staffCount = staff(d.staff);
    bandas(d.bandas);
    countTo($('statPlayers'), d.server?.online ? d.server.players : 0);
    countTo($('statOpen'), openCount);
    countTo($('statStaff'), staffCount);
    countTo($('statDiscord'), d.discord?.members || 0);
    if (d.discord?.members) $('discordCount').textContent = `${Number(d.discord.members).toLocaleString('es-AR')} miembros te esperan`;
    ticker(d, openCount, staffCount);
    kick(d.kick);
    $('liveUpdated').textContent = stale
      ? 'La ciudad no reporta datos recientes. Volvé a mirar en un rato.'
      : `Datos reales de la ciudad · actualizado ${ago(d.updatedAt)}`;
  }

  async function load() {
    try {
      const res = await fetch(`${cfg.live.url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      render(await res.json());
    } catch {
      $('liveHero').innerHTML = '<span class="dot"></span><span>Rol serio en Los Santos</span>';
      $('liveUpdated').textContent = 'Los datos en vivo no están disponibles ahora.';
      ticker({}, 0, 0);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    setInterval(load, cfg.live.refreshSec * 1000);
  });
}());
