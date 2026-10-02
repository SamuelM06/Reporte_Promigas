// Capa de lectura de variables de entorno.
// Se protege: nada de esto llega al navegador (solo módulos del servidor importan esto).

type EnvBag = Record<string, string | undefined>;

function bag(): EnvBag {
  const meta = (import.meta as unknown as { env?: EnvBag }).env ?? {};
  return { ...meta, ...process.env };
}

function env(key: string, fallback = ''): string {
  const v = bag()[key];
  return v === undefined || v === '' ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = Number(env(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

// ----------------------------------------------------------------------------
// HTTPS: decide si se manda HSTS.
// ----------------------------------------------------------------------------
// Modos (`APP_HTTPS`):
//   'true'  → siempre HTTPS (útil detrás de un proxy que termina TLS).
//   'false' → siempre HTTP  (solo para desarrollo local en claro).
//   'auto'  → defecto. Usa el esquema de `APP_BASE_URL`; si no hay URL pública,
//             asume HTTPS en producción y HTTP en desarrollo.
//
// Fail-safe a propósito: antes el defecto era effectively-HTTP, así que una app
// desplegada sin `APP_BASE_URL` mandaba la cookie de sesión sin `Secure` y sin
// HSTS, sin ningún aviso. Ahora el olvido produce la postura segura.
function resolverHttps(): boolean {
  const modo = env('APP_HTTPS', 'auto').trim().toLowerCase();
  if (modo === 'true') return true;
  if (modo === 'false') return false;
  const base = env('APP_BASE_URL', '').trim().toLowerCase();
  if (base) return base.startsWith('https://');
  return process.env.NODE_ENV === 'production';
}

// Dominios que el dev server acepta en la cabecera `Host`, separados por coma.
// Vacío = comportamiento por defecto de Astro (solo el host de la petición).
// Antes estaba en `true`, que acepta CUALQUIER `Host` y habilita inyección de
// Host / envenenamiento de caché si se levanta el dev server en la red.
function resolverAllowedHosts(): string[] {
  return env('ALLOWED_HOSTS', '')
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h !== '');
}

export const ENV = {
  dbHost: env('DB_HOST'),
  dbPort: num('DB_PORT', 5432),
  dbName: env('DB_NAME'),
  dbUser: env('DB_USER'),
  dbPassword: env('DB_PASSWORD'),
  dbSsl: env('DB_SSL') === 'true',

  appBaseUrl: env('APP_BASE_URL'),
  isHttps: resolverHttps(),
  allowedHosts: resolverAllowedHosts(),

  // Guarda de rate limiting para /api/*. Hoy no hay rutas /api (el portal es
  // solo SSR); queda preparado por si se vuelven a añadir.
  rateApiMax: num('RATE_LIMIT_API_MAX', 180),
  rateApiWindowMs: num('RATE_LIMIT_API_WINDOW_MS', 60_000),

  shutdownGraceMs: num('SHUTDOWN_GRACE_MS', 10_000),
} as const;
