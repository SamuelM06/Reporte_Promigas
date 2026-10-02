// ============================================================================
// MIDDLEWARE (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: DESACTIVADA A PROPÓSITO desde el commit 921e33a
//    ("desactiva login obligatorio... para acceso directo al dashboard").
//    `/login` solo redirige a `/dashboard`. Este portal muestra datos de
//    gestión (contrato, asesor, motivo): publicarlo fuera de una red
//    controlada es un problema de datos, no de código.
//
//    Si se reactiva la auth, hay que volver a traer `lib/auth.ts` (se borró al
//    eliminar el código muerto), validar la sesión aquí antes de `next()` y
//    proteger las rutas que la necesiten.
// 2) Endurecimiento: headers de seguridad + CSP en toda respuesta.
// 3) Rate limiting sobre /api/* (mitigación de abuso / recolección). Hoy el
//    portal no expone rutas /api: queda como guarda si se vuelve a añadir
//    alguna. NO se aplica a las páginas: detrás de un proxy `clientAddress` es
//    siempre la IP del proxy y el cupo lo consumirían todos los usuarios a la
//    vez. Para las páginas SSR la mitigación es la caché LRU de `lib/query.ts`.
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

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, clientAddress } = context;
  const path = url.pathname;
  // --- Acceso sin login (login deshabilitado/oculto) -----------------------
  if (path === '/login' || path === '/login/') {
    return redirect('/dashboard');
  }

  // --- Ratelimit sobre /api/* (solo si algún día vuelve a haber rutas) -------
  if (esRutaApi(path)) {
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