// Query layer para Gestión Diaria Promigas 2026.
// Tabla: reportes.reporte_promi (en DataCenter_Promigas).
import { query, queryOne } from './db';

export interface Filtros {
  desde?: string;
  hasta?: string;
  mes?: string;
  gasera?: string[];
  aseguradora?: string[];
  canal?: string[];
  cabina?: string[];
  estado?: string[];
  q?: string;
}

export interface Metadatos {
  total: number;
  rangoFechas: { min: string; max: string };
  meses: string[];
  gaseras: string[];
  aseguradoras: string[];
  canales: string[];
  cabinas: string[];
  estados: string[];
  porMes: { mes: string; total: number }[];
}

export const METADATOS_VACIOS: Metadatos = {
  total: 0,
  rangoFechas: { min: '2026-01-01', max: '2026-12-31' },
  meses: [], gaseras: [], aseguradoras: [], canales: [], cabinas: [], estados: [], porMes: [],
};

export function filtrosPorDefecto(): Filtros {
  return { desde: '2026-01-01', hasta: '2026-12-31' };
}

export function parseFiltros(url: URL): Filtros {
  const g = (k: string) => {
    const v = url.searchParams.get(k)?.trim();
    return v && v.length > 0 ? v : undefined;
  };
  const gl = (k: string) => {
    const v = url.searchParams.getAll(k).map((s) => s.trim()).filter(Boolean);
    return v.length ? v : undefined;
  };
  return {
    desde: g('desde') ?? '2026-01-01',
    hasta: g('hasta') ?? '2026-12-31',
    mes: g('mes'),
    gasera: gl('gasera'),
    aseguradora: gl('aseguradora'),
    canal: gl('canal'),
    cabina: gl('cabina'),
    estado: gl('estado'),
    q: g('q'),
  };
}

// El grano mensual del reporte es la columna MES de la base (mes_norm),
// en el orden ENERO → DICIEMBRE.
const ORDEN_MES_SQL = `CASE mes_norm WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3 WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6 WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9 WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12 ELSE 99 END`;

function whereGestion(f: Filtros, params: unknown[]): string {
  const cond: string[] = ['1=1'];
  if (f.desde && !f.mes) { params.push(f.desde); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion >= $${params.length}::date)`); }
  if (f.hasta && !f.mes) { params.push(f.hasta); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion <= $${params.length}::date)`); }
  if (f.mes?.trim()) { params.push(f.mes.trim().toUpperCase()); cond.push(`mes_norm = $${params.length}`); }
  const lista = (col: string, vals?: string[]) => {
    const l = (vals ?? []).map((v) => v.trim().toUpperCase()).filter(Boolean);
    if (!l.length) return;
    params.push(l);
    cond.push(`${col} = ANY($${params.length})`);
  };
  lista('gasera_norm', f.gasera);
  lista('aseguradora_norm', f.aseguradora);
  lista('canal_norm', f.canal);
  lista('cabina_norm', f.cabina);
  lista('estado_norm', f.estado);
  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    cond.push(`(contrato ILIKE $${params.length} OR asesor_venta ILIKE $${params.length} OR producto ILIKE $${params.length} OR motivo ILIKE $${params.length})`);
  }
  return cond.join(' AND ');
}

const VISTA = `reportes.reporte_promi`;

