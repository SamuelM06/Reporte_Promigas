import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Calendar, Coins, MapPin, TrendingUp, Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Filters, Metadatos, ProyeccionData } from '../../lib/types';
import { queryString, queryStringOpciones } from '../../utils/fetcher';
import { formatNum } from '../../utils/formatters';
import Panel from '../dashboard/Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';
import ForecastChart from '../charts/ForecastChart';
import ProbabilidadGeo from '../proyeccion/ProbabilidadGeo';
import ProbabilidadCategorica from '../proyeccion/ProbabilidadCategorica';

interface Props {
  datosIniciales: ProyeccionData;
  filtrosIniciales: Filters;
  metadatos: Metadatos;
}

export default function ProyeccionApp({ datosIniciales, filtrosIniciales, metadatos }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<ProyeccionData>(datosIniciales);
  const [opciones, setOpciones] = useState<Metadatos>(metadatos);
  const [cargando, setCargando] = useState(false);
  const primeraCarga = useRef(true);
  const cacheRef = useRef<Map<string, ProyeccionData>>(new Map());
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  if (cacheRef.current.size === 0) {
    const k0 = JSON.stringify({ gasera: filtrosIniciales.gasera ?? null, producto: filtrosIniciales.producto ?? null, aseguradora: filtrosIniciales.aseguradora ?? null, clase: filtrosIniciales.clase ?? null });
    cacheRef.current.set(k0, datosIniciales);
  }

  const cambioFiltro = useCallback((cambio: Partial<Filters>) => {
    setFiltros((prev) => {
      const next = { ...prev, ...cambio };
      const claves = Object.keys(cambio) as (keyof Filters)[];
      if (claves.every((k) => prev[k] === next[k])) return prev;
      return next;
    });
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltros({
      anio: undefined, gasera: undefined, producto: undefined,
      aseguradora: undefined, contrato: undefined, mes: undefined,
      estado: undefined, tipo_siniestro: undefined, clase: undefined,
      desde: '2018-01-01', hasta: '2026-12-31',
    });
  }, []);

  // Cascada Clase → Gasera/Producto con data en tiempo real.
  const claseKey = JSON.stringify(filtros.clase ?? null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/metadatos?${queryStringOpciones(filtros)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as Metadatos;
      })
      .then((m) => {
        if (!vivo) return;
        setOpciones(m);
        setFiltros((prev) => {
          const gaserasOk = (prev.gasera ?? []).filter((g) => m.gaseras.includes(g));
          const productosOk = (prev.producto ?? []).filter((p) => m.productos.includes(p));
          const ng = gaserasOk.length > 0 ? gaserasOk : undefined;
          const np = productosOk.length > 0 ? productosOk : undefined;
          if (
            (ng?.length ?? 0) === (prev.gasera?.length ?? 0) &&
            (np?.length ?? 0) === (prev.producto?.length ?? 0)
          ) return prev;
          return { ...prev, gasera: ng, producto: np };
        });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claseKey]);

  useEffect(() => {
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    const key = JSON.stringify({ gasera: filtros.gasera ?? null, producto: filtros.producto ?? null, aseguradora: filtros.aseguradora ?? null, clase: filtros.clase ?? null });
    const cached = cacheRef.current.get(key);
    if (cached) {
      setData(cached);
      setCargando(false);
      return;
    }
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setCargando(true);
    debounceRef.current = window.setTimeout(() => {
      const q = queryString(filtros);
      fetch(`/api/proyeccion?${q}`, { signal: ac.signal })
        .then(async (res) => { if (!res.ok) throw new Error(res.statusText); return (await res.json()) as ProyeccionData; })
        .then((d) => {
          if (ac.signal.aborted) return;
          cacheRef.current.set(key, d);
          // LRU simple: máximo 30 entradas
          if (cacheRef.current.size > 30) {
            const first = cacheRef.current.keys().next().value as string | undefined;
            if (first) cacheRef.current.delete(first);
          }
          setData(d);
        })
        .catch((e) => { if ((e as Error)?.name === 'AbortError') return; })
        .finally(() => { if (!ac.signal.aborted) setCargando(false); });
    }, 280);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
      ac.abort();
    };
  }, [filtros]);

  const { forecast, forecast2026, tendencia, departamentos, tiposSiniestro, anioObjetivo, aniosEntrenamiento } = data;

  const activos =
    ((filtros.clase?.length ?? 0) > 0 ? 1 : 0) + ((filtros.gasera?.length ?? 0) > 0 ? 1 : 0) + ((filtros.producto?.length ?? 0) > 0 ? 1 : 0) + ((filtros.aseguradora?.length ?? 0) > 0 ? 1 : 0);

  const deptoTop = useMemo(() => {
    if (departamentos.length === 0) return null;
    return [...departamentos].sort((a, b) => b.prob - a.prob)[0] ?? null;
  }, [departamentos]);

  const mesPico = useMemo(() => {
    if (forecast.length === 0) return null;
    return [...forecast].sort((a, b) => b.siniestros - a.siniestros)[0] ?? null;
  }, [forecast]);

  const top3Deptos = useMemo(() => [...departamentos].sort((a, b) => b.prob - a.prob).slice(0, 3), [departamentos]);

  return (
    <div className="space-y-2 xl:space-y-2.5 xl:flex xl:h-[calc(100vh-88px)] xl:flex-col xl:overflow-hidden">
      <h1 className="sr-only">Proyección estadística de siniestros</h1>

      <FiltrosPanel
        filtros={filtros}
        metadatos={opciones}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
        cargando={cargando}
        modoProyeccion
      />
      <p className="px-1 text-[10px] leading-none text-tinta/45">Proyección probabilística {anioObjetivo} basada en {aniosEntrenamiento.length} años cerrados ({aniosEntrenamiento[0] ?? 2018}–{aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025}). Filtra por gasera, aseguradora o producto para recalcular la probabilidad del segmento.</p>

      {/* KPIs superiores: 4 tarjetas — mismo tamaño, sin resalte */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:gap-2.5">
        <KpiCard
          titulo={`Siniestros ${anioObjetivo}`}
          valor={tendencia.totalProyAnual}
          icono={<Trophy className="h-6 w-6" />}
          acento="azul"
          delay={0}
          centrado
          sub={`${aniosEntrenamiento.length} años de entrenamiento`}
        />
        <KpiCard
          titulo="Pagado proyectado"
          valor={tendencia.montoProyAnual}
          icono={<Coins className="h-6 w-6" />}
          acento="verde-oscuro"
          delay={0.06}
          moneda
          centrado
          compacto
          sub="Estimación anual COP"
        />
        {/* Depto con mayor probabilidad — reemplaza Precisión */}
        <motion.article
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="glass glass-hover relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl p-4 text-center"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f0b429] to-[#ef7a6b]" />
          <span className="text-xl drop-shadow text-[#b45309] dark:text-[#ffd98a]"><MapPin className="h-6 w-6" /></span>
          <p className="mt-1 text-sm font-semibold text-tinta/70">Depto con mayor riesgo</p>
          <p className="tabular mt-2 line-clamp-1 text-xl font-extrabold tracking-tight text-tinta md:text-2xl" title={deptoTop?.nombre ?? '—'}>
            {deptoTop?.nombre ?? '—'}
          </p>
          <p className="mt-1 text-[11px] font-bold tabular text-tinta/80">
            {deptoTop ? `${(deptoTop.prob * 100).toFixed(1)}% prob · ${formatNum(deptoTop.casos)} casos` : 'Sin datos'}
          </p>
          {deptoTop && (
            <p className="mt-0.5 text-[10px] text-tinta/50">IC 95% {(deptoTop.low * 100).toFixed(1)}%–{(deptoTop.high * 100).toFixed(1)}%</p>
          )}
        </motion.article>
        {/* Mes pico proyectado */}
        <motion.article
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="glass glass-hover relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl p-4 text-center"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8b7bff] to-[#3d22c8]" />
          <span className="text-xl drop-shadow text-[#6a4fd8] dark:text-[#b8c0ff]"><Calendar className="h-6 w-6" /></span>
          <p className="mt-1 text-sm font-semibold text-tinta/70">Mes pico proyectado</p>
          <p className="tabular mt-2 text-3xl font-extrabold tracking-tight text-tinta md:text-4xl">
            {mesPico ? formatNum(mesPico.siniestros) : '—'}
          </p>
          <p className="mt-1 text-xs font-semibold text-tinta/60">
            {mesPico ? `${mesPico.label} ${anioObjetivo}` : 'Sin datos'}
          </p>
          {mesPico && (
            <p className="mt-0.5 text-[10px] text-tinta/50">Rango 80%: {formatNum(mesPico.sinLow)}–{formatNum(mesPico.sinHigh)}</p>
          )}
        </motion.article>
      </div>

      {/* Forecast + probabilidades — todo en una vista sin scroll */}
      <div className="grid gap-2 xl:flex-1 xl:grid-cols-[1.55fr_380px] xl:grid-rows-[1fr_auto] xl:gap-2.5 xl:items-stretch xl:min-h-0">
        <Panel
          titulo={`Pronóstico ${anioObjetivo}: siniestros y dinero pagado`}
          icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.05}
          className="xl:p-3 xl:pb-1 overflow-hidden flex flex-col"
        >
          <ForecastChart data={forecast} anioObjetivo={anioObjetivo} anioPrevio={aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025} />
        </Panel>
        <div className="grid gap-2 xl:gap-2.5 xl:grid-rows-2 xl:min-h-0">
          <Panel
            titulo="Probabilidad por departamento"
            icono={<Trophy className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
            delay={0.1}
            className="xl:p-3 xl:pb-2 overflow-hidden flex flex-col"
          >
            {top3Deptos.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1.5">
                {top3Deptos.map((d, i) => (
                  <span key={d.nombre} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${i === 0 ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-tinta/10 bg-tinta/5 text-tinta/70'}`}>
                    <span className="tabular">{i + 1}. {d.nombre}</span>
                    <span className="tabular opacity-80">{(d.prob * 100).toFixed(1)}%</span>
                  </span>
                ))}
              </div>
            )}
            <ProbabilidadGeo data={departamentos} />
          </Panel>
          <Panel
            titulo="Probabilidad por tipo de siniestro"
            icono={<BarChart3 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
            delay={0.12}
            className="xl:p-3 xl:pb-2 overflow-hidden flex flex-col"
          >
            <ProbabilidadCategorica titulo="Tipos" data={tiposSiniestro} />
          </Panel>
        </div>
        {/* Cierre 2026 — 12 meses: real hasta el último mes observado y
            proyectado a partir de ahí (separador animado en ForecastChart). */}
        <Panel
          titulo={`Cierre ${anioObjetivo - 1} · real y proyectado`}
          icono={<Calendar className="h-5 w-5 text-xuma-ambar" />}
          delay={0.14}
          className="xl:col-span-2 xl:p-3 xl:pb-1 overflow-hidden flex flex-col"
        >
          <ForecastChart data={forecast2026} anioObjetivo={anioObjetivo - 1} anioPrevio={aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025} compact />
        </Panel>
      </div>
    </div>
  );
}
