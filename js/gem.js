/**
 * Diamante de talla brillante en SVG: corona, mesa y pabellón con facetas
 * sombreadas según una luz desde arriba a la izquierda, destellos de "fuego"
 * y un brillo que cruza la piedra. Los paquetes más grandes brillan más.
 *
 *   Gem.svg(nivel, total) → string SVG
 */
(function () {
  let uid = 0;

  const CULET = [60, 112];
  const GIRDLE = Array.from({ length: 9 }, (_, i) => [6 + i * 13.5, 46 + 2.2 * Math.sin((Math.PI * i) / 8)]);
  const TABLE = Array.from({ length: 5 }, (_, j) => [34 + j * 13, 25]);
  const TABLE_BACK = [[43, 15], [77, 15]];

  // Colores de la piedra: de lo más profundo a la luz pura.
  const STOPS = [
    [0.0, [4, 18, 66]],
    [0.3, [14, 66, 190]],
    [0.55, [46, 140, 255]],
    [0.78, [140, 212, 255]],
    [1.0, [240, 251, 255]],
  ];
  const FIRE = ['#c3b2ff', '#8ff6ff', '#ffd9f2', '#b5ffe4'];

  const pt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

  /** Ruido estable por faceta (siempre el mismo dibujo para el mismo índice). */
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function color(t) {
    const k = Math.max(0, Math.min(1, t));
    for (let i = 1; i < STOPS.length; i += 1) {
      const [p1, c1] = STOPS[i];
      const [p0, c0] = STOPS[i - 1];
      if (k <= p1) {
        const f = (k - p0) / (p1 - p0);
        const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * f));
        return `rgb(${c.join(',')})`;
      }
    }
    return 'rgb(240,251,255)';
  }

  /** Facetas: [puntos, zona] — la zona define cuánta luz recibe de base. */
  function facets() {
    const f = [];
    const G = GIRDLE;
    const T = TABLE;
    f.push([[G[0], TABLE_BACK[0], T[0]], 'back']);
    f.push([[G[8], TABLE_BACK[1], T[4]], 'back']);
    for (let j = 0; j < 4; j += 1) {
      f.push([[T[j], G[2 * j], G[2 * j + 1]], 'crown']);
      f.push([[T[j], G[2 * j + 1], T[j + 1]], 'star']);
      f.push([[T[j + 1], G[2 * j + 1], G[2 * j + 2]], 'crown']);
    }
    for (let i = 0; i < 8; i += 1) {
      const a = G[i];
      const b = G[i + 1];
      const m = lerp(mid(a, b), CULET, 0.42);
      f.push([[a, b, m], 'lower']);
      f.push([[a, m, CULET], 'pavilion']);
      f.push([[b, CULET, m], 'pavilion']);
    }
    return f;
  }
  const FACETS = facets();
  const BASE = { back: 0.5, crown: 0.62, star: 0.74, lower: 0.42, pavilion: 0.3 };

  function shade(points, zone, i) {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    // Luz arriba a la izquierda; las facetas de abajo a la derecha quedan en sombra.
    const light = ((60 - cx) / 60) * 0.18 + ((60 - cy) / 60) * 0.12;
    const zig = (i % 2 ? 0.16 : -0.12) + (hash(i) - 0.5) * 0.34;
    return BASE[zone] + light + zig;
  }

  function sparkle(x, y, size, delay) {
    const s = size;
    return `<path class="gem-spark" style="animation-delay:${delay}s" d="M${x} ${y - s}C${x + s * 0.12} ${y - s * 0.12} ${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y}C${x + s * 0.12} ${y + s * 0.12} ${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s}C${x - s * 0.12} ${y + s * 0.12} ${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y}C${x - s * 0.12} ${y - s * 0.12} ${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z"/>`;
  }

  /**
   * @param {number} level  0 = paquete más chico
   * @param {number} total  cantidad de paquetes (para escalar el brillo)
   */
  function svg(level = 0, total = 6) {
    uid += 1;
    const id = `gem${uid}`;
    const power = total > 1 ? level / (total - 1) : 1; // 0..1
    const outline = [GIRDLE[0], TABLE_BACK[0], TABLE_BACK[1], GIRDLE[8], CULET];
    const outlinePts = outline.map(pt).join(' ');

    const polys = FACETS.map(([points, zone], i) => {
      const t = shade(points, zone, i) + power * 0.08;
      const fire = hash(i + 91) < 0.07 + power * 0.06;
      const fill = fire ? FIRE[i % FIRE.length] : color(t);
      return `<polygon points="${points.map(pt).join(' ')}" fill="${fill}"${fire ? ' opacity=".9"' : ''}/>`;
    }).join('');

    const table = [TABLE[0], TABLE_BACK[0], TABLE_BACK[1], TABLE[4], TABLE[3], TABLE[2], TABLE[1]].map(pt).join(' ');
    const sparkPts = [[TABLE[1][0], TABLE[1][1]], [GIRDLE[6][0], GIRDLE[6][1]], [TABLE_BACK[0][0] + 6, 16], [GIRDLE[2][0], GIRDLE[2][1] + 10], [TABLE[3][0] + 2, 24], [74, 70]];
    const sparks = sparkPts.slice(0, 2 + Math.round(power * 4))
      .map(([x, y], i) => sparkle(x, y, 6 + (i % 2 ? 2 : 4) + power * 3, (i * 0.9 + level * 0.37) % 4)).join('');

    return `<svg class="gem-svg" viewBox="-4 0 128 120" aria-hidden="true" style="--power:${power.toFixed(2)}">
  <defs>
    <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4fcff"/><stop offset=".55" stop-color="#9fd8ff"/><stop offset="1" stop-color="#4aa6ff"/>
    </linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${id}h" cx=".5" cy=".55" r=".5">
      <stop offset="0" stop-color="#58b8ff" stop-opacity="${(0.35 + power * 0.35).toFixed(2)}"/><stop offset="1" stop-color="#58b8ff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}c"><polygon points="${outlinePts}"/></clipPath>
  </defs>
  <ellipse cx="60" cy="62" rx="${56 + power * 6}" ry="${52 + power * 6}" fill="url(#${id}h)"/>
  <g clip-path="url(#${id}c)">
    ${polys}
    <polygon points="${table}" fill="url(#${id}t)" opacity=".92"/>
    <g fill="none" stroke="rgba(225,246,255,.45)" stroke-width=".55" stroke-linejoin="round">
      ${FACETS.map(([points]) => `<polygon points="${points.map(pt).join(' ')}"/>`).join('')}
    </g>
    <rect class="gem-sheen" x="-30" y="0" width="34" height="120" fill="url(#${id}s)" transform="skewX(-18)"/>
  </g>
  <polygon points="${outlinePts}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.1" stroke-linejoin="round"/>
  <polyline points="${pt(GIRDLE[0])} ${GIRDLE.slice(1).map(pt).join(' ')}" fill="none" stroke="rgba(255,255,255,.7)" stroke-width=".9"/>
  <g fill="#fff">${sparks}</g>
</svg>`;
  }

  window.Gem = { svg };
}());
