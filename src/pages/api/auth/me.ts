import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../lib/auth';

export const prerender = false;

// Requiere sesión (el middleware ya la valida). Devuelve el usuario actual.
export const GET: APIRoute = async ({ cookies }) => {
  const usuario = getSessionUser(cookies);
  const body = usuario ? { usuario } : { error: 'No autorizado' };
  return new Response(JSON.stringify(body), {
    status: usuario ? 200 : 401,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};