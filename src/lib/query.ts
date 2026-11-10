// Query layer para Gestión Diaria Promigas 2026.
// Tabla: reportes.reporte_promi (en DataCenter_Promigas).
import { query, queryOne } from './db';

export interface Filtros {
  desde?: string;
  hasta?: string;
  mes?: string[];
  gasera?: string[];
  aseguradora?: string[];
  canal?: string[];
  cabina?: string[];
  estado?: string[];
  /** 'APTO' | 'NO APTO' — la columna Clasificación del Excel (columna T). */
  clasificacion?: string[];
  q?: string;
}

export interface Metadatos {
  /** Registros en base (sin ningún filtro del panel): el "en base" del panel. */
  total: number;
  /** Registros que cumplen TODOS los filtros activos. */
  totalFiltrado: number;
  rangoFechas: { min: string; max: string };
  meses: string[];
  gaseras: string[];
  aseguradoras: string[];
  canales: string[];
  cabinas: string[];
  estados: string[];
  clasificaciones: string[];
  porMes: { mes: string; total: number }[];
}

export const METADATOS_VACIOS: Metadatos = {
  total: 0,
  totalFiltrado: 0,
  rangoFechas: { min: '2026-01-01', max: '2026-12-31' },
  meses: [], gaseras: [], aseguradoras: [], canales: [], cabinas: [], estados: [], clasificaciones: [], porMes: [],
};

export function filtrosPorDefecto(): Filtros {
  // Sin rango de fechas implícito: la columna Mes de la base ya define el
  // corte 2026. Un rango por defecto por fecha_ejecucion excluía en silencio
  // filas con año tecleado distinto (2025/2024/206) aunque su MES era 2026,
  // y el total dejaba de cuadrar con el Excel. Solo se filtra por fechas
  // si el usuario lo pide explícitamente en la URL (?desde=...&hasta=...).
  return {};
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
    desde: g('desde'),
    hasta: g('hasta'),
    mes: gl('mes'),
    gasera: gl('gasera'),
    aseguradora: gl('aseguradora'),
    canal: gl('canal'),
    cabina: gl('cabina'),
    estado: gl('estado'),
    clasificacion: gl('clasificacion')?.map((v) => v.toUpperCase()).filter((v) => v === 'APTO' || v === 'NO APTO'),
    q: g('q'),
  };
}

// El grano mensual del reporte es la columna MES de la base (mes_norm),
// en el orden ENERO → DICIEMBRE.
//
// Mes efectivo: si la columna MES viene vacía pero la fila tiene
// fecha_ejecucion, el mes se deriva de la fecha. Así ninguna fila se
// pierde de los totales solo porque MES esté vacío (ej. 14 filas SURTIGAS).
// Solo si AMBOS faltan, la fila cae en el grupo 'SIN MES' (sigue contando).
const MES_EFECTIVO_SQL = `COALESCE(NULLIF(TRIM(mes_norm),''), CASE EXTRACT(MONTH FROM fecha_ejecucion) WHEN 1 THEN 'ENERO' WHEN 2 THEN 'FEBRERO' WHEN 3 THEN 'MARZO' WHEN 4 THEN 'ABRIL' WHEN 5 THEN 'MAYO' WHEN 6 THEN 'JUNIO' WHEN 7 THEN 'JULIO' WHEN 8 THEN 'AGOSTO' WHEN 9 THEN 'SEPTIEMBRE' WHEN 10 THEN 'OCTUBRE' WHEN 11 THEN 'NOVIEMBRE' WHEN 12 THEN 'DICIEMBRE' END, 'SIN MES')`;
const ORDEN_MES_SQL = `CASE (${MES_EFECTIVO_SQL}) WHEN 'ENERO' THEN 1 WHEN 'FEBRERO' THEN 2 WHEN 'MARZO' THEN 3 WHEN 'ABRIL' THEN 4 WHEN 'MAYO' THEN 5 WHEN 'JUNIO' THEN 6 WHEN 'JULIO' THEN 7 WHEN 'AGOSTO' THEN 8 WHEN 'SEPTIEMBRE' THEN 9 WHEN 'OCTUBRE' THEN 10 WHEN 'NOVIEMBRE' THEN 11 WHEN 'DICIEMBRE' THEN 12 ELSE 99 END`;

