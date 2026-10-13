// Prefijo de despliegue (astro.config.mjs -> `base`). El Hub publica esta app
// bajo /reporte-promigas/, así que TODO enlace interno debe pasar por `ruta()`;
// un `/dashboard` a secas caería en el Hub, no aquí.
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

/** `ruta('/dashboard')` -> `/reporte-promigas/dashboard` (acepta query string). */
export const ruta = (p: string): string => `${BASE}${p.startsWith('/') ? p : `/${p}`}`;

/** Quita el prefijo a un pathname: `/reporte-promigas/x` -> `/x`. */
export const sinBase = (p: string): string =>
  BASE && (p === BASE || p.startsWith(`${BASE}/`)) ? p.slice(BASE.length) || '/' : p;
