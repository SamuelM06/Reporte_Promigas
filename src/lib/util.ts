// Utilidades de formato y cálculos compartidas por todas las vistas.
// Todo sale de los datos; nada hardcodeado.

// Número entero con formato es-CO (ej. 5.019). Protegido contra 0 / NaN.
export function fmtInt(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('es-CO').format(Math.trunc(n));
}

// Porcentaje con 1 decimal y espacio antes del % (ej. "79,4 %"). Protegido contra 0.
export function fmtPct(v: unknown): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return '0,0 %';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n) + ' %';
}

// Porcentaje de parte sobre total, protegido contra división por 0.
export function pct(parte: unknown, total: unknown): number {
  const p = Number(parte ?? 0);
  const t = Number(total ?? 0);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return (p / t) * 100;
}

// Redondeo seguro a 1 decimal para mostrar.
export function round1(v: unknown): number {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}
