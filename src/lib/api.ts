import { logError } from './log';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function jsonError(msg: string, status = 500): Response {
  return json({ error: msg }, status);
}

export async function conError<T>(
  fn: () => Promise<T>,
  etiqueta: string,
): Promise<Response> {
  try {
    const data = await fn();
    return json(data);
  } catch (err) {
    logError(etiqueta, err);
    return jsonError('Error interno al consultar los datos.');
  }
}