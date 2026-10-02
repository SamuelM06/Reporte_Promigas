// Query layer para Gestión Diaria Promigas 2026.
// Tabla: reportes.reporte_promi (en DataCenter_Promigas).
import { query, queryOne } from './db';

export interface Filtros {
  desde?: string;
  hasta?: string;
  mes?: string;
  distribuidora?: string[];
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
  distribuidoras: string[];
  aseguradoras: string[];
  canales: string[];
  cabinas: string[];
  estados: string[];
  porMes: { mes: string; total: number }[];
}

export const METADATOS_VACIOS: Metadatos = {
  total: 0,
  rangoFechas: { min: '2026-01-01', max: '2026-12-31' },
  meses: [], distribuidoras: [], aseguradoras: [], canales: [], cabinas: [], estados: [], porMes: [],
};

export function filtrosPorDefecto(): Filtros {
  return { desde: '2026-01-01', hasta: '2026-12-31' };
}

export function parseFiltros(url: URL): Filtros {
  const g = (k: string) => url.searchParams.get(k) ?? undefined;
  const gl = (k: string) => {
    const v = url.searchParams.getAll(k).map((s) => s.trim()).filter(Boolean);
    return v.length ? v : undefined;
  };
  return {
    desde: g('desde') ?? '2026-01-01',
    hasta: g('hasta') ?? '2026-12-31',
    mes: g('mes') ?? undefined,
    distribuidora: gl('distribuidora'),
    aseguradora: gl('aseguradora'),
    canal: gl('canal'),
    cabina: gl('cabina'),
    estado: gl('estado'),
    q: g('q') ?? undefined,
  };
}

// El grano mensual del reporte es el MES DE EJECUCIÓN (fecha_ejecucion, año 2026):
// así septiembre (139 ejecuciones) y el resto de meses aparecen aunque la columna
// "Mes" de la base traiga otra etiqueta de campaña.
export const MESES_ORDEN = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const MES_A_NUM: Record<string, number> = Object.fromEntries(MESES_ORDEN.map((m, i) => [m, i + 1]));

const MES_EJEC_SQL = `CASE EXTRACT(MONTH FROM fecha_ejecucion)
  WHEN 1 THEN 'ENERO' WHEN 2 THEN 'FEBRERO' WHEN 3 THEN 'MARZO' WHEN 4 THEN 'ABRIL'
  WHEN 5 THEN 'MAYO' WHEN 6 THEN 'JUNIO' WHEN 7 THEN 'JULIO' WHEN 8 THEN 'AGOSTO'
  WHEN 9 THEN 'SEPTIEMBRE' WHEN 10 THEN 'OCTUBRE' WHEN 11 THEN 'NOVIEMBRE' ELSE 'DICIEMBRE' END`;

function whereGestion(f: Filtros, params: unknown[]): string {
  const cond: string[] = ['1=1'];
  if (f.desde) { params.push(f.desde); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion >= $${params.length}::date)`); }
  if (f.hasta) { params.push(f.hasta); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion <= $${params.length}::date)`); }
  if (f.mes) {
    const num = MES_A_NUM[f.mes.trim().toUpperCase()];
    if (num) { params.push(num); cond.push(`(EXTRACT(MONTH FROM fecha_ejecucion) = $${params.length})`); }
  }
  const lista = (col: string, vals?: string[]) => {
    const l = (vals ?? []).map((v) => v.trim()).filter(Boolean);
    if (!l.length) return;
    params.push(l);
    cond.push(`${col} = ANY($${params.length})`);
  };
  lista('distribuidora_norm', f.distribuidora);
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
  try {
    const total = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${VISTA}`);
    const rango = await queryOne<{ min: string; max: string }>(
      `SELECT COALESCE(MIN(fecha_ejecucion)::text,'2026-01-01') AS min, COALESCE(MAX(fecha_ejecucion)::text,'2026-12-31') AS max FROM ${VISTA}`,
    );
    const meses = await query<{ mes: string }>(
      `SELECT DISTINCT ${MES_EJEC_SQL} AS mes FROM ${VISTA} WHERE fecha_ejecucion IS NOT NULL AND EXTRACT(YEAR FROM fecha_ejecucion) = 2026 ORDER BY EXTRACT(MONTH FROM fecha_ejecucion)`,
    );
    const dist = await query<{ v: string }>(`SELECT DISTINCT distribuidora_norm AS v FROM ${VISTA} WHERE distribuidora_norm IS NOT NULL ORDER BY 1`);
    const aseg = await query<{ v: string }>(`SELECT DISTINCT aseguradora_norm AS v FROM ${VISTA} WHERE aseguradora_norm IS NOT NULL ORDER BY 1`);
    const canales = await query<{ v: string }>(`SELECT DISTINCT canal_norm AS v FROM ${VISTA} WHERE canal_norm IS NOT NULL ORDER BY 1`);
    const cabinas = await query<{ v: string }>(`SELECT DISTINCT cabina_norm AS v FROM ${VISTA} WHERE cabina_norm IS NOT NULL ORDER BY 1`);
    const estados = await query<{ v: string }>(`SELECT DISTINCT estado_norm AS v FROM ${VISTA} WHERE estado_norm IS NOT NULL ORDER BY 1`);
    const porMes = await query<{ mes: string; total: string }>(
      `SELECT ${MES_EJEC_SQL} AS mes, COUNT(*)::text AS total FROM ${VISTA} WHERE fecha_ejecucion IS NOT NULL AND EXTRACT(YEAR FROM fecha_ejecucion) = 2026 GROUP BY 1, EXTRACT(MONTH FROM fecha_ejecucion) ORDER BY EXTRACT(MONTH FROM fecha_ejecucion)`,
    );
    return {
      total: Number(total?.n ?? 0),
      rangoFechas: { min: rango?.min ?? '2026-01-01', max: rango?.max ?? '2026-12-31' },
      meses: meses.map((r) => r.mes),
      distribuidoras: dist.map((r) => r.v),
      aseguradoras: aseg.map((r) => r.v),
      canales: canales.map((r) => r.v),
      cabinas: cabinas.map((r) => r.v),
      estados: estados.map((r) => r.v),
      porMes: porMes.map((r) => ({ mes: r.mes, total: Number(r.total) })),
    };
  } catch {
    return METADATOS_VACIOS;
  }
}

export interface Kpis {
  total: number;
  retenidos: number;
  cancelados: number;
  noContacto: number;
  pctRetencion: number;
}

export async function getKpis(f: Filtros): Promise<Kpis> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const row = await queryOne<any>(
    `SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado_norm ILIKE 'RETENID%')::int AS retenidos,
      COUNT(*) FILTER (WHERE estado_norm ILIKE 'CANCELAD%')::int AS cancelados,
      COUNT(*) FILTER (WHERE estado_norm ILIKE 'NO CONTACTO%')::int AS nocon
     FROM ${VISTA} WHERE ${w}`,
    params,
  ).catch(() => undefined);
  const total = row?.total ?? 0;
  const retenidos = row?.retenidos ?? 0;
  return {
    total,
    retenidos,
    cancelados: row?.cancelados ?? 0,
    noContacto: row?.nocon ?? 0,
    pctRetencion: total ? Math.round((retenidos / total) * 1000) / 10 : 0,
  };
}

export async function getTendencia(f: Filtros) {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  return query(
    `SELECT ${MES_EJEC_SQL} AS mes, EXTRACT(MONTH FROM fecha_ejecucion)::int AS nmes, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE estado_norm ILIKE 'RETENID%')::int AS retenidos,
      COUNT(*) FILTER (WHERE estado_norm ILIKE 'CANCELAD%')::int AS cancelados
     FROM ${VISTA} WHERE ${w} AND fecha_ejecucion IS NOT NULL AND EXTRACT(YEAR FROM fecha_ejecucion) = 2026
     GROUP BY 1, 2 ORDER BY 2`,
    params,
  ).catch(() => []);
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
    `SELECT ${MES_EJEC_SQL} AS mes, EXTRACT(MONTH FROM fecha_ejecucion)::int AS nmes, ${ASEG_CANON} AS aseguradora, COUNT(*)::int AS total
     FROM ${VISTA} WHERE ${w} AND fecha_ejecucion IS NOT NULL AND EXTRACT(YEAR FROM fecha_ejecucion) = 2026
     GROUP BY 1, 2, 3
     HAVING COUNT(*) > 0
     ORDER BY 2, 3`,
    params,
  ).catch(() => []);
}

// Aptos = gestiones contactadas y evaluables: se excluyen No contacto, No apto,
// No aplica y sin estado. % Retención = Retenidos / Aptos × 100.
const APTOS_SQL = `(estado_norm IS NOT NULL AND estado_norm NOT ILIKE 'NO CONTACTO%' AND estado_norm NOT ILIKE 'NO APTO%' AND estado_norm NOT ILIKE 'NO APLICA%')`;
const RETENIDOS_SQL = `(estado_norm ILIKE 'RETENID%')`;

export interface FilaDashboardMensual {
  mes: string;
  total: number;
  inbound: number;
  outbound: number;
  retenidos: number;
  aptos: number;
  pct: number;
}

export async function getDashboardMensual(f: Filtros): Promise<FilaDashboardMensual[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  // Eje X completo: los 12 meses siempre (generate_series), con ceros donde no hay gestión.
  const rows = await query<any>(
    `SELECT m.mes, COALESCE(d.total,0)::int AS total, COALESCE(d.inbound,0)::int AS inbound,
      COALESCE(d.outbound,0)::int AS outbound, COALESCE(d.retenidos,0)::int AS retenidos, COALESCE(d.aptos,0)::int AS aptos
     FROM (SELECT generate_series(1,12) AS n) g
     JOIN (SELECT unnest(ARRAY['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']) AS mes, generate_series(1,12) AS n) m USING (n)
     LEFT JOIN (
       SELECT EXTRACT(MONTH FROM fecha_ejecucion)::int AS nmes, COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND')::int AS inbound,
         COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND')::int AS outbound,
         COUNT(*) FILTER (WHERE ${RETENIDOS_SQL})::int AS retenidos,
         COUNT(*) FILTER (WHERE ${APTOS_SQL})::int AS aptos
       FROM ${VISTA} WHERE ${w} AND fecha_ejecucion IS NOT NULL AND EXTRACT(YEAR FROM fecha_ejecucion) = 2026
       GROUP BY 1
     ) d ON d.nmes = g.n
     ORDER BY g.n`,
    params,
  ).catch(() => []);
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
      pct: aptos > 0 ? Math.round((retenidos / aptos) * 1000) / 10 : 0,
    };
  });
}
export async function getTabla(f: Filtros, page = 1, pageSize = 50) {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const offset = (Math.max(1, page) - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT id, distribuidora, aseguradora, contrato, localidad, operador, canal, producto, tipo_contacto, estado, motivo, fecha_ejecucion::text AS fecha_ejecucion, mes, cabina, asesor_venta
     FROM ${VISTA} WHERE ${w} ORDER BY fecha_ejecucion DESC NULLS LAST, id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  ).catch(() => []);
  const tot = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${VISTA} WHERE ${w}`, params.slice(0, -2)).catch(() => ({ n: '0' }));
  return { rows, total: Number((tot as any)?.n ?? 0), page, pageSize };
}

// SSR con caché en memoria muy simple (evita golpear la DB compartida en cada request).
const cache = new Map<string, { exp: number; val: any }>();
export async function cargaSSR<T>(clave: string, promesa: Promise<T>, fallback: T, ttlMs = 30_000): Promise<T> {
  const hit = cache.get(clave);
  if (hit && hit.exp > Date.now()) return hit.val as T;
  try {
    const val = await promesa;
    cache.set(clave, { exp: Date.now() + ttlMs, val });
    return val;
  } catch {
    return fallback;
  }
}
