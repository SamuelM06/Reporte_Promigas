// Rate limiting en memoria por IP/clave.
// Capa de seguridad: mitiga fuerza bruta de intentos de login y abuso de la API.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Tope duro: la limpieza solo corre cada 5 min, así que una ráfaga de IPs
// distintas podría crecer el Map durante la ventana. Al superar el tope se
// descartan los cubos que ya vencieron; si no hay ninguno, se deja pasar la
// petición sin contar (preferible a Growel o a denegar el servicio).
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    if (buckets.size >= MAX_BUCKETS) podarVencidos(now);
    if (buckets.size < MAX_BUCKETS) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
    }
    return { allowed: true, retryAfterSec: 0, remaining: max - 1 };
  }
  b.count += 1;
  if (b.count > max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)), remaining: 0 };
  }
  return { allowed: true, retryAfterSec: 0, remaining: max - b.count };
}

function podarVencidos(now: number): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

// Limpieza periódica para que la memoria no crezca sin límite.
export function configurarLimpieza(): () => void {
  const t = setInterval(() => podarVencidos(Date.now()), 5 * 60_000);
  t.unref?.();
  return () => clearInterval(t);
}