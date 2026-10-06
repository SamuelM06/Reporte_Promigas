// ============================================================================
// MIDDLEWARE (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: sesión ÚNICA del Hub. Se exige la cookie `xuma_session`
//    (JWT HS256 firmado con el JWT_SECRET compartido) en toda ruta que no sea
//    un estático. Sin sesión válida -> 401. Sin JWT_SECRET en producción
//    también 401 (falla cerrado). Además la persona (`sub`) debe estar en
//    ALLOWED_PERSONAS (si no, 403). `/login` solo redirige a `/dashboard`.
//    Este portal muestra datos de gestión (contrato, asesor, motivo).
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
import { HUB_COOKIE, authDev, personaAutorizada, verificarJwt } from './lib/auth';
import { ruta, sinBase } from './lib/base';

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
  // `url.pathname` trae el prefijo de despliegue; las reglas de abajo van sin él.
  const path = sinBase(url.pathname);
  // --- Acceso sin login (login deshabilitado/oculto) -----------------------
  if (path === '/login' || path === '/login/') {
    return redirect(ruta('/dashboard'));
  }

  // --- Sesión del Hub (estáticos exentos: no llevan datos) --------------------
  if (!esEstatico(path) && !authDev()) {
    const token = context.cookies.get(HUB_COOKIE)?.value;
    const claims = token ? verificarJwt(token) : null;
    // 403: sesión válida del Hub, pero la persona no está en ALLOWED_PERSONAS.
    if (claims && !personaAutorizada(claims)) {
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>Sin acceso</title>' +
          '<p style="font-family:sans-serif;padding:2rem">No tienes permiso para ver este reporte.</p>',
        {
          status: 403,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'x-frame-options': 'SAMEORIGIN',
            'x-content-type-options': 'nosniff',
          },
        },
      );
    }
    if (!claims) {
      if (!ENV.jwtSecret) console.error('[auth] JWT_SECRET no configurado: se niega todo acceso.');
      const cuerpo =
        '<!doctype html><meta charset="utf-8"><title>Sesión requerida</title>' +
        '<p style="font-family:sans-serif;padding:2rem">Tu sesión expiró o no existe. ' +
        'Inicia sesión en Xuma Enterprise y vuelve a abrir este reporte.</p>';
      return new Response(cuerpo, {
        status: 401,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-frame-options': 'SAMEORIGIN',
          'x-content-type-options': 'nosniff',
        },
      });
    }
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
  headers.set('X-Frame-Options', 'SAMEORIGIN');
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
      "frame-ancestors 'self'",
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