// ============================================================================
// MIDDLEWARE DE SEGURIDAD (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: DESACTIVADA A PROPÓSITO desde el commit 921e33a
//    ("desactiva login obligatorio... para acceso directo al dashboard").
//    `/login` solo redirige a `/dashboard` y `getSessionUser` ya no se llama
//    en ningún punto del request. El portal queda abierto para quien tenga
//    acceso a la red.
//
//    AVISO: las piezas de auth siguen en el repo (src/lib/auth.ts, endpoints
//    /api/auth/*) pero están INERTES: /api/auth/login todavía responde 200 y
//    entrega un token, y ese token no abre nada porque nadie lo verifica.
//    Este portal muestra datos personales (nombre del asegurado, contrato,
//    monto): publicarlo fuera de una red controlada es un problema de datos,
//    no de código. Ver context/docs/seguridad.md.
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
  if (esRutaApi(path)) headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});