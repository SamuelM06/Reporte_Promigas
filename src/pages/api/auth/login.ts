import type { APIRoute } from 'astro';
import { createSessionToken, setSessionCookie, verifyCredentials } from '../../../lib/auth';
import { logSecurity } from '../../../lib/log';
import { rateLimit } from '../../../lib/ratelimit';
import { ENV } from '../../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress ?? 'desconocida';

  const lr = rateLimit(`login:${ip}`, ENV.rateLoginMax, ENV.rateLoginWindowMs);
  if (!lr.allowed) {
    logSecurity('LOGIN BLOQUEADO POR RATE LIMIT', { ip });
    return new Response(JSON.stringify({ error: 'Demasiados intentos. Espere unos minutos.' }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': String(lr.retryAfterSec) },
    });
  }

  let username = '';
  let password = '';
  try {
    const form = await request.formData();
    username = String(form.get('username') ?? '').trim().slice(0, 60);
    password = String(form.get('password') ?? '');
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  if (!username || !password) {
    logSecurity('LOGIN FALLIDO (CAMPOS VACÍOS)', { ip });
    return json({ error: 'Ingrese usuario y contraseña.' }, 401);
  }

  const ok = verifyCredentials(username, password);
  if (!ok) {
    logSecurity('LOGIN FALLIDO (CREDENCIALES)', { username, ip });
    return json({ error: 'Credenciales inválidas.' }, 401);
  }

  const token = createSessionToken();
  setSessionCookie(cookies, token);
  logSecurity('LOGIN OK', { username, ip });
  return json({ ok: true, usuario: username });
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}