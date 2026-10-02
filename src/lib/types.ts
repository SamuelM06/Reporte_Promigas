// Tipos compartidos entre el backend (endpoints) y el frontend (islas React).

export interface Filters {
  contrato?: string;
  desde?: string;   // YYYY-MM-DD
  hasta?: string;   // YYYY-MM-DD
  mes?: string;     // YYYY-MM (tiene prioridad sobre desde/hasta)
  gasera?: string[];          // selección múltiple (vacío/ausente = Todos)
  producto?: string[];        // selección múltiple (vacío/ausente = Todos)
  anio?: string;       // YYYY (vista de estatus)
  estado?: string[];          // selección múltiple (vacío/ausente = Todos)
  aseguradora?: string[];     // selección múltiple (vacío/ausente = Todos)
  tipo_siniestro?: string[];  // selección múltiple (vacío/ausente = Todos)
  clase?: string[];           // Deudor | Microseguros | Salvafactura | Otros (vacío/ausente = Todas)
}

export interface KpisData {
  total: number;
  pagados: number;
  objetados: number;
  solicitudDocs: number;
  enTramite: number;
  totalPagado: number;
  sinEstado: number;
  comparativo: {
    total2025: number;
    total2026: number;
    deltaPct: number;
  };
}

export interface PuntoTendencia {
  mes: string;      // YYYY-MM (modo mes) o YYYY-MM-DD (modo día, filtro mes activo)
  label: string;
  total: number;
  valorPagado: number;
  dia?: number;     // 1..31 presente SOLO en modo día (filtro mes activo)
}

export interface SerieAseguradora {
  mes: string;
  label: string;
  porAseguradora: Record<string, number>;
}

export interface ItemGasera {
  gasera: string;
  total: number;
}

export interface ItemProducto {
  producto: string;
  total: number;
}

export interface ItemTipoSiniestro {
  tipo_siniestro: string;
  total: number;
}

export interface ItemDona {
  nombre: string;
  total: number;
}

export interface RegistroTabla {
  id_caso: number;
  numero_contrato: string | null;
  nombre_asegurado: string | null;
  aseguradora: string;
  gasera: string;
  producto: string;
  clase: string;
  estado: string;
  fecha_radicacion: string | null;
  monto: number | null;
}

export interface PaginaTabla {
  registros: RegistroTabla[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Metadatos {
  anios: number[];
  rangoFechas: { min: string | null; max: string | null };
  gaseras: string[];
  productos: string[];
  estados: { estado: string; total: number }[];
  aseguradoras: string[];
  tipos_siniestro: { tipo_siniestro: string; total: number }[];
  clases: string[];
}

export interface FilaEstatus {
  gasera: string;
  estado: string;
  mes: number;   // 1..12
  total: number;
}

export interface EstatusData {
  anio: number;
  gaseras: string[];
  estados: string[];
  filas: FilaEstatus[];
}

export interface DashboardData {
  kpis: KpisData;
  tendencia: PuntoTendencia[];
  porAseguradora: SerieAseguradora[];
  porGasera: ItemGasera[];
  porProducto: ItemProducto[];
  porTipoSiniestro: ItemTipoSiniestro[];
  metadatos: Metadatos;
}

export interface AnioHist {
  anio: number;
  total: number;
  pagados: number;
  objetados: number;
  porcPagado: number;
  totalPagado: number;
}

export interface SerieMensualAnio {
  anio: number;
  // 12 posiciones (índice 0 = enero). `null` = mes sin dato (año parcial en
  // curso); `0` = mes con dato pero sin casos.
  meses: (number | null)[];
}

// Punto de la tendencia mensual agregada de la vista Históricos:
// totales de todos los años (o del año filtrado) por mes calendario.
export interface PuntoMesHist {
  mes: number;      // 1..12 (modo mes) o día 1..31 (modo día, filtro mes activo)
  label: string;    // Ene..Dic o número de día
  total: number;
  valorPagado: number;
  dia?: number;     // 1..31 presente SOLO en modo día (filtro mes activo)
}

export interface HistoricosData {
  anios: AnioHist[];
  mensual: SerieMensualAnio[];
  tendencia: PuntoMesHist[];
  sinFecha: number;
}

export interface RespuestaError {
  error: string;
}

export interface ItemMunicipio {
  municipio: string;
  total: number;
  pagado: number;
}

export interface ItemDepartamento {
  departamento: string;
  total: number;
  pagados: number;
  enTramite: number;
  objetados: number;
  totalPagado: number;
  municipios: ItemMunicipio[];
}

export interface MapaData {
  totalNacional: number;
  totalPagadoNacional: number;
  departamentos: ItemDepartamento[];
}

// ---- Vista Proyección (forecast 2027) --------------------------------------
// Pronóstico mensual con intervalo de predicción 80% (low/high).
export interface PuntoForecast {
  mes: number; // 1..12
  label: string; // Ene..Dic
  siniestros: number;
  sinLow: number;
  sinHigh: number;
  monto: number;
  montoLow: number;
  montoHigh: number;
  refAnioPrevio: number; // real del mismo mes en el último año cerrado
  proyectado?: boolean;  // true = valor proyectado; false/ausente = real observado
}

// Índice estacional: 1 = mes promedio; 1.4 = 40% sobre el promedio.
export interface IndiceEstacional {
  mes: number;
  label: string;
  indice: number;
  low: number;
  high: number;
}

// Probabilidad categórica (departamento / tipo): Laplace + IC Wilson 95%.
export interface ProbItem {
  nombre: string;
  casos: number;
  prob: number; // 0..1
  low: number;
  high: number;
}

export interface TendenciaProy {
  pendienteAnual: number; // siniestros/año (Theil-Sen)
  pValue: number; // Mann-Kendall bilateral
  significante: boolean; // p < 0.05
  direccion: 'alza' | 'baja' | 'estable';
  totalProyAnual: number;
  montoProyAnual: number;
  crecimientoVsPrevio: number; // % vs último año cerrado
}

export interface BacktestInfo {
  mape: number | null; // MAPE mensual % (null si no hay historia)
  confiable: boolean; // mape !== null && mape <= 25
  detalle: { anio: number; real: number; pron: number; errAnualPct: number }[];
}

export interface CambioEstructural {
  dimension: string;
  pValue: number;
  hayCambio: boolean; // p < 0.05
}

export interface ProyeccionData {
  anioObjetivo: number;
  aniosEntrenamiento: number[];
  forecast: PuntoForecast[];
  forecast2026: PuntoForecast[]; // 12 meses de cierre 2026: real hasta último mes observado + proyectado
  estacionalidad: IndiceEstacional[];
  tendencia: TendenciaProy;
  departamentos: ProbItem[];
  tiposSiniestro: ProbItem[];
  backtest: BacktestInfo;
  cambios: CambioEstructural[];
  supuestos: string[];
}
