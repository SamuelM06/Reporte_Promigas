import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarRange, Coins, Percent, TrendingUp, Trophy } from 'lucide-react';
import type { Filters, HistoricosData, Metadatos } from '../../lib/types';
import { queryString, queryStringOpciones } from '../../utils/fetcher';
import { formatCOP, formatNum } from '../../utils/formatters';
import Panel from '../dashboard/Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';

const BarrasMensualesAnio = lazy(() => import('../charts/BarrasMensualesAnio'));
const TendenciaMensualHist = lazy(() => import('../charts/TendenciaMensualHist'));

function EsqueletoGrafico({ clases }: { clases: string }) {
  return <div className={`animate-pulse rounded-xl bg-tinta/5 ${clases}`} />;
}

interface Props {
  datosIniciales: HistoricosData;
  filtrosIniciales: Filters;
  metadatos: Metadatos;
}

export default function HistoricosApp({ datosIniciales, filtrosIniciales, metadatos }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<HistoricosData>(datosIniciales);
  const [opciones, setOpciones] = useState<Metadatos>(metadatos);
  const [cargando, setCargando] = useState(false);
  const primeraCarga = useRef(true);

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
      anio: undefined,
      gasera: undefined,
      producto: undefined,
      aseguradora: undefined,
      contrato: undefined,
      mes: undefined,
      estado: undefined,
      tipo_siniestro: undefined,
      clase: undefined,
      desde: '2018-01-01',
      hasta: '2026-12-31',
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
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    fetch(`/api/historicos?${q}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as HistoricosData;
      })
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const { anios, mensual, tendencia, sinFecha } = data;
  const tend = tendencia ?? [];
  const totalHist = anios.reduce((s, a) => s + a.total, 0);
  const pagadosHist = anios.reduce((s, a) => s + a.pagados, 0);
  const totalPagadoHist = anios.reduce((s, a) => s + a.totalPagado, 0);
  const promedioPct = anios.length > 0
    ? Math.round((anios.reduce((s, a) => s + a.porcPagado, 0) / anios.length) * 10) / 10
    : 0;
  const pico = anios.reduce((max, a) => (a.total > max.total ? a : max), anios[0] ?? { anio: 0, total: 0, pagados: 0, objetados: 0, porcPagado: 0, totalPagado: 0 });

  const activos =
    (filtros.anio ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    ((filtros.clase?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.gasera?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.producto?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.aseguradora?.length ?? 0) > 0 ? 1 : 0);

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Histórico de siniestros por año</h1>

      <FiltrosPanel
        filtros={filtros}
        metadatos={opciones}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
        cargando={cargando}
        modoAnio
      />

      {/* En pantallas anchas los 4 KPI van en el lateral derecho y los gráficos
          ocupan todo el ancho libre, para ver todo sin scroll. En
          móvil/tablet se apila: KPIs primero y gráficos después. */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="order-2 min-w-0 space-y-3 xl:order-1">
          <Panel titulo="Comparativa mensual por año" icono={<BarChart3 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.05} className="xl:p-3">
            <Suspense fallback={          <EsqueletoGrafico clases="h-[470px] xl:h-[400px]" />}>
              <BarrasMensualesAnio series={mensual} />
            </Suspense>
          </Panel>

          <Panel titulo="Tendencia mensual: siniestros y dinero pagado" icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.1} className="xl:p-3">
            <Suspense fallback={          <EsqueletoGrafico clases="h-[340px] xl:h-[290px]" />}>
              <TendenciaMensualHist data={tend} />
            </Suspense>
          </Panel>
        </div>

        {/* En xl las 4 tarjetas se reparten a alto completo de la columna de
            gráficos (filas iguales, estiran solas). */}
        <aside className="order-1 grid min-w-0 gap-3 sm:grid-cols-2 xl:order-2 xl:grid-cols-1 xl:grid-rows-4" aria-label="Indicadores">
          <KpiCard
            titulo="Total histórico"
            valor={totalHist}
            icono={<Trophy className="h-6 w-6" />}
            acento="azul"
            delay={0}
            centrado
            sub={`${anios.length} año${anios.length === 1 ? '' : 's'} en rango`}
          />
          <KpiCard
            titulo="Promedio % pagado"
            valor={promedioPct}
            icono={<Percent className="h-6 w-6" />}
            acento="verde-claro"
            delay={0.06}
            centrado
            sub={`${formatNum(pagadosHist)} pagados en total`}
          />
          <KpiCard
            titulo="Pico de casos"
            valor={pico.total}
            icono={<CalendarRange className="h-6 w-6" />}
            acento="violeta"
            delay={0.12}
            centrado
            sub={pico.anio > 0 ? `Año ${pico.anio}${pico.anio === 2026 ? ' (parcial)' : ''}` : 'Sin datos'}
          />
          <KpiCard
            titulo="Total pagado histórico"
            valor={totalPagadoHist}
            icono={<Coins className="h-6 w-6" />}
            acento="verde-oscuro"
            delay={0.18}
            moneda
            centrado
            compacto
            sub={totalPagadoHist >= 1e9 ? `${formatCOP(totalPagadoHist)} en pagos válidos` : 'Suma de pagos válidos (2018–2026)'}
          />
        </aside>
      </div>

      {/* Nota a ancho completo: antes vivía en la columna central y alargaba
          la fila, dejando las tarjetas por fuera del panel de tendencia. */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/55">
        <span>Montos 2024 saneados (1 registro corrupto excluido de sumas).</span>
        <span>{formatNum(sinFecha)} casos sin fecha de radicación (no entran al eje de años).</span>
        <span>2026 es parcial (datos hasta septiembre).</span>
      </p>
    </div>
  );
}
