// Paleta de gráficos derivada de la marca Xuma (azules + verdes + apoyo).
// Usa variables CSS para adaptarse al tema claro/oscuro: en claro son tonos
// más saturados y con contraste legible sobre fondo claro.
export const CHART_COLORS = [
  'var(--cgraf-1)', // verde claro
  'var(--cgraf-2)', // verde oscuro
  'var(--cgraf-3)', // violeta apoyo
  'var(--cgraf-4)', // azul profundo 2
  'var(--cgraf-5)', // ámbar apoyo
  'var(--cgraf-6)', // coral apoyo
  'var(--cgraf-7)', // cian apoyo
  'var(--cgraf-8)', // lavanda apoyo
];

// Color genérico para categorías agregadas (Ej. "Otros").
export const COLOR_OTROS = 'var(--cgraf-otro)';

// Color del total (se adapta al tema: texto principal).
export const COLOR_TOTAL = 'var(--ctinta)';

// Estilo del tooltip: variables CSS (se adaptan a claro/oscuro).
export const GLASS_TOOLTIP = {
  background: 'var(--qtooltip-fondo)',
  border: '1px solid var(--qtooltip-borde)',
  borderRadius: 14,
  color: 'var(--qtooltip-tinta)',
  boxShadow: 'var(--qtooltip-sombra)',
  fontSize: 13,
  fontFamily: "'Raleway', sans-serif",
} as const;

// Tick del eje Y (categorías) alineado a la izquierda y con mayor tamaño,
// para que los nombres de gaseras/aseguradoras se lean completos y grandes.
export function EjeIzquierdoTick({ y, payload }: { y?: number; payload?: { value?: string } }) {
  return (
    <text x={6} y={y} textAnchor="start" dominantBaseline="central" fill="var(--ctinta)" fontSize={12} fontWeight={700}>
      {payload?.value}
    </text>
  );
}