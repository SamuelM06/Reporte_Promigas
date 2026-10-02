// ============================================================================
// SERVIDOR HTTP de producción: envuelve la app Astro SSR (dist/server/entry.mjs)
// y añade compresión gzip/brotli a las respuestas (estáticos, HTML y API).
//   Uso: node scripts/serve.mjs   (PORT default 4321)
//
// APAGADO GRACEFUL
// ----------------------------------------------------------------------------
// Este servidor (no Astro) es el que atiende las peticiones: por eso el
// drenaje se registra aquí. Sin esto, un SIGTERM de Coolify mataba el proceso
// con las peticiones en vuelo a medias.
//
// Secuencia al recibir SIGTERM/SIGINT (ver src/lib/shutdown.ts):
//   1. server.close()        -> deja de aceptar conexiones nuevas.
//   2. closeIdleConnections()-> suelta las keep-alive que no están en uso.
//   3. Las peticiones en vuelo terminan solas.
//   4. Pasado SHUTDOWN_GRACE_MS, closeAllConnections() corta las que se colgaron.
//   5. El coordinador cierra el pool de PostgreSQL y sale.
// ============================================================================
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

import { createServer } from 'node:http';
import { crearProxyRespuesta } from './compresion.mjs';
import { crearDrenaje } from './drenaje.mjs';

const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '0.0.0.0';
const GRACIA_MS = Number(process.env.SHUTDOWN_GRACE_MS || 10_000);

let server = null;

// Contrato con src/lib/shutdown.ts. Se publica por globalThis (no por import)
// porque shutdown.ts se compila dentro del bundle de Astro y este archivo es JS
// plano que corre por fuera. Se registra ANTES de importar la app para que,
// incluso si el arranque falla, quede un servidor al que drenar.
globalThis.__xumaApagadoHTTP = async () => {
  if (!server) return;
  const { drenar } = crearDrenaje(server, GRACIA_MS, (m) => console.warn(`[serve.mjs] ${m}`));
  const r = await drenar();
  console.log(`[serve.mjs] conexiones HTTP drenadas en ${r.ms}ms${r.cortadas ? ' (con corte forzado)' : ''}.`);
};

// Import dinámico: es imprescindible fijar ASTRO_NODE_AUTOSTART ANTES de
// importar la app SSR, para que Astro NO arranque su propio listener.
const { handler } = await import('../dist/server/entry.mjs');

server = createServer((req, res) => {
  handler(req, crearProxyRespuesta(req, res));
});

server.listen(PORT, HOST, () => {
  console.log(`[serve.mjs] SSR + compresión (gzip/brotli) escuchando en http://${HOST}:${PORT}`);

  // Calentamiento automático inicial de rutas y consultas en segundo plano
  setTimeout(async () => {
    try {
      const base = `http://127.0.0.1:${PORT}`;
      await Promise.allSettled([
        fetch(`${base}/`).then((r) => r.text()),
        fetch(`${base}/dashboard`).then((r) => r.text()),
        fetch(`${base}/por-gasera`).then((r) => r.text()),
        fetch(`${base}/detalle`).then((r) => r.text()),
        fetch(`${base}/api/dashboard-mensual`).then((r) => r.text()),
      ]);
      console.log('[serve.mjs] 🔥 Rutas y datos precalentados en RAM: respuestas instantáneas (<20ms)');
    } catch {
      // Silencioso en arranque
    }
  }, 100);
});
