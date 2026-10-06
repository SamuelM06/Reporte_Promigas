import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV } from './env';

// Sesión ÚNICA del Hub (Xuma Enterprise): JWT HS256 en la cookie `xuma_session`,
// firmado con el JWT_SECRET compartido. Esta app solo la VALIDA; no emite tokens
// ni tiene login propio. En la instancia pública Nginx no hace `auth_request`,
// así que esta es la única barrera que protege los datos de gestión.
//
// Limitación conocida: solo comprueba firma y expiración (≤12 h). No consulta
// `directorio.sesiones_revocadas` (vive en DataCenter_Vanti, otra base que la de
// este reporte): una sesión revocada sigue valiendo hasta que expire.
export const HUB_COOKIE = 'xuma_session';

export interface HubClaims {
  sub: string;
  nombre?: string;
  rol?: string;
  exp?: number;
}

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/** Verifica firma HS256 y expiración. Devuelve los claims o null. */
export function verificarJwt(token: string): HubClaims | null {
  if (!ENV.jwtSecret) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, p, sig] = partes;
  try {
    if (b64json(h).alg !== 'HS256') return null;
    const esperado = createHmac('sha256', ENV.jwtSecret).update(`${h}.${p}`).digest();
    const dado = Buffer.from(sig, 'base64url');
    if (dado.length !== esperado.length || !timingSafeEqual(dado, esperado)) return null;
    const claims = b64json(p) as HubClaims;
    if (!claims.exp || claims.exp * 1000 < Date.now() || !claims.sub) return null;
    return claims;
  } catch {
    return null;
  }
}

/** ¿Esta persona figura en ALLOWED_PERSONAS? Lista vacía = nadie (falla cerrado). */
export const personaAutorizada = (claims: HubClaims): boolean =>
  ENV.allowedPersonas.includes(String(claims.sub));

/** Desarrollo local sin Hub: solo con AUTH_DEV=true y NUNCA en producción. */
export const authDev = (): boolean =>
  process.env.AUTH_DEV === 'true' && process.env.NODE_ENV !== 'production';