export async function getMetadatos(_f: Filtros): Promise<Metadatos> {
  // Sin try/catch interno: si la DB falla, el error SUBE hasta cargaSSR, que
  // aplica el fallback SIN cachearlo (un vacío cacheado dejaba todo en 0).
  const total = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${VISTA}`);
    const rango = await queryOne<{ min: string; max: string }>(
      `SELECT COALESCE(MIN(fecha_ejecucion)::text,'2026-01-01') AS min, COALESCE(MAX(fecha_ejecucion)::text,'2026-12-31') AS max FROM ${VISTA}`,
    );
    const meses = await query<{ mes: string }>(
      `SELECT mes_norm AS mes FROM ${VISTA} WHERE mes_norm IS NOT NULL GROUP BY mes_norm ORDER BY ${ORDEN_MES_SQL}`,
    );
    const dist = await query<{ v: string }>(`SELECT DISTINCT gasera_norm AS v FROM ${VISTA} WHERE gasera_norm IS NOT NULL ORDER BY 1`);
    const aseg = await query<{ v: string }>(`SELECT DISTINCT aseguradora_norm AS v FROM ${VISTA} WHERE aseguradora_norm IS NOT NULL ORDER BY 1`);
    const canales = await query<{ v: string }>(`SELECT DISTINCT canal_norm AS v FROM ${VISTA} WHERE canal_norm IS NOT NULL ORDER BY 1`);
    const cabinas = await query<{ v: string }>(`SELECT DISTINCT cabina_norm AS v FROM ${VISTA} WHERE cabina_norm IS NOT NULL ORDER BY 1`);
    const estados = await query<{ v: string }>(`SELECT DISTINCT estado_norm AS v FROM ${VISTA} WHERE estado_norm IS NOT NULL ORDER BY 1`);
    const porMes = await query<{ mes: string; total: string }>(
      `SELECT mes_norm AS mes, COUNT(*)::text AS total FROM ${VISTA} WHERE mes_norm IS NOT NULL GROUP BY mes_norm ORDER BY ${ORDEN_MES_SQL}`,
    );
    return {
      total: Number(total?.n ?? 0),
      rangoFechas: { min: rango?.min ?? '2026-01-01', max: rango?.max ?? '2026-12-31' },
      meses: meses.map((r) => r.mes),
      gaseras: dist.map((r) => r.v),
      aseguradoras: aseg.map((r) => r.v),
      canales: canales.map((r) => r.v),
      cabinas: cabinas.map((r) => r.v),
      estados: estados.map((r) => r.v),
      porMes: porMes.map((r) => ({ mes: r.mes, total: Number(r.total) })),
    };
}

export interface FilaMensualAseguradora { mes: string; aseguradora: string; total: number; }

const ASEG_CANON = `CASE
  WHEN aseguradora_norm ILIKE '%ALFA%' THEN 'ALFA'
  WHEN aseguradora_norm ILIKE '%HDI%' OR aseguradora_norm ILIKE '%LIBERTY%' THEN 'HDI'
  WHEN aseguradora_norm ILIKE '%SURA%' THEN 'SURA'
  WHEN aseguradora_norm ILIKE '%GNP%' THEN 'GNP'
  WHEN aseguradora_norm ILIKE '%PROEXEQUIAL%' OR aseguradora_norm ILIKE '%RECORDAR%' OR aseguradora_norm ILIKE '%CAPILLA%' THEN 'PROEXEQUIAL'
  WHEN aseguradora_norm ILIKE '%IKE%' THEN 'IKE'
  WHEN aseguradora_norm IS NULL OR aseguradora_norm IN ('','N/A','NA','NO APLICA','NO APTO') THEN 'SIN DATO'
  ELSE 'OTRAS' END`;

export async function getMensualPorAseguradora(f: Filtros): Promise<FilaMensualAseguradora[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  return query(
    `SELECT mes_norm AS mes, ${ASEG_CANON} AS aseguradora, COUNT(*)::int AS total
     FROM ${VISTA} WHERE ${w} AND mes_norm IS NOT NULL
     GROUP BY mes_norm, ${ASEG_CANON}
     HAVING COUNT(*) > 0
      ORDER BY ${ORDEN_MES_SQL}, 2`,
    params,
  );
}

// Aptos / No aptos salen de la columna CLASIFICACION de la base (índice 19 del Excel).
// % Retención = Retenidos / Aptos × 100.
const APTOS_SQL = `(clasificacion_norm = 'APTO')`;
const NO_APTOS_SQL = `(clasificacion_norm = 'NO APTO')`;
const RETENIDOS_SQL = `(estado_norm ILIKE 'RETENID%')`;

export interface FilaDashboardMensual {
  mes: string;
  total: number;
  inbound: number;
  outbound: number;
  retenidos: number;
  aptos: number;
  noAptos: number;
  pct: number;
}

export async function getDashboardMensual(f: Filtros): Promise<FilaDashboardMensual[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const rows = await query<any>(
    `SELECT mes_norm AS mes, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND')::int AS inbound,
      COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND')::int AS outbound,
      COUNT(*) FILTER (WHERE ${RETENIDOS_SQL})::int AS retenidos,
      COUNT(*) FILTER (WHERE ${APTOS_SQL})::int AS aptos,
      COUNT(*) FILTER (WHERE ${NO_APTOS_SQL})::int AS no_aptos
     FROM ${VISTA} WHERE ${w} AND mes_norm IS NOT NULL GROUP BY mes_norm ORDER BY ${ORDEN_MES_SQL}`,
    params,
  );
  return rows.map((r: any) => {
    const aptos = Number(r.aptos ?? 0);
    const retenidos = Number(r.retenidos ?? 0);
    return {
      mes: r.mes,
      total: Number(r.total ?? 0),
      inbound: Number(r.inbound ?? 0),
      outbound: Number(r.outbound ?? 0),
      retenidos,
      aptos,
      noAptos: Number(r.no_aptos ?? 0),
      pct: aptos > 0 ? Math.round((retenidos / aptos) * 1000) / 10 : 0,
    };
  });
}
// Caché SSR acotada (evita golpear la DB compartida en cada request SIN crecer sin límite).
// - TTL por entrada + borrado perezoso de vencidas al leer.
// - Tope duro de entradas con desalojo FIFO (las claves incluyen página y filtros,
//   que antes hacían crecer el Map para siempre: 502 páginas × combinaciones).
// - Barrido periódico cada 60s como red de seguridad.
const CACHE_MAX = 300;
const cache = new Map<string, { exp: number; val: unknown }>();

function cacheGet<T>(clave: string): T | undefined {
  const hit = cache.get(clave);
  if (!hit) return undefined;
  if (hit.exp <= Date.now()) {
    cache.delete(clave); // vencida: se libera de una vez, no se acumula
    return undefined;
  }
  // Re-inserta para marcarla reciente (LRU).
  cache.delete(clave);
  cache.set(clave, hit);
  return hit.val as T;
}

function cacheSet(clave: string, val: unknown, ttlMs: number): void {
  while (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  cache.set(clave, { exp: Date.now() + ttlMs, val });
}

const g = globalThis as typeof globalThis & { __barridoCachePromi?: boolean };
if (!g.__barridoCachePromi) {
  g.__barridoCachePromi = true;
  const t = setInterval(() => {
    const ahora = Date.now();
    for (const [k, v] of cache) {
      if (v.exp <= ahora) cache.delete(k);
    }
  }, 60_000);
  if (typeof t === 'object' && t !== null && 'unref' in t) (t as { unref(): void }).unref();
}

export async function cargaSSR<T>(clave: string, promesa: Promise<T>, fallback: T, ttlMs = 30_000): Promise<T> {
  const hit = cacheGet<T>(clave);
  if (hit !== undefined) return hit;
  try {
    const val = await promesa;
    // No cachear resultados vacíos provenientes de un error o fallback transitorio
    if (val !== undefined && val !== null) {
      const esArrayVacio = Array.isArray(val) && val.length === 0;
      const esMetaVacio = typeof val === 'object' && (val as any)?.total === 0;
      if (!esArrayVacio && !esMetaVacio) {
        cacheSet(clave, val, ttlMs);
      }
    }
    return val;
  } catch (err) {
    console.error(`[cargaSSR] Falló carga para clave "${clave}":`, err);
    return fallback;
  }
}