function whereGestion(f: Filtros, params: unknown[]): string {
  const cond: string[] = ['1=1'];
  const tieneMes = Boolean(f.mes && f.mes.length > 0);
  // Rango de fechas solo si se pidió explícitamente en la URL. Por defecto
  // cada merge trae desde/hasta = undefined y ninguna fila se excluye por
  // fecha_ejecucion: el Excel tiene fechas con año distinto al de MES
  // (2025, 2024, 206) y esas filas deben seguir contando.
  if (f.desde && !tieneMes) { params.push(f.desde); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion >= $${params.length}::date)`); }
  if (f.hasta && !tieneMes) { params.push(f.hasta); cond.push(`(fecha_ejecucion IS NULL OR fecha_ejecucion <= $${params.length}::date)`); }
  const lista = (col: string, vals?: string[]) => {
    const l = (vals ?? []).map((v) => v.trim().toUpperCase()).filter(Boolean);
    if (!l.length) return;
    params.push(l);
    cond.push(`${col} = ANY($${params.length})`);
  };
  // El filtro por Mes compara contra el MES EFECTIVO (con respaldo por
  // fecha): una fila sin MES pero con fecha en ENERO sí entra al filtrar
  // por ENERO.
  lista(`(${MES_EFECTIVO_SQL})`, f.mes);
  lista('gasera_norm', f.gasera);
  lista('aseguradora_norm', f.aseguradora);
  lista('canal_norm', f.canal);
  lista('cabina_norm', f.cabina);
  lista('estado_norm', f.estado);
  lista('clasificacion_norm', f.clasificacion);
  if (f.q?.trim()) {
    params.push(`%${f.q.trim()}%`);
    cond.push(`(contrato ILIKE $${params.length} OR asesor_venta ILIKE $${params.length} OR producto ILIKE $${params.length} OR motivo ILIKE $${params.length})`);
  }
  return cond.join(' AND ');
}

const VISTA = `reportes.reporte_promi`;

// Dimensiones del panel de filtros.
const DIMENSIONES = ['mes', 'gasera', 'aseguradora', 'canal', 'cabina', 'estado', 'clasificacion'] as const;
type Dimension = (typeof DIMENSIONES)[number];

/** Copia de los filtros sin la dimensión indicada. */
function sinDimension(f: Filtros, dim: Dimension): Filtros {
  const g: Filtros = { ...f };
  delete g[dim];
  return g;
}

export async function getMetadatos(f: Filtros): Promise<Metadatos> {
  // --- Base del reporte: sin filtros del panel -------------------------------
  // "total" es el "en base" que muestra el panel: el total de la vista.
  const total = await queryOne<{ n: string }>(`SELECT COUNT(*)::text AS n FROM ${VISTA}`);
  const rango = await queryOne<{ min: string; max: string }>(
    `SELECT COALESCE(MIN(fecha_ejecucion)::text,'2026-01-01') AS min, COALESCE(MAX(fecha_ejecucion)::text,'2026-12-31') AS max FROM ${VISTA}`,
  );

  // --- Opciones de cada desplegable ------------------------------------------
  // Cada dimensión se resuelve SIN su propio filtro (pero con los demás).
  // Antes se usaba el filtro completo: al filtrar por una gasera el desplegable
  // de gasera solo ofrecía esa gasera, y como el desplegable se recarga con
  // los datos ya filtrados, era imposible añadir una segunda -> la selección
  // múltiple con checkbox quedaba inutilizable.
  const opciones = async (dim: Dimension, col: string, excluir?: string[]): Promise<string[]> => {
    const params: unknown[] = [];
    const w = whereGestion(sinDimension(f, dim), params);
    let excluirSql = '';
    if (excluir && excluir.length > 0) {
      const placeholders = excluir.map((_, i) => `$${params.length + i + 1}`).join(',');
      excluirSql = ` AND ${col} NOT IN (${placeholders})`;
      params.push(...excluir);
    }
    const filas = await query<{ v: string }>(
      `SELECT DISTINCT ${col} AS v FROM ${VISTA} WHERE ${col} IS NOT NULL AND ${w}${excluirSql} ORDER BY 1`,
      params,
    );
    return filas.map((r) => r.v);
  };

  // Los meses van en orden natural (ENERO -> DICIEMBRE), no alfabético: con
  // DISTINCT, Postgres exige que la expresión del ORDER BY esté en la lista de
  // resultados, así que aquí se agrupa en vez de usar DISTINCT. Se agrupa por
  // el MES EFECTIVO para que las filas sin MES pero con fecha aparezcan en su
  // mes (si no, filtrar por ese mes las seguiría excluyendo).
  const pMeses: unknown[] = [];
  const filasMeses = await query<{ v: string }>(
    `SELECT (${MES_EFECTIVO_SQL}) AS v FROM ${VISTA} WHERE ${whereGestion(sinDimension(f, 'mes'), pMeses)} GROUP BY 1 ORDER BY ${ORDEN_MES_SQL}`,
    pMeses,
  );

  const meses = filasMeses.map((r) => r.v);
  const gaseras = await opciones('gasera', 'gasera_norm');
  // Excluir "NO APLICA" y "NO APTO" del filtro de aseguradoras (son errores de digitación, no aseguradoras reales)
  const aseguradoras = await opciones('aseguradora', "aseguradora_norm", ['NO APLICA', 'NO APTO']);
  const canales = await opciones('canal', 'canal_norm');
  const cabinas = await opciones('cabina', 'cabina_norm');
  const estados = await opciones('estado', 'estado_norm');
  const clasificaciones = await opciones('clasificacion', 'clasificacion_norm');

  // --- Registros que cumplen todos los filtros --------------------------------
  const pTotal: unknown[] = [];
  const totalFiltrado = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ${VISTA} WHERE ${whereGestion(f, pTotal)}`,
    pTotal,
  );

  return {
    total: Number(total?.n ?? 0),
    totalFiltrado: Number(totalFiltrado?.n ?? 0),
    rangoFechas: { min: rango?.min ?? '2026-01-01', max: rango?.max ?? '2026-12-31' },
    meses,
    gaseras,
    aseguradoras,
    canales,
    cabinas,
    estados,
    clasificaciones,
    porMes: [],
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
  // Sin "mes_norm IS NOT NULL": ninguna fila se pierde del total solo por
  // tener MES vacío; se agrupa por el MES EFECTIVO (respaldo por fecha).
  return query(
    `SELECT (${MES_EFECTIVO_SQL}) AS mes, ${ASEG_CANON} AS aseguradora, COUNT(*)::int AS total
     FROM ${VISTA} WHERE ${w}
     GROUP BY 1, 2
     HAVING COUNT(*) > 0
      ORDER BY ${ORDEN_MES_SQL}, 2`,
    params,
  );
}

// Aptos / No aptos / Retenidos basados en estado_norm.
// GDO normaliza a la forma masculina ('CANCELADO + VENTA'); las demás gaseras
// vienen con la forma femenina ('CANCELADA + VENTA'). Se incluyen ambas para que
// todas las gaseras (incluida GDO, sin modificarla) clasifiquen correctamente.
// Retenidos = Estado IN ('RETENIDO', 'CANCELADO + VENTA', 'CANCELADA + VENTA')
// Aptos = Estado IN ('CANCELADO', 'CANCELADO + REINTEGRO', 'CANCELADO + VENTA', 'CANCELADA + VENTA', 'RETENIDO')
// No Aptos = Todo lo demás (cualquier otro estado o NULL)
// % Retención = Retenidos / Aptos × 100 (misma fórmula para todas las gaseras).
const RETENIDOS_SQL = `(estado_norm IN ('RETENIDO', 'CANCELADO + VENTA', 'CANCELADA + VENTA'))`;
const APTOS_BASE_SQL = `(estado_norm IN ('CANCELADO', 'CANCELADO + REINTEGRO', 'CANCELADO + VENTA', 'CANCELADA + VENTA', 'RETENIDO'))`;
// No Aptos = todo lo que NO es apto. Se resuelve contra el complemento APTOS
// (más los estados NULL) para que Total = Aptos + No Aptos siempre cuadre.
const NO_APTOS_BASE_SQL = `(estado_norm IS NULL OR estado_norm NOT IN ('CANCELADO', 'CANCELADO + REINTEGRO', 'CANCELADO + VENTA', 'CANCELADA + VENTA', 'RETENIDO'))`;

/** ============================================================================
   ESTADOS DE RETENCIÓN — ÚNICA FUENTE DE VERDAD.
   Se usa en: embudo, tendencia, dona. Las cifras siempre cuadran.
   Retenidos = RETENIDO + CANCELADO + VENTA (ambas variantes de género).
   ============================================================================ */
export const ESTADOS_RETENCION = ['RETENIDO', 'CANCELADO + VENTA', 'CANCELADA + VENTA'] as const;
const ESTADOS_RETENCION_SQL = `estado_norm IN ('RETENIDO', 'CANCELADO + VENTA', 'CANCELADA + VENTA')`;

// Aseguradoras que para CEO se consideran NO APTOS aunque tengan estado de apto
const CEO_NO_APTOS_ASEG = `('GNP', 'PROEXEQUIAL', 'IKE')`;

// Genera el SQL de APTOS considerando la gasera CEO
function getAptosSql(f: Filtros): string {
  // Si se filtra por gasera CEO, excluimos las aseguradoras GNP, PROEXEQUIAL, IKE de los aptos
  const gaseras = (f.gasera ?? []).map(g => g.trim().toUpperCase());
  if (gaseras.length === 1 && gaseras[0] === 'CEO') {
    return `(${APTOS_BASE_SQL} AND (aseguradora_norm IS NULL OR aseguradora_norm NOT IN ${CEO_NO_APTOS_ASEG}))`;
  }
  // Si no hay filtro de gasera o hay múltiples, no aplicamos la regla especial
  // (la regla solo aplica cuando se filtra específicamente por CEO)
  return APTOS_BASE_SQL;
}

// Genera el SQL de NO_APTOS considerando la gasera CEO
function getNoAptosSql(f: Filtros): string {
  const gaseras = (f.gasera ?? []).map(g => g.trim().toUpperCase());
  if (gaseras.length === 1 && gaseras[0] === 'CEO') {
    // No aptos = (no aptos base) OR (aptos base pero aseguradora en CEO_NO_APTOS_ASEG)
    return `(${NO_APTOS_BASE_SQL} OR (${APTOS_BASE_SQL} AND aseguradora_norm IN ${CEO_NO_APTOS_ASEG}))`;
  }
  return `(${NO_APTOS_BASE_SQL})`;
}

export interface FilaResultadoMensual {
  resultado: string;
  mes: string;
  total: number;
}

export async function getResultadosPorMes(f: Filtros, esApto: boolean): Promise<FilaResultadoMensual[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const aptosSql = getAptosSql(f);
  const noAptosSql = getNoAptosSql(f);
  const condicion = esApto ? aptosSql : noAptosSql;
  // Sin "mes_norm IS NOT NULL": se agrupa por MES EFECTIVO para no perder
  // filas con MES vacío (TOTAL del Excel debe cuadrar).
  return query(
    `SELECT estado_norm AS resultado, (${MES_EFECTIVO_SQL}) AS mes, COUNT(*)::int AS total
     FROM ${VISTA} WHERE ${w} AND ${condicion}
     GROUP BY estado_norm, (${MES_EFECTIVO_SQL})
     ORDER BY estado_norm, ${ORDEN_MES_SQL}`,
    params,
  );
}

export interface FilaDetalleResultadoMensual {
  estado: string;
  mes: string;
  total: number;
}

// Detalle resultado × mes con el estado como dimensión (tablas "Resultado por
// mes" del detalle de gestión, al estilo del reporte de GasCaribe).
export async function getDetalleResultadosMensual(f: Filtros, esApto: boolean): Promise<FilaDetalleResultadoMensual[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const condicion = esApto ? getAptosSql(f) : getNoAptosSql(f);
  // Sin "mes_norm IS NOT NULL": MES EFECTIVO (respaldo por fecha) para que
  // ninguna fila falte del total.
  return query<FilaDetalleResultadoMensual>(
    `SELECT COALESCE(estado_norm, 'SIN DATO') AS estado, (${MES_EFECTIVO_SQL}) AS mes, COUNT(*)::int AS total
     FROM ${VISTA} WHERE ${w} AND ${condicion}
     GROUP BY 1, 2
     ORDER BY 1, ${ORDEN_MES_SQL}`,
    params,
  );
}

export interface FilaDashboardMensual {
  mes: string;
  total: number;
  inbound: number;
  outbound: number;
  retenidos: number;
  aptos: number;
  noAptos: number;
  pct: number;
  // Desglose por cabina (para el embudo y la tabla "Detalle por cabina")
  inboundAptas: number;
  inboundNoAptas: number;
  inboundRetenciones: number;
  outboundAptas: number;
  outboundNoAptas: number;
  outboundRetenciones: number;
}

export async function getDashboardMensual(f: Filtros): Promise<FilaDashboardMensual[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const aptosSql = getAptosSql(f);
  const noAptosSql = getNoAptosSql(f);
  const rows = await query<any>(
    `SELECT (${MES_EFECTIVO_SQL}) AS mes, COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND')::int AS inbound,
      COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND')::int AS outbound,
      COUNT(*) FILTER (WHERE ${RETENIDOS_SQL})::int AS retenidos,
      COUNT(*) FILTER (WHERE ${aptosSql})::int AS aptos,
      COUNT(*) FILTER (WHERE ${noAptosSql})::int AS no_aptos,
      COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND' AND ${aptosSql})::int AS inbound_aptas,
      COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND' AND ${noAptosSql})::int AS inbound_no_aptas,
      COUNT(*) FILTER (WHERE cabina_norm = 'INBOUND' AND ${RETENIDOS_SQL})::int AS inbound_retenciones,
      COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND' AND ${aptosSql})::int AS outbound_aptas,
      COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND' AND ${noAptosSql})::int AS outbound_no_aptas,
      COUNT(*) FILTER (WHERE cabina_norm = 'OUTBOUND' AND ${RETENIDOS_SQL})::int AS outbound_retenciones
     FROM ${VISTA} WHERE ${w} GROUP BY 1 ORDER BY ${ORDEN_MES_SQL}`,
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
      inboundAptas: Number(r.inbound_aptas ?? 0),
      inboundNoAptas: Number(r.inbound_no_aptas ?? 0),
      inboundRetenciones: Number(r.inbound_retenciones ?? 0),
      outboundAptas: Number(r.outbound_aptas ?? 0),
      outboundNoAptas: Number(r.outbound_no_aptas ?? 0),
      outboundRetenciones: Number(r.outbound_retenciones ?? 0),
    };
  });
}

// ============================================================================
// NUEVAS FUNCIONES DE DATOS (FASE 0.2) — agregaciones puras para las vistas
// de análisis. Todas aplican el filtro de cabina y demás filtros globales
// a través de whereGestion. Los gráficos solo pintan; no calculan nada.
// ============================================================================

export interface FilaRetenidoMes { periodo: string; retenidos: number; }

/** Retenciones por mes (periodo), ordenado cronológicamente. */
export async function getRetenidosPorMes(f: Filtros): Promise<FilaRetenidoMes[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const rows = await query<{ mes: string; anio: number | null; retenidos: number }>(
    `SELECT (${MES_EFECTIVO_SQL}) AS mes,
            EXTRACT(YEAR FROM fecha_ejecucion)::int AS anio,
            COUNT(*)::int AS retenidos
     FROM ${VISTA} WHERE ${w} AND ${ESTADOS_RETENCION_SQL}
     GROUP BY 1, 2
     ORDER BY 2, ${ORDEN_MES_SQL}`,
    params,
  );
  // Detectar si hay más de un año distinto para decidir el formato del eje.
  const anos = new Set(rows.map((r) => r.anio).filter((a): a is number => a != null && Number.isFinite(a)));
  const multiAnio = anos.size > 1;
  const NOMBRE_MES: Record<string, string> = {
    ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May', JUNIO: 'Jun',
    JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct', NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic',
    'SIN MES': 'Sin mes',
  };
  return rows.map((r) => {
    const nombre = NOMBRE_MES[r.mes] ?? r.mes;
    const periodo = multiAnio && r.anio != null ? `${nombre} ${r.anio}` : nombre;
    return { periodo, retenidos: Number(r.retenidos ?? 0) };
  });
}

export interface FilaRetenidoMesCabina { periodo: string; cabina: string; retenidos: number; }

