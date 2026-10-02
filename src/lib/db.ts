import { Pool } from 'pg';
import { ENV } from './env';
import { instalarSenales, registrarCierreDB } from './shutdown';

// La DB es COMPARTIDA: max_connections = 50 y 'xuma_interno' ya ocupa 20
// conexiones, dejando ~27 para el resto de apps. Este portal es un solo usuario
// con pocas pestanas abiertas, asi que un pool chico es suficiente.
//
// Un pool grande (el anterior era max:20) es lo que agoto el servidor: cada
// recarga del server de desarrollo creaba un Pool NUEVO de 20 conexiones y los
// backends quedaban huerfanos 'idle' en el servidor, ocupando los espacios
// reservados a SUPERUSER y dejando sin conexion a todas las paginas con:
//
//   FATAL: sorry, too many clients already
//   DETAIL: There are 10 remaining connection slots reserved for roles with
//           the SUPERUSER attribute.
//
// REGLA: nunca subir max por encima de 5 sin medir primero en pg_stat_activity.
const MAX_CONEXIONES = 5;

// El pool vive en globalThis para que las recargas en caliente de Astro (HMR)
// reusen la MISMA instancia. Declararlo con `const pool = new Pool(...)` a nivel
// de modulo lo duplicaba en cada recarga, multiplicando las conexiones.
const g = globalThis as typeof globalThis & { __poolPG?: Pool };

function crearPool(): Pool {
  const p = new Pool({
    host: ENV.dbHost || 'localhost',
    port: ENV.dbPort,
    database: ENV.dbName || 'postgres',
    user: ENV.dbUser || 'postgres',
    password: ENV.dbPassword || '',
    ssl: ENV.dbSsl ? { rejectUnauthorized: false } : false,
    application_name: 'siniestros_xuma',
    max: MAX_CONEXIONES,
    min: 0,                        // no quemar conexiones si el portal esta quieto
    idleTimeoutMillis: 30_000,     // suelta las ociosas en 30s, no en 5 minutos
    connectionTimeoutMillis: 10_000,
    query_timeout: 60_000,         // una consulta colgada no debe retener un espacio
    options: '-c statement_timeout=60000 -c lock_timeout=10000',
  });

  // Sin este manejador, cuando el servidor cierra una conexion ociosa (o este
  // proceso se reinicia) 'pg' lanza un 'error' sin listeners y el proceso muere.
  p.on('error', (err) => {
    console.error('[db] error de cliente ocioso (se descarta):', err.message);
  });
  return p;
}

const pool: Pool = g.__poolPG ?? (g.__poolPG = crearPool());

// Un unico heartbeat por proceso. Mantiene caliente el tunel SSL/TCP para que
// la primera consulta de cada pagina no pague el handshake. Solo ocupa 1 espacio
// porque reutiliza el pool; con el anterior (45s) sumado a max:20 saturaba la DB.
if (!(g as { __hbPG?: boolean }).__hbPG) {
  (g as { __hbPG?: boolean }).__hbPG = true;
  const hb = setInterval(() => {
    pool.query('SELECT 1').catch(() => {
      /* si falla, el pool la reconecta en la proxima consulta real */
    });
  }, 60_000);
  if (hb.unref) hb.unref();
}

// Cierre ordenado. Sin esto, reiniciar el server a la fuerza deja los backends
// 'idle' colgados en PostgreSQL hasta que el TCP expira, y se van acumulando
// hasta agotar los 50 espacios del servidor compartido.
//
// El apagado se coordina en src/lib/shutdown.ts para que el pool se cierre
// DESPUÉS de drenar las peticiones HTTP en vuelo. Aquí solo se publica la
// función de cierre; nada de process.exit (cortaba requests en un restart).
if (!(g as { __hookCierre?: boolean }).__hookCierre) {
  (g as { __hookCierre?: boolean }).__hookCierre = true;
  registrarCierreDB(async () => {
    await pool.end().catch(() => {});
  });
  instalarSenales();
}

export async function query<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

/** Cierra el pool. Llamar en el apagado del servidor para no dejar backends huerfanos. */
export async function cerrarPool(): Promise<void> {
  await pool.end().catch(() => {});
}

export { pool };
