// ============================================================================
// Motor estadístico PURO de la vista Proyección (sin BD, sin fechas, sin DOM).
// Métodos transparentes y auditables para series cortas (8 años cerrados):
// - Forecast: seasonal-naive proporcional + drift lineal (Theil-Sen).
// - Intervalos 80%: bandas multiplicativas desde residuos relativos pooled.
// - Tendencia: pendiente Theil-Sen + test Mann-Kendall (aprox. normal).
// - Proporciones: frecuencias empíricas + suavizado Laplace + IC Wilson 95%.
// - Cambio estructural: chi-cuadrado de homogeneidad (temprano vs reciente).
// - Backtesting walk-forward: entrena con años previos, predice 2024 y 2025.
// Todas las funciones son determinísticas y testeables en aislamiento.
// ============================================================================

export function media(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

export function mediana(xs: number[]): number {
  if (xs.length === 0) return 0;
  const ord = [...xs].sort((a, b) => a - b);
  const n = ord.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return ord[mid] ?? 0;
  return ((ord[mid - 1] ?? 0) + (ord[mid] ?? 0)) / 2;
}

// Percentil p (0..1) con interpolación lineal. Vacío → 0.
export function percentil(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const ord = [...xs].sort((a, b) => a - b);
  const pos = Math.min(1, Math.max(0, p)) * (ord.length - 1);
  const base = Math.floor(pos);
  const resto = pos - base;
  const a = ord[base] ?? 0;
  const b = ord[Math.min(base + 1, ord.length - 1)] ?? a;
  return a + (b - a) * resto;
}

// Pendiente robusta Theil-Sen: mediana de todas las pendientes pairwise.
// Con <2 puntos devuelve 0 (sin drift).
export function theilSen(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  const pendientes: number[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = (x[j] ?? 0) - (x[i] ?? 0);
      if (dx !== 0) pendientes.push(((y[j] ?? 0) - (y[i] ?? 0)) / dx);
    }
  }
  return mediana(pendientes);
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-x * x);
  return x < 0 ? -y : y;
}

export function normCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Test Mann-Kendall de tendencia monótona sobre una serie ordenada en el
// tiempo. Devuelve el estadístico S y el p-valor bilateral (aprox. normal con
// corrección de empates y de continuidad).
export function mannKendall(vals: number[]): { s: number; p: number } {
  const n = vals.length;
  if (n < 3) return { s: 0, p: 1 };
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = (vals[j] ?? 0) - (vals[i] ?? 0);
      s += d > 0 ? 1 : d < 0 ? -1 : 0;
    }
  }
  // Corrección por empates: grupos de valores iguales de tamaño t.
  const frec = new Map<number, number>();
  for (const v of vals) frec.set(v, (frec.get(v) ?? 0) + 1);
  let empates = 0;
  for (const t of frec.values()) empates += t * (t - 1) * (2 * t + 5);
  const varianza = (n * (n - 1) * (2 * n + 5) - empates) / 18;
  if (varianza <= 0) return { s, p: 1 };
  const z = s > 0 ? (s - 1) / Math.sqrt(varianza) : s < 0 ? (s + 1) / Math.sqrt(varianza) : 0;
  return { s, p: 2 * (1 - normCDF(Math.abs(z))) };
}

// Intervalo de Wilson (95%) para una proporción n/N.
export function wilson(n: number, N: number, z = 1.96): { p: number; low: number; high: number } {
  if (N <= 0) return { p: 0, low: 0, high: 0 };
  const p = Math.min(1, Math.max(0, n / N));
  const den = 1 + (z * z) / N;
  const centro = (p + (z * z) / (2 * N)) / den;
  const radio = (z * Math.sqrt((p * (1 - p)) / N + (z * z) / (4 * N * N))) / den;
  return { p, low: Math.max(0, centro - radio), high: Math.min(1, centro + radio) };
}

// Probabilidades suavizadas Laplace (add-1): nunca hay ceros duros.
export function laplace(conteos: number[]): number[] {
  const total = conteos.reduce((s, c) => s + c, 0);
  const k = conteos.length;
  if (k === 0 || total + k <= 0) return conteos.map(() => 0);
  return conteos.map((c) => (c + 1) / (total + k));
}

// --- Chi-cuadrado de homogeneidad -------------------------------------------
// Compara dos vectores de conteos alineados (misma longitud, unión de
// categorías). Devuelve p-valor vía gamma regularizada superior Q(a, x).

function gammln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032961677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = xx;
  let tmp = xx + 5.5;
  tmp -= (xx + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j += 1) {
    y += 1;
    ser += (cof[j] ?? 0) / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / xx);
}

function gser(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  const gln = gammln(a);
  let ap = a;
  let del = 1 / a;
  let sum = del;
  for (let n = 1; n <= ITMAX; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

function gcf(a: number, x: number): number {
  const ITMAX = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-300;
  const gln = gammln(a);
  let b = x + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= ITMAX; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

// Q(a, x): probabilidad de que una Gamma(a,1) supere x.
export function gammaQ(a: number, x: number): number {
  if (a <= 0 || x < 0 || !Number.isFinite(a) || !Number.isFinite(x)) return NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - gser(a, x);
  return gcf(a, x);
}

export function chiCuadradoP(a: number[], b: number[]): { chi2: number; df: number; p: number } {
  const pares: [number, number][] = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x + y > 0) pares.push([x, y]);
  }
  const df = pares.length - 1;
  if (df <= 0) return { chi2: 0, df: 0, p: 1 };
  const tA = pares.reduce((s, [x]) => s + x, 0);
  const tB = pares.reduce((s, [, y]) => s + y, 0);
  const T = tA + tB;
  if (T <= 0) return { chi2: 0, df, p: 1 };
  let chi2 = 0;
  for (const [x, y] of pares) {
    const eA = (tA * (x + y)) / T;
    const eB = (tB * (x + y)) / T;
    if (eA > 0) chi2 += ((x - eA) * (x - eA)) / eA;
    if (eB > 0) chi2 += ((y - eB) * (y - eB)) / eB;
  }
  const p = gammaQ(df / 2, chi2 / 2);
  return { chi2, df, p: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 1 };
}

// --- Forecast mensual -------------------------------------------------------

export interface MesEntrenamiento {
  anio: number;
  mes: number; // 1..12
  total: number; // siniestros del mes
  valor: number; // dinero pagado del mes
}

export interface PronosticoMes {
  mes: number;
  siniestros: number;
  sinLow: number;
  sinHigh: number;
  monto: number;
  montoLow: number;
  montoHigh: number;
}

function anualPor(mapa: Map<number, number>, anio: number): number {
  return mapa.get(anio) ?? 0;
}

// Seasonal-naive proporcional + drift Theil-Sen:
// 1. Total anual objetivo = último año + pendiente × pasos.
// 2. Se reparte por mes según la participación histórica de cada mes.
// 3. Bandas 80%: residuos relativos pooled (p10/p90) como factor multiplicativo.
export function pronosticar(filas: MesEntrenamiento[], anioObjetivo: number): PronosticoMes[] {
  const anios = [...new Set(filas.map((f) => f.anio))].sort((a, b) => a - b);
  const vacio: PronosticoMes[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, siniestros: 0, sinLow: 0, sinHigh: 0, monto: 0, montoLow: 0, montoHigh: 0,
  }));
  if (anios.length === 0) return vacio;

  const anualSin = new Map<number, number>();
  const anualVal = new Map<number, number>();
  const mesSin = new Map<number, number>();
  const mesVal = new Map<number, number>();
  for (const f of filas) {
    anualSin.set(f.anio, (anualSin.get(f.anio) ?? 0) + f.total);
    anualVal.set(f.anio, (anualVal.get(f.anio) ?? 0) + f.valor);
    mesSin.set(f.mes, (mesSin.get(f.mes) ?? 0) + f.total);
    mesVal.set(f.mes, (mesVal.get(f.mes) ?? 0) + f.valor);
  }
  const anuales = anios.map((y) => anualPor(anualSin, y));
  const anualesV = anios.map((y) => anualPor(anualVal, y));
  const ultimo = anios[anios.length - 1] ?? anioObjetivo;
  const pasos = Math.max(0, anioObjetivo - ultimo);

  const pendSin = theilSen(anios, anuales);
  const pendVal = theilSen(anios, anualesV);
  const totalObj = Math.max(0, Math.round((anuales[anuales.length - 1] ?? 0) + pendSin * pasos));
  const valorObj = Math.max(0, Math.round((anualesV[anualesV.length - 1] ?? 0) + pendVal * pasos));

  const granSin = anuales.reduce((s, v) => s + v, 0);
  const granVal = anualesV.reduce((s, v) => s + v, 0);

  // Residuos relativos pooled (estable con n pequeño).
  const resSin: number[] = [];
  const resVal: number[] = [];
  for (const f of filas) {
    const espS = anualPor(anualSin, f.anio) * ((mesSin.get(f.mes) ?? 0) / (granSin || 1));
    const espV = anualPor(anualVal, f.anio) * ((mesVal.get(f.mes) ?? 0) / (granVal || 1));
    if (espS > 0) resSin.push(f.total / espS - 1);
    if (espV > 0) resVal.push(f.valor / espV - 1);
  }
  const bSinLow = 1 + percentil(resSin, 0.1);
  const bSinHigh = 1 + percentil(resSin, 0.9);
  const bValLow = 1 + percentil(resVal, 0.1);
  const bValHigh = 1 + percentil(resVal, 0.9);

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const shareS = granSin > 0 ? (mesSin.get(m) ?? 0) / granSin : 1 / 12;
    const shareV = granVal > 0 ? (mesVal.get(m) ?? 0) / granVal : 1 / 12;
    const s = Math.round(totalObj * shareS);
    const v = Math.round(valorObj * shareV);
    return {
      mes: m,
      siniestros: s,
      sinLow: Math.max(0, Math.round(s * bSinLow)),
      sinHigh: Math.round(s * bSinHigh),
      monto: v,
      montoLow: Math.max(0, Math.round(v * bValLow)),
      montoHigh: Math.round(v * bValHigh),
    };
  });
}

// --- Índices estacionales ---------------------------------------------------
// indice[m] = media del mes / (media anual / 12). 1 = mes promedio; 1.4 = 40%
// por encima del promedio. Bandas p10/p90 entre años.

export interface IndiceMes {
  mes: number;
  indice: number;
  low: number;
  high: number;
}

export function indicesEstacionales(filas: MesEntrenamiento[]): IndiceMes[] {
  const porAnio = new Map<number, Map<number, number>>();
  for (const f of filas) {
    if (!porAnio.has(f.anio)) porAnio.set(f.anio, new Map());
    porAnio.get(f.anio)?.set(f.mes, f.total);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const vals: number[] = [];
    for (const meses of porAnio.values()) {
      const anual = [...meses.values()].reduce((s, v) => s + v, 0);
      if (anual > 0) vals.push((meses.get(m) ?? 0) / (anual / 12));
    }
    const ind = vals.length > 0 ? media(vals) : 1;
    return {
      mes: m,
      indice: Math.round(ind * 100) / 100,
      low: vals.length > 0 ? Math.round(percentil(vals, 0.1) * 100) / 100 : 1,
      high: vals.length > 0 ? Math.round(percentil(vals, 0.9) * 100) / 100 : 1,
    };
  });
}

// --- Distribuciones categóricas ----------------------------------------------

export interface ProbCat {
  nombre: string;
  casos: number;
  prob: number; // suavizada Laplace (0..1)
  low: number; // Wilson 95%
  high: number; // Wilson 95%
}

export function distribucion(conteos: { nombre: string; casos: number }[]): ProbCat[] {
  const N = conteos.reduce((s, c) => s + c.casos, 0);
  const K = conteos.length;
  return conteos
    .map((c) => {
      const w = wilson(c.casos, N);
      return {
        nombre: c.nombre,
        casos: c.casos,
        prob: N + K > 0 ? (c.casos + 1) / (N + K) : 0,
        low: w.low,
        high: w.high,
      };
    })
    .sort((a, b) => b.prob - a.prob);
}

// --- Backtesting walk-forward ------------------------------------------------
// Entrena solo con años < t y predice t. MAPE mensual + error anual.

export interface BacktestDetalle {
  anio: number;
  real: number;
  pron: number;
  errAnualPct: number;
}

export interface BacktestResultado {
  mape: number | null; // MAPE mensual promedio (0..100+). null si no hay historia.
  detalle: BacktestDetalle[];
}

export function backtest(filas: MesEntrenamiento[], objetivos: number[]): BacktestResultado {
  const mapes: number[] = [];
  const detalle: BacktestDetalle[] = [];
  for (const t of objetivos) {
    const train = filas.filter((f) => f.anio < t);
    const aniosTrain = new Set(train.map((f) => f.anio)).size;
    if (aniosTrain < 2) continue;
    const pron = pronosticar(train, t);
    const reales = new Map(filas.filter((f) => f.anio === t).map((f) => [f.mes, f.total]));
    if (reales.size === 0) continue;
    const errs: number[] = [];
    let realAnual = 0;
    let pronAnual = 0;
    for (const p of pron) {
      const r = reales.get(p.mes) ?? 0;
      realAnual += r;
      pronAnual += p.siniestros;
      if (r > 0) errs.push(Math.abs(r - p.siniestros) / r);
    }
    if (errs.length === 0 || realAnual <= 0) continue;
    mapes.push((errs.reduce((s, e) => s + e, 0) / errs.length) * 100);
    detalle.push({
      anio: t,
      real: realAnual,
      pron: pronAnual,
      errAnualPct: Math.round((Math.abs(realAnual - pronAnual) / realAnual) * 1000) / 10,
    });
  }
  return {
    mape: mapes.length > 0 ? Math.round((media(mapes)) * 10) / 10 : null,
    detalle,
  };
}
