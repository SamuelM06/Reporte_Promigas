// ============================================================================
// CONFIGURACIÓN CENTRALIZADA DE COLORES DE KPI
// Cambia aquí y se refleja en Dashboard, Detalle, globales y gráficos.
// ============================================================================

export type KpiKey =
  | 'total'
  | 'inbound'
  | 'outbound'
  | 'aptos'
  | 'noAptos'
  | 'retenciones'
  | 'pctRetencion';

export interface KpiColorDef {
  /** Clase CSS del chip/halo: kpi-<nombre> */
  chip: string;
  /** Clase CSS para el número: text-<color> */
  numClass: string;
  /** Gradiente del icono */
  icoGradient: string;
  /** Color del glow/halo (rgba) */
  glowRgba: string;
  /** Color del glow en dark (rgba) */
  glowRgbaDark: string;
  /** Clase mini-KPI: mk-<nombre> */
  miniCls: string;
  /** Color tabla header (--thc) */
  thColor: string;
  /** Color tabla celda background */
  tdBgColor: string;
  /** Color texto tabla celda (opcional) */
  tdTextColor?: string;
  /** Color número global (.num-<nombre>) */
  numColor: string;
  numColorDark: string;
}

export const KPI_COLORS: Record<KpiKey, KpiColorDef> = {
  total: {
    chip: 'kpi-azul',
    numClass: 'text-tinta',
    icoGradient: 'linear-gradient(135deg,#120180,#3d22c8)',
    glowRgba: 'rgba(18,1,128,.35)',
    glowRgbaDark: 'rgba(106,79,216,.6)',
    miniCls: 'mk-azul',
    thColor: '#120180',
    tdBgColor: '#3d22c8',
    numColor: '#1e3a8a',
    numColorDark: '#b8c0ff',
  },
  inbound: {
    chip: 'kpi-verde',
    numClass: 'text-xuma-verde-oscuro',
    icoGradient: 'linear-gradient(135deg,#00cd93,#5ae280)',
    glowRgba: 'rgba(0,205,147,.4)',
    glowRgbaDark: 'rgba(0,205,147,.6)',
    miniCls: 'mk-verde',
    thColor: '#00cd93',
    tdBgColor: '#00cd93',
    numColor: '#15803d',
    numColorDark: '#7df0a0',
  },
  outbound: {
    chip: 'kpi-gris-oscuro',
    numClass: 'text-slate-700 dark:text-slate-400',
    icoGradient: 'linear-gradient(135deg,#334155,#64748b)',
    glowRgba: 'rgba(51,65,85,.4)',
    glowRgbaDark: 'rgba(100,116,139,.6)',
    miniCls: 'mk-gris-oscuro',
    thColor: '#475569',
    tdBgColor: '#475569',
    numColor: '#334155',
    numColorDark: '#94a3b8',
  },
  aptos: {
    chip: 'kpi-teal',
    numClass: 'text-teal-600',
    icoGradient: 'linear-gradient(135deg,#0d9488,#2dd4bf)',
    glowRgba: 'rgba(45,212,191,.4)',
    glowRgbaDark: 'rgba(45,212,191,.6)',
    miniCls: 'mk-teal',
    thColor: '#0d9488',
    tdBgColor: '#0d9488',
    numColor: '#0f766e',
    numColorDark: '#63e2b9',
  },
  // SWAP: Total No Aptos ahora usa el rojo/rosa
  noAptos: {
    chip: 'kpi-rosa',
    numClass: 'text-rose-500',
    icoGradient: 'linear-gradient(135deg,#f43f5e,#fb7185)',
    glowRgba: 'rgba(244,63,94,.4)',
    glowRgbaDark: 'rgba(244,63,94,.6)',
    miniCls: 'mk-rosa',
    thColor: '#f43f5e',
    tdBgColor: '#f43f5e',
    tdTextColor: '#fff',
    numColor: '#be123c',
    numColorDark: '#fb7185',
  },
  // SWAP: % Retención ahora usa el gris
  retenciones: {
    chip: 'kpi-azul-claro',
    numClass: 'text-blue-700 dark:text-blue-300',
    icoGradient: 'linear-gradient(135deg,#1e40af,#60a5fa)',
    glowRgba: 'rgba(37,99,235,.4)',
    glowRgbaDark: 'rgba(96,165,250,.6)',
    miniCls: 'mk-azul-claro',
    thColor: '#2563eb',
    tdBgColor: '#2563eb',
    tdTextColor: '#fff',
    numColor: '#1d4ed8',
    numColorDark: '#93c5fd',
  },
  pctRetencion: {
    chip: 'kpi-gris',
    numClass: 'text-slate-500',
    icoGradient: 'linear-gradient(135deg,#475569,#94a3b8)',
    glowRgba: 'rgba(148,163,184,.4)',
    glowRgbaDark: 'rgba(148,163,184,.6)',
    miniCls: 'mk-gris',
    thColor: '#64748b',
    tdBgColor: '#64748b',
    numColor: '#475569',
    numColorDark: '#94a3b8',
  },
};

// Helper para obtener definición por clave
export function getKpiColor(key: KpiKey): KpiColorDef {
  return KPI_COLORS[key];
}

// Helper para obtener todas las claves
export const KPI_KEYS: KpiKey[] = [
  'total',
  'inbound',
  'outbound',
  'aptos',
  'noAptos',
  'retenciones',
  'pctRetencion',
];