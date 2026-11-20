/**
 * Configuración de la web de Íconico Roleplay.
 * Todo lo que cambia seguido (links, textos cortos, tienda) vive acá.
 */
window.ICONICO = {
  nombre: 'Íconico Roleplay',

  links: {
    discord: 'https://discord.gg/ph3Hf2vQ7',
    instagram: 'https://www.instagram.com/iconicoroleplay/',
    kick: 'https://kick.com/thepelusa',
    normas: 'https://iconico.gitbook.io/iconico-docs',
    tienda: 'https://iconico.tebex.store/',
  },

  // Canal de Kick que se muestra en vivo cuando está transmitiendo.
  kickChannel: 'thepelusa',

  // Datos en vivo que sube el bot de Discord (estado, negocios, staff, bandas).
  live: { url: 'data/live.json', refreshSec: 60, staleMin: 15 },

  // Tienda Tebex (Headless API). El Public Token es público: no es una clave secreta.
  tebex: {
    publicToken: '15b98-92a5964e48bf8d289f24b94ec8c7a346cb8294a0',
    // Si la API no responde, se muestran estos paquetes y "Comprar" abre la tienda de Tebex.
    fallback: [
      { name: '1.000 Puntos de bonificación', price: 10, currency: 'USD', points: 1000 },
      { name: '2.000 Puntos de bonificación', price: 18, currency: 'USD', points: 2000 },
      { name: '3.000 Puntos de bonificación', price: 25, currency: 'USD', points: 3000 },
      { name: '5.000 Puntos de bonificación', price: 40, currency: 'USD', points: 5000 },
      { name: '8.000 Puntos de bonificación', price: 60, currency: 'USD', points: 8000 },
      { name: '10.000 Puntos de bonificación', price: 70, currency: 'USD', points: 10000 },
    ],
  },
};
