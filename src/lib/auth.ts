// ============================================================================
// CAPA DE AUTENTICACIÓN
// ----------------------------------------------------------------------------
// - Contraseña verificada con scrypt (hash en .env, nunca texto plano).
// - Token de sesión firmado con HMAC-SHA256 (SESSION_SECRET), con expiración.
// - Cookie httpOnly · SameSite=Lax · Path=/ · Secure cuando hay HTTPS.
// ============================================================================
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ENV } from './env';
import { logSecurity } from './log';

export const SESSION_COOKIE = 'xuma_sesion';

// ---- Verificación de credenciales (scrypt) -----------------------------------
export function verifyCredentials(username: string, password: string): boolean {
  const userOk =
    typeof ENV.adminUser === 'string' &&
    typeof username === 'string' &&
    username.length > 0 &&
    secureEquals(username.trim(), ENV.adminUser);

  if (!userOk) return false;

  const entry = ENV.adminPasswordHash;
  if (!entry) return false;
  const [saltHex, hashHex] = entry.split(':');
  if (!saltHex || !hashHex) return false;

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = scryptSync(String(password), salt, 64);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

// ---- Token de sesión firmado ---------------------------------------------------
function buildPayload(): string {
  const exp = Date.now() + ENV.authTtlHours * 60 * 60 * 1000;
  return Buffer.from(JSON.stringify({ u: ENV.adminUser.trim(), exp })).toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', ENV.sessionSecret).update(payload).digest('base64url');
}

export function createSessionToken(): string {
  const payload = buildPayload();
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): { usuario: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts as [string, string];
  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(sig ?? '');
  if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { u?: string; exp?: number };
    if (!data.u || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { usuario: data.u };
  } catch {
    return null;
  }
}

// ---- Cookies (Astro) ------------------------------------------------------------
const cookieOpts = {
  httpOnly: true,
  secure: ENV.isHttps,
  sameSite: 'lax' as const,
  path: '/',
};

export function setSessionCookie(cookies: AstroCookies, token: string): void {
  cookies.set(SESSION_COOKIE, token, { ...cookieOpts, maxAge: ENV.authTtlHours * 60 * 60 });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.set(SESSION_COOKIE, '', { ...cookieOpts, maxAge: 0 });
}

export function getSessionUser(cookies: AstroCookies): string | null {
  const token = cookies.get(SESSION_COOKIE)?.value;
  const sesion = verifySessionToken(token ?? '');
  return sesion?.usuario ?? null;
}

// ---- Utilidades ----------------------------------------------------------------
function secureEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function newSessionSecret(): string {
  return randomBytes(32).toString('hex');
}