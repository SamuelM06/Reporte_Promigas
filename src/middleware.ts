// ============================================================================
// MIDDLEWARE DE SEGURIDAD (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: DESACTIVADA A PROPÓSITO desde el commit 921e33a
//    ("desactiva login obligatorio... para acceso directo al dashboard").
//    `/login` solo redirige a `/dashboard` y `getSessionUser` ya no se llama
//    en ningún punto del request. El portal queda abierto para quien tenga
//    acceso a la red.
//
//    AVISO: el login está deshabilitado y los endpoints /api/auth/* se eliminaron
//    del repo para no emitir tokens sin consumidor. Este portal muestra datos
//    de gestión (contrato, asesor, motivo): publicarlo fuera de una red
//    controlada es un problema de datos, no de código.
//
//    Si se reactiva la auth, hay que llamar a `getSessionUser(context.cookies)`
//    aquí antes de `next()` y proteger /api/* con 401.
// 2) Endurecimiento: headers de seguridad + CSP en toda respuesta.
// 3) Rate limiting genérico sobre la API (mitigación de abuso / recolección),
//    con excepción de /api/health para no gastar el cupo de los usuarios.
// ============================================================================
import { defineMiddleware } from 'astro:middleware';
import { rateLimit } from './lib/ratelimit';
import { ENV } from './lib/env';

const esRutaApi = (p: string) => p === '/api' || p.startsWith('/api/');

// Estáticos con nombre fijo que sirve Astro: no son HTML dinámico.
const esEstatico = (p: string) =>
  p.startsWith('/_astro/') ||
  p.startsWith('/fonts/') ||
  p.startsWith('/logos/') ||
  p.startsWith('/vendor/') ||
  p.startsWith('/data/') ||
  p === '/favicon.svg' ||
  p === '/favicon.ico';

// Página dinámica = todo lo que no es API ni estático (el HTML del portal).
const esPaginaDinamica = (p: string) => !esRutaApi(p) && !esEstatico(p);

// El health check queda fuera del rate limit: lo sondea el orquestador cada
// pocos segundos, y como `clientAddress` detrás de un proxy es siempre la IP
// del proxy, consumiría el cupo de la API de todos los usuarios a la vez.
const esHealth = (p: string) => p === '/api/health' || p === '/api/health/';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, clientAddress } = context;
  const path = url.pathname;
  // --- Acceso sin login (login deshabilitado/oculto) -----------------------
  if (path === '/login' || path === '/login/') {
    return redirect('/dashboard');
  }

  // --- Ratelimit sobre la API autenticada ------------------------------------
  if (esRutaApi(path) && !esHealth(path)) {
    const kapi = rateLimit(`api:${clientAddress}`, ENV.rateApiMax, ENV.rateApiWindowMs);
    if (!kapi.allowed) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intente luego.' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'retry-after': String(kapi.retryAfterSec),
        },
      });
    }
  }

  // --- Ejecutar la ruta --------------------------------------------------------
  const response = await next();

  // --- Endurecimiento de respuesta --------------------------------------------
  const headers = new Headers(response.headers);
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self' blob:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.google.com https://*.googleapis.com https://*.gstatic.com",
      "font-src 'self'",
      "connect-src 'self' ws: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.google.com https://*.googleapis.com https://*.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join('; '),
  );
  if (ENV.isHttps) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Las páginas son SSR con datos vivos: nunca se guardan en cachés intermedias.
  // Los estáticos versionados (/_astro, /fonts, /logos, /vendor, /favicon) los
  // sirve Astro con sus propios headers y no se tocan aquí.
  if (esRutaApi(path) || esPaginaDinamica(path)) headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});