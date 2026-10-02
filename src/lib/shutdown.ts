// ============================================================================
// COORDINADOR DE APAGADO
// ----------------------------------------------------------------------------
// Por qué existe: el pool de PostgreSQL y el servidor HTTP son dos recursos
// con vidas distintas, y el apagado tiene que draining los DOS en orden.
//
// Antes, `db.ts` se registraba directamente para SIGINT/SIGTERM y hacía
// `process.exit(0)` en cuanto `pool.end()` resolvía. Como el servidor HTTP de
// producción es el de `scripts/serve.mjs` (Astro corre con
// ASTRO_NODE_AUTOSTART=disabled y solo aporta un `handler`), ese `exit`
// cortaba las peticiones en vuelo: en un rolling restart de Coolify el
// usuario veía errores en las pantallas que ya estaban cargando.
//
// Ahora hay un único punto de decisión:
//   1. Si alguien registró un orquestador HTTP (`__xumaApagadoHTTP`, lo
//      registra `scripts/serve.mjs`), se le deja terminar de drenar.
//   2. Luego se cierra el pool, para no dejar backends 'idle' en la BD
//      compartida (max_connections = 50 en un servidor que ya está al límite).
//   3. Solo entonces se sale.
//
// `globalThis` como almacén porque en desarrollo Vite reevalúa este módulo en
// cada recarga en caliente: sin este candado se acumularía un listener por
// recarga y `process.once` ya no aguantaría más de una señal.
// ============================================================================

type CierreDB = () => Promise<void>;
type ApagadoHTTP = () => Promise<void>;

interface EstadoApagado {
  __xumaCierreDB?: CierreDB;
  __xumaApagadoHTTP?: ApagadoHTTP;
  __xumaSenales?: boolean;
  __xumaApagando?: boolean;
}

const g = globalThis as typeof globalThis & EstadoApagado;

/** `db.ts` publica aquí cómo cerrar el pool. */
export function registrarCierreDB(fn: CierreDB): void {
  g.__xumaCierreDB = fn;
}

/**
 * `scripts/serve.mjs` publica aquí cómo drenar el servidor HTTP.
 * Se registra desde fuera del bundle (JS plano), por eso el contrato vive en
 * `globalThis.__xumaApagadoHTTP` y no en un import de este módulo.
 */
export function registrarApagadoHTTP(fn: ApagadoHTTP): void {
  g.__xumaApagadoHTTP = fn;
}

/** true mientras se apaga: el middleware puede negarse a abrir consultas nuevas. */
export function hayApagando(): boolean {
  return g.__xumaApagando === true;
}

export function instalarSenales(): void {
  if (g.__xumaSenales) return;
  g.__xumaSenales = true;
  for (const senal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(senal, () => {
      void apagar(senal);
    });
  }
}

export async function apagar(senal: string): Promise<void> {
  // Doble SIGTERM (Coolify manda uno y Docker otro tras el timeout) no debe
  // arrancar un segundo drenaje sobre el mismo pool.
  if (g.__xumaApagando) return;
  g.__xumaApagando = true;
  console.log(`[apagado] ${senal} recibido: cerrando el servidor y el pool...`);
  try {
    if (g.__xumaApagadoHTTP) await g.__xumaApagadoHTTP();
    if (g.__xumaCierreDB) await g.__xumaCierreDB();
  } catch (err) {
    // Un fallo al apagar no puede dejar el proceso colgado para siempre.
    console.error('[apagado] error durante el cierre:', err instanceof Error ? err.message : err);
  }
  console.log('[apagado] listo.');
  process.exit(0);
}
