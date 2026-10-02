import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarRange, Download, Eye, EyeOff, Fuel, Landmark, Layers, Package, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { EstatusData, Metadatos } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { descargarExcelEstatus, type FilaEstatusExcel } from '../../utils/excel';
import SelectXuma from '../ui/SelectXuma';
import MultiSelectXuma from '../ui/MultiSelectXuma';
import { estadoBadge } from './estados';

interface Props {
  metadatos: Metadatos;
  anioInicial: number;
  datosIniciales?: EstatusData;
}

const ANIO_POR_DEFECTO = 2026;
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface FiltrosEstatus {
  anio: number;
  gasera?: string[];        // selección múltiple (vacío/ausente = Todas)
  producto?: string[];      // selección múltiple (vacío/ausente = Todos)
  aseguradora?: string[];   // selección múltiple (vacío/ausente = Todas)
  clase?: string[];         // Deudor | Microseguros | Salvafactura | Otros (vacío/ausente = Todas)
}

const inputSelectCls = 'w-full min-w-0';

const etiquetaCls = 'mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-tinta/60 uppercase';

function construirQs(f: FiltrosEstatus): string {
  const p = new URLSearchParams({ anio: String(f.anio) });
  const lista = (clave: string, valores?: string[]) => {
    for (const v of valores ?? []) {
      if (v.trim() !== '') p.append(clave, v);
    }
  };
  lista('gasera', f.gasera);
  lista('producto', f.producto);
  lista('aseguradora', f.aseguradora);
  lista('clase', f.clase);
  return p.toString();
}

