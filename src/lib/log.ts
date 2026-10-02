import {
  appendFileSync,
  mkdirSync,
  statSync,
  existsSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOG_DIR = join(ROOT, '..', 'logs');

// La bitácora se rota por tamaño. Sin esto app.log crece para siempre: cuando la
// DB empieza a fallar (tipo 'too many clients') cada petición deja un stacktrace
// completo y el archivo se lleva cientos de MB en minutos.
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB por generación
const GENERACIONES = 3;             // app.log + app.1.log + app.2.log -> 6 MB tope

function nombreArchivo(): string {
  return join(LOG_DIR, 'app.log');
}

// Envejece las generaciones: app.2.log se descarta, app.1 -> app.2, app -> app.1
function rotar(archivo: string): void {
  try {
    const base = archivo.replace(/\.log$/, '');
    const masViejo = `${base}.${GENERACIONES - 1}.log`;
    if (existsSync(masViejo)) unlinkSync(masViejo);
    for (let i = GENERACIONES - 2; i >= 1; i--) {
      const desde = `${base}.${i}.log`;
      if (existsSync(desde)) renameSync(desde, `${base}.${i + 1}.log`);
    }
    renameSync(archivo, `${base}.1.log`);
  } catch {
    // Si la rotación falla se sigue escribiendo en el archivo actual: es preferible
    // un log grande a perder la bitácora de seguridad.
  }
}

function entry(line: string): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const archivo = nombreArchivo();

    // Se comprueba en cada escritura (statSync es de microsegundos) para que el
    // tope sea un límite real y no un promedio: durante una tormenta de errores
    // un chequeo cada N segundos dejaría el archivo pasarse.
    try {
      if (statSync(archivo).size >= MAX_BYTES) rotar(archivo);
    } catch {
      // aún no existe: se creará con el append de abajo
    }

    appendFileSync(archivo, `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    // El logging nunca debe tumbar la aplicación
  }
}

// Bitácora de eventos de seguridad (accesos, intentos, sesiones).
export function logSecurity(evento: string, detalle: Record<string, unknown>): void {
  const extra = Object.entries(detalle)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  entry(`SECURITY ${evento} ${extra}`);
}

export function logError(evento: string, detalle: unknown): void {
  const msg = detalle instanceof Error ? `${detalle.message} @ ${detalle.stack ?? ''}` : JSON.stringify(detalle);
  entry(`ERROR ${evento} ${msg}`);
}