/** Retenciones por mes y cabina (INBOUND/OUTBOUND), ordenado cronológicamente. */
export async function getRetenidosPorMesCabina(f: Filtros): Promise<FilaRetenidoMesCabina[]> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const rows = await query<{ mes: string; anio: number | null; cabina: string; retenidos: number }>(
    `SELECT (${MES_EFECTIVO_SQL}) AS mes,
            EXTRACT(YEAR FROM fecha_ejecucion)::int AS anio,
            cabina_norm AS cabina,
            COUNT(*)::int AS retenidos
     FROM ${VISTA} WHERE ${w} AND ${ESTADOS_RETENCION_SQL} AND cabina_norm IN ('INBOUND','OUTBOUND')
     GROUP BY 1, 2, 3
     ORDER BY 2, ${ORDEN_MES_SQL}, 3`,
    params,
  );
  const anos = new Set(rows.map((r) => r.anio).filter((a): a is number => a != null && Number.isFinite(a)));
  const multiAnio = anos.size > 1;
  const NOMBRE_MES: Record<string, string> = {
    ENERO: 'Ene', FEBRERO: 'Feb', MARZO: 'Mar', ABRIL: 'Abr', MAYO: 'May', JUNIO: 'Jun',
    JULIO: 'Jul', AGOSTO: 'Ago', SEPTIEMBRE: 'Sep', OCTUBRE: 'Oct', NOVIEMBRE: 'Nov', DICIEMBRE: 'Dic',
    'SIN MES': 'Sin mes',
  };
  return rows.map((r) => {
    const nombre = NOMBRE_MES[r.mes] ?? r.mes;
    const periodo = multiAnio && r.anio != null ? `${nombre} ${r.anio}` : nombre;
    return { periodo, cabina: r.cabina, retenidos: Number(r.retenidos ?? 0) };
  });
}

export interface ResultadoRetencion { retenido: number; canceladoVenta: number; total: number; }

/** RETENIDO vs CANCELADO + VENTA (total = retenciones del embudo). */
export async function getResultadosRetencion(f: Filtros): Promise<ResultadoRetencion> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const filas = await query<{ resultado: string; n: number }>(
    `SELECT estado_norm AS resultado, COUNT(*)::int AS n
     FROM ${VISTA} WHERE ${w} AND ${ESTADOS_RETENCION_SQL}
     GROUP BY estado_norm`,
    params,
  );
  let retenido = 0;
  let canceladoVenta = 0;
  for (const r of filas) {
    const n = Number(r.n ?? 0);
    if (r.resultado === 'RETENIDO') retenido = n;
    else if (r.resultado === 'CANCELADO + VENTA' || r.resultado === 'CANCELADA + VENTA') canceladoVenta += n;
  }
  return { retenido, canceladoVenta, total: retenido + canceladoVenta };
}

export interface ItemConCasos { nombre: string; casos: number; }

export interface RankingConTotal { items: ItemConCasos[]; total: number; }

/** Solicitudes por producto, ordenadas de mayor a menor, con total general. */
export async function getSolicitudesPorProducto(f: Filtros): Promise<RankingConTotal> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const filas = await query<{ nombre: string; casos: number }>(
    `SELECT producto AS nombre, COUNT(*)::int AS casos
     FROM ${VISTA} WHERE ${w} AND producto IS NOT NULL AND TRIM(producto) <> ''
     GROUP BY producto
     ORDER BY casos DESC, nombre ASC`,
    params,
  );
  const items = filas.map((r) => ({ nombre: r.nombre, casos: Number(r.casos ?? 0) }));
  const total = items.reduce((s, i) => s + i.casos, 0);
  return { items, total };
}

/** Motivos de cancelación, ordenados de mayor a menor, con total. */
export async function getMotivosCancelacion(f: Filtros): Promise<RankingConTotal> {
  const params: unknown[] = [];
  const w = whereGestion(f, params);
  const filas = await query<{ nombre: string; casos: number }>(
    `SELECT motivo AS nombre, COUNT(*)::int AS casos
     FROM ${VISTA} WHERE ${w} AND motivo IS NOT NULL AND TRIM(motivo) <> ''
     GROUP BY motivo
     ORDER BY casos DESC, nombre ASC`,
    params,
  );
  const items = filas.map((r) => ({ nombre: r.nombre, casos: Number(r.casos ?? 0) }));
  const total = items.reduce((s, i) => s + i.casos, 0);
  return { items, total };
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

// Datos “calientes” (resultados de consultas de páginas): viven 10 s como máximo.
// Así, tras recargar la DB, el front refleja los cambios casi al instante y la
// DB compartida no recibe más consultas de las necesarias.
export const SSR_TTL_MS = 10_000;

export async function cargaSSR<T>(clave: string, promesa: Promise<T>, fallback: T, ttlMs = SSR_TTL_MS): Promise<T> {
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