export default function EstatusApp({ metadatos, anioInicial, datosIniciales }: Props) {
  const [filtros, setFiltros] = useState<FiltrosEstatus>({ anio: anioInicial });
  const [data, setData] = useState<EstatusData | null>(datosIniciales ?? null);
  const [cargando, setCargando] = useState(datosIniciales == null);
  const [error, setError] = useState('');
  const primeraCarga = useRef(datosIniciales != null);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState('');

  const anios = useMemo(() => metadatos.anios.map((a) => ({ valor: String(a), etiqueta: String(a) })), [metadatos.anios]);
  const [opciones, setOpciones] = useState<Metadatos>(metadatos);
  const gaseras = useMemo(() => opciones.gaseras.map((g) => ({ valor: g, etiqueta: g })), [opciones.gaseras]);
  const productos = useMemo(() => opciones.productos.map((p) => ({ valor: p, etiqueta: p })), [opciones.productos]);
  const aseguradoras = useMemo(() => metadatos.aseguradoras.map((a) => ({ valor: a, etiqueta: a })), [metadatos.aseguradoras]);
  const clases = useMemo(() => (metadatos.clases ?? []).map((c) => ({ valor: c, etiqueta: c })), [metadatos.clases]);

  const cambiar = useCallback((cambio: Partial<FiltrosEstatus>) => {
    setExpandida(null);
    setErrorExport('');
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }, []);

  const reset = useCallback(() => {
    setExpandida(null);
    setErrorExport('');
    setFiltros({ anio: anioInicial });
  }, [anioInicial]);

  // Cascada Clase → Gasera/Producto con data en tiempo real: al cambiar la clase
  // (o el año) se re-piden las opciones a la DB y se poda lo incompatible
  // (p. ej. Deudor → solo Caribe y Surtigas).
  const claseKey = JSON.stringify(filtros.clase ?? null);
  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({
      desde: `${filtros.anio}-01-01`,
      hasta: `${filtros.anio}-12-31`,
    });
    for (const v of filtros.clase ?? []) {
      if (v.trim() !== '') q.append('clase', v);
    }
    fetch(`/api/metadatos?${q.toString()}`)
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
          setExpandida(null);
          return { ...prev, gasera: ng, producto: np };
        });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [claseKey, filtros.anio]);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    setError('');
    fetch(`/api/estatus?${construirQs(filtros)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as EstatusData;
      })
      .then((d) => {
        if (!vivo) return;
        setData(d);
      })
      .catch(() => {
        if (vivo) setError('No se pudo cargar el estatus de siniestros.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const matriz = useMemo(() => {
    if (!data) return null;
    const mapa = new Map<string, number[]>();
    const mapaEstados = new Map<string, Map<string, number>>();
    const filasData = data!.filas;
    for (const f of filasData) {
      if (!mapa.has(f.gasera)) mapa.set(f.gasera, Array.from({ length: 12 }, () => 0));
      const idx = (f.mes - 1) % 12;
      const fila = mapa.get(f.gasera)!;
      if (fila !== undefined) {
        fila[idx] = fila[idx]! + f.total;
      }
      if (!mapaEstados.has(f.gasera)) mapaEstados.set(f.gasera, new Map());
      const em = mapaEstados.get(f.gasera)!;
      em.set(f.estado, (em.get(f.estado) ?? 0) + f.total);
    }
    const filas = data.gaseras.map((g) => {
      const meses = mapa.get(g) ?? Array.from({ length: 12 }, () => 0);
      return { gasera: g, meses, total: meses.reduce((s, n) => s + n, 0) };
    });
    const totalesMes = Array.from({ length: 12 }, (_, i) => filas.reduce((s, f) => s + (f.meses[i] ?? 0), 0));
    const totalGeneral = totalesMes.reduce((s, n) => s + n, 0);
    const estados = [...mapaEstados.keys()].sort((a, b) => {
      const ta = mapaEstados.get(a)!.values().reduce((s, n) => s + n, 0);
      const tb = mapaEstados.get(b)!.values().reduce((s, n) => s + n, 0);
      return tb - ta;
    });
    const estadosPorGasera = new Map<string, string[]>();
    for (const g of data.gaseras) {
      const em = mapaEstados.get(g);
      if (em) {
        const ordenados = [...em.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e);
        estadosPorGasera.set(g, ordenados);
      } else {
        estadosPorGasera.set(g, []);
      }
    }
    return { filas, totalesMes, totalGeneral, estados, estadosPorGasera };
  }, [data]);

  const maxCelda = matriz ? Math.max(1, ...matriz.filas.flatMap((f) => f.meses)) : 1;

  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;
  const mesesVisibles = filtros.anio === anioActual ? MESES_CORTOS.slice(0, mesActual) : MESES_CORTOS;

  const activos =
    ((filtros.clase?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.gasera?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.producto?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.aseguradora?.length ?? 0) > 0 ? 1 : 0) +
    (filtros.anio !== anioInicial ? 1 : 0);

  // Exporta lo filtrado tal como se ve (con sus estados) a Excel.
  // Trae datos frescos con los filtros actuales en vez de reusar el estado
  // en pantalla: si la tabla quedó con datos viejos por un error de red, el
  // archivo igual sale con lo filtrado (y si falla, avisa en vez de
  // exportar datos que no corresponden).
  const exportarExcel = useCallback(async () => {
    if (exportando) return;
    setExportando(true);
    setErrorExport('');
    try {
      const res = await fetch(`/api/estatus?${construirQs(filtros)}`);
      if (!res.ok) throw new Error(res.statusText);
      const fresco = (await res.json()) as EstatusData;
      if (!fresco || fresco.filas.length === 0) {
        setErrorExport('No hay datos para exportar con estos filtros.');
        return;
      }
      const nMeses = mesesVisibles.length;
      const mapa = new Map<string, number[]>();
      const porGasera = new Map<string, Map<string, number[]>>();
      for (const d of fresco.filas) {
        if (!mapa.has(d.gasera)) mapa.set(d.gasera, Array.from({ length: 12 }, () => 0));
        const idx = (d.mes - 1) % 12;
        const base = mapa.get(d.gasera);
        if (base !== undefined) base[idx] = base[idx]! + d.total;
        if (!porGasera.has(d.gasera)) porGasera.set(d.gasera, new Map());
        const em = porGasera.get(d.gasera)!;
        if (!em.has(d.estado)) em.set(d.estado, Array.from({ length: 12 }, () => 0));
        const arr = em.get(d.estado)!;
        arr[idx] = arr[idx]! + d.total;
      }
      const gaserasOrd = [...mapa.keys()].sort((a, b) => {
        const ta = (mapa.get(a) ?? []).reduce((s, n) => s + n, 0);
        const tb = (mapa.get(b) ?? []).reduce((s, n) => s + n, 0);
        return tb - ta;
      });
      const filas: FilaEstatusExcel[] = [];
      const totalesMes = Array.from({ length: 12 }, () => 0);
      for (const g of gaserasOrd) {
        const em = porGasera.get(g) ?? new Map<string, number[]>();
        const estadosG = [...em.entries()]
          .sort((a, b) => b[1].reduce((s, n) => s + n, 0) - a[1].reduce((s, n) => s + n, 0))
          .map(([e]) => e);
        for (const estado of estadosG) {
          const arr = (em.get(estado) ?? []).slice(0, nMeses);
          filas.push({ gasera: g, estado, meses: arr, total: arr.reduce((s, n) => s + n, 0) });
        }
        const base = (mapa.get(g) ?? []).slice(0, nMeses);
        filas.push({ gasera: g, estado: 'TOTAL', meses: base, total: base.reduce((s, n) => s + n, 0) });
        const full = mapa.get(g) ?? [];
        for (let i = 0; i < 12; i += 1) totalesMes[i] = totalesMes[i]! + (full[i] ?? 0);
      }
      filas.push({ gasera: 'TOTAL GENERAL', estado: '', meses: totalesMes.slice(0, nMeses), total: totalesMes.reduce((s, n) => s + n, 0) });
      await descargarExcelEstatus({ anio: filtros.anio, meses: mesesVisibles, filas });
    } catch {
      setErrorExport('No se pudo exportar. Revisa la conexión e inténtalo de nuevo.');
    } finally {
      setExportando(false);
    }
  }, [filtros, mesesVisibles, exportando]);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="glass relative z-20 rounded-3xl p-3"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-tinta">
            <SlidersHorizontal className="h-4 w-4 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Filtros del estatus
          </h2>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {cargando && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2.5 py-0.5 text-[11px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
                >
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Actualizando…
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {activos > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2.5 py-0.5 text-[11px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
                >
                  {activos} filtro{activos > 1 ? 's' : ''} activo{activos > 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={reset}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-tinta/15 px-3.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer ({ANIO_POR_DEFECTO})
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block min-w-0">
            <span className={etiquetaCls}><CalendarRange className="h-3.5 w-3.5" /> Año</span>
            <SelectXuma
              valor={String(filtros.anio)}
              opciones={anios}
              alCambiar={(v) => cambiar({ anio: Number(v) || ANIO_POR_DEFECTO })}
              placeholder="Seleccionar año"
              etiquetaTodo={`Todos los años`}
              icono={<CalendarRange className="h-4 w-4" />}
              desplegableClase={inputSelectCls}
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Layers className="h-3.5 w-3.5" /> Clase</span>
            <MultiSelectXuma
              valores={filtros.clase ?? []}
              opciones={clases}
              alCambiar={(v) => cambiar({ clase: v.length > 0 ? v : undefined })}
              placeholder="Filtrar por clase"
              etiquetaTodo="Todas las clases"
              icono={<Layers className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Fuel className="h-3.5 w-3.5" /> Gasera</span>
            <MultiSelectXuma
              valores={filtros.gasera ?? []}
              opciones={gaseras}
              alCambiar={(v) => cambiar({ gasera: v.length > 0 ? v : undefined })}
              placeholder="Filtrar por gasera"
              etiquetaTodo="Todas las gaseras"
              icono={<Fuel className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Package className="h-3.5 w-3.5" /> Producto</span>
            <MultiSelectXuma
              valores={filtros.producto ?? []}
              opciones={productos}
              alCambiar={(v) => cambiar({ producto: v.length > 0 ? v : undefined })}
              placeholder="Filtrar por producto"
              etiquetaTodo="Todos los productos"
              icono={<Package className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Landmark className="h-3.5 w-3.5" /> Aseguradora</span>
            <MultiSelectXuma
              valores={filtros.aseguradora ?? []}
              opciones={aseguradoras}
              alCambiar={(v) => cambiar({ aseguradora: v.length > 0 ? v : undefined })}
              placeholder="Filtrar por aseguradora"
              etiquetaTodo="Todas las aseguradoras"
              icono={<Landmark className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-3xl p-5 md:p-6"
      >
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-tinta md:text-lg">
            <Fuel className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Siniestros por gasera y mes
          </h2>
          <div className="flex items-center gap-3">
            {matriz && (
              <span className="rounded-full bg-tinta/10 px-3 py-1 text-xs font-semibold text-tinta/70">
                {cargando ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Actualizando…
                  </span>
                ) : (
                  `${formatNum(matriz.totalGeneral)} siniestros en ${filtros.anio} · ${matriz.filas.length} gasera${matriz.filas.length === 1 ? '' : 's'}`
                )}
              </span>
            )}
            <button
              type="button"
              onClick={exportarExcel}
              disabled={!matriz || matriz.filas.length === 0 || cargando || exportando}
              title="Exportar la matriz con estados a Excel"
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-tinta/15 px-3 py-1 text-xs font-semibold text-tinta/70 transition-colors hover:border-xuma-verde-claro/50 hover:bg-xuma-verde-claro/10 hover:text-xuma-verde-oscuro disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-xuma-verde-claro"
            >
              {exportando ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {exportando ? 'Exportando…' : 'Exportar Excel'}
            </button>
            {errorExport !== '' && (
              <span className="text-xs font-semibold text-red-300">{errorExport}</span>
            )}
          </div>
        </header>

        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl">
          <table
            aria-busy={cargando}
            className={`w-full min-w-[860px] border-collapse text-sm transition-opacity ${cargando && data ? 'opacity-60' : ''}`}
          >
            <thead>
              <tr className="text-left text-xs tracking-wide text-tinta/55 uppercase">
                <th className="sticky left-0 z-10 bg-transparent py-3 pr-4 font-semibold">Gasera</th>
                {mesesVisibles.map((m) => (
                  <th key={m} className="px-2 py-3 text-center font-semibold">{m}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro">Total</th>
              </tr>
            </thead>
            {cargando && !data ? (
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4">
                    <div className="skeleton h-4 w-40" />
                  </td>
                  {Array.from({ length: mesesVisibles.length + 1 }).map((__, j) => (
                    <td key={j} className="px-2 py-3 text-center">
                      <div className="skeleton mx-auto h-4 w-8" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : (
            <AnimatePresence initial={false} mode="wait">
              <motion.tbody
                key={`${filtros.anio}:${(filtros.clase ?? []).join(',')}:${(filtros.gasera ?? []).join(',')}:${(filtros.producto ?? []).join(',')}:${(filtros.aseguradora ?? []).join(',')}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {matriz && matriz.filas.length > 0 ? (
                  matriz.filas.map((fila) => {
                    const abierta = expandida === fila.gasera;
                    const atenuada = expandida !== null && !abierta;
                    const estadosG = matriz?.estadosPorGasera.get(fila.gasera) ?? [];
                    return (
                      <Fragment key={fila.gasera}>
                      <motion.tr
                        initial={false}
                        animate={{
                          opacity: atenuada ? 0.35 : 1,
                          backgroundColor: abierta ? 'rgba(61, 34, 200, 0.10)' : 'rgba(255, 255, 255, 0.02)',
                          filter: atenuada ? 'saturate(0.3) brightness(0.8)' : 'saturate(1) brightness(1)',
                          boxShadow: abierta ? 'inset 3px 0 0 var(--color-xuma-azul-3)' : 'inset 3px 0 0 rgba(0, 0, 0, 0)',
                        }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        className="border-t border-tinta/5 backdrop-blur-md transition-colors hover:bg-tinta/5"
                      >
                        <td className="sticky left-0 z-10 border-t border-tinta/5 bg-white/95 py-3 pr-4 font-semibold whitespace-nowrap text-tinta/90 backdrop-blur-md dark:bg-[#0f1c15]/92">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandida(abierta ? null : fila.gasera)}
                              aria-expanded={abierta}
                              aria-label={`${abierta ? 'Cerrar' : 'Ver estados de'} ${fila.gasera}`}
                              className="group cursor-pointer rounded-md p-0.5 transition-colors hover:bg-tinta/5"
                            >
                              <motion.span
                                key={abierta ? 'cerrar' : 'abrir'}
                                initial={{ opacity: 0, rotate: -120, scale: 0.5 }}
                                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                className="flex"
                              >
                                {abierta
                                  ? <EyeOff className="h-4 w-4 text-xuma-azul-3" />
                                  : <Eye className="h-4 w-4 text-tinta/35 group-hover:text-xuma-verde-oscuro" />}
                              </motion.span>
                            </button>
                            <Fuel className="h-3.5 w-3.5 shrink-0 text-tinta/40" />
                            {fila.gasera}
                          </div>
                        </td>
                        {fila.meses.slice(0, mesesVisibles.length).map((n, j) => {
                          const ratio = n > 0 ? Math.sqrt(n / maxCelda) : 0;
                          const mes = mesesVisibles[j] ?? '';
                          return (
                            <td
                              key={j}
                              className="px-2 py-3 text-center tabular text-tinta/80"
                              style={{
                                background: n > 0 ? `color-mix(in srgb, var(--cgraf-2) ${Math.round(ratio * 38)}%, transparent)` : undefined,
                              }}
                              title={`${fila.gasera} · ${mes}: ${formatNum(n)}`}
                            >
                              <span className={n === 0 ? 'text-tinta/25' : 'font-semibold'}>{n === 0 ? '·' : formatNum(n)}</span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center font-bold text-xuma-verde-oscuro tabular dark:text-xuma-verde-claro">
                          {formatNum(fila.total)}
                        </td>
                      </motion.tr>
                      <AnimatePresence initial={false}>
                      {abierta && estadosG.map((estado, ei) => {
                        const datos = data!.filas.filter((f) => f.gasera === fila.gasera && f.estado === estado);
                        const mesesEstado: number[] = Array.from({ length: 12 }, () => 0);
                        for (const d of datos) {
                          const idx = (d.mes - 1) % 12;
                          mesesEstado[idx] = mesesEstado[idx]! + d.total;
                        }
                        const totalEstado = mesesEstado.reduce((s, n) => s + n, 0);
                        const { cls } = estadoBadge(estado);
                        return (
                          <motion.tr
                            key={`${fila.gasera}-${estado}`}
                            initial={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', backgroundColor: 'rgba(61, 34, 200, 0.08)' }}
                            exit={{ opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.22, delay: (estadosG.length - 1 - ei) * 0.05, ease: 'easeIn' } }}
                            transition={{ duration: 0.28, delay: Math.min(ei * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
                            className="border-t border-xuma-azul-3/25 backdrop-blur-md"
                          >
                            <td className="sticky left-0 z-10 border-t border-tinta/5 bg-white/90 py-2.5 pr-4 pl-10 font-medium whitespace-nowrap text-tinta/80 backdrop-blur-md dark:bg-[#0f1c15]/85">
                              <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
                                {estado}
                              </span>
                            </td>
                            {mesesEstado.slice(0, mesesVisibles.length).map((n, j) => {
                              const ratio = n > 0 ? Math.sqrt(n / maxCelda) : 0;
                              const mes = mesesVisibles[j] ?? '';
                              return (
                                <td
                                  key={j}
                                  className="px-2 py-2.5 text-center tabular text-tinta/70"
                                  style={{
                                    background: n > 0 ? `color-mix(in srgb, var(--cgraf-2) ${Math.round(ratio * 28)}%, transparent)` : undefined,
                                  }}
                                  title={`${fila.gasera} · ${estado} · ${mes}: ${formatNum(n)}`}
                                >
                                  <span className={n === 0 ? 'text-tinta/20' : 'font-semibold'}>{n === 0 ? '·' : formatNum(n)}</span>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2.5 text-center font-semibold text-tinta/80 tabular">
                              {formatNum(totalEstado)}
                            </td>
                          </motion.tr>
                        );
                      })}
                      </AnimatePresence>
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={mesesVisibles.length + 2} className="py-12 text-center text-tinta/50">
                      <span className="mx-auto mb-2 block h-10 w-10 text-tinta-dim">
                        <CalendarRange className="h-10 w-10" />
                      </span>
                      <p className="mt-2">No hay siniestros que coincidan con los filtros.</p>
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </AnimatePresence>
          )}
            {matriz && matriz.filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-xuma-verde-claro/40 text-xs font-bold text-tinta">
                  <td className="sticky left-0 z-10 py-3 pr-4 text-base uppercase tracking-wide text-tinta/70">Total</td>
                  {matriz.totalesMes.slice(0, mesesVisibles.length).map((n, j) => (
                    <td key={j} className="px-2 py-3 text-center tabular font-bold text-tinta/90">
                      {n > 0 ? formatNum(n) : '·'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-black text-xuma-verde-oscuro tabular dark:text-xuma-verde-claro">
                    {formatNum(matriz.totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {matriz && matriz.filas.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--cgraf-2)', opacity: 0.35 }} />
              Intensidad = volumen de siniestros del mes
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              Click en el ojo de una gasera para ver sus estados por mes
            </span>
            <span>Total pagado no aplica a esta vista (solo conteo de siniestros).</span>
          </p>
        )}
      </motion.section>
    </div>
  );
}
