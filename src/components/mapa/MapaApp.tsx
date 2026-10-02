import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Coins, Globe, MapPin, Trophy } from 'lucide-react';
import type { Filters, MapaData, Metadatos } from '../../lib/types';
import { queryString, queryStringOpciones } from '../../utils/fetcher';
import { formatCOP, formatNum } from '../../utils/formatters';
import FiltrosPanel from '../filtros/FiltrosPanel';
import MapaColombia from './MapaColombia';

interface Props {
  metadatos: Metadatos;
  filtrosIniciales: Filters;
  mapaInicial: MapaData;
}

const DEFAULT_DESDE = '2026-01-01';
const DEFAULT_HASTA = '2026-12-31';

export default function MapaApp({ metadatos: metadatosServer, filtrosIniciales, mapaInicial }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<MapaData>(mapaInicial);
  const [metadatos, setMetadatos] = useState<Metadatos>(metadatosServer);
  const [cargando, setCargando] = useState(false);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<string | null>(null);

  const cambioFiltro = useCallback((cambio: Partial<Filters>) => {
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltros({
      contrato: undefined,
      mes: undefined,
      desde: DEFAULT_DESDE,
      hasta: DEFAULT_HASTA,
      gasera: undefined,
      producto: undefined,
      estado: undefined,
      aseguradora: undefined,
      tipo_siniestro: undefined,
      clase: undefined,
    });
    setDeptoSeleccionado(null);
  }, []);

  // Referencia actualizada del depto seleccionado para validar después de
  // refetchear SIN meter el depto en las dependencias (evita re-consultas
  // innecesarias cada vez que el usuario hace click en un departamento).
  const deptoActualRef = useRef<string | null>(deptoSeleccionado);
  useEffect(() => {
    deptoActualRef.current = deptoSeleccionado;
  }, [deptoSeleccionado]);

  // Al cambiar los filtros: refrescar MAPA + OPCIONES (cascada Clase → Gasera/Producto
  // con data en tiempo real; las opciones excluyen gasera/producto para no colapsar
  // las listas sobre la selección actual) y podar lo incompatible con la clase.
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    Promise.all([
      fetch(`/api/mapa?${q}`).then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as MapaData;
      }),
      fetch(`/api/metadatos?${queryStringOpciones(filtros)}`).then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as Metadatos;
      }),
    ])
      .then(([nuevoMapa, nuevosMeta]) => {
        if (!vivo) return;
        setData(nuevoMapa);
        setMetadatos(nuevosMeta);
        setFiltros((prev) => {
          const gaserasOk = (prev.gasera ?? []).filter((g) => nuevosMeta.gaseras.includes(g));
          const productosOk = (prev.producto ?? []).filter((p) => nuevosMeta.productos.includes(p));
          const ng = gaserasOk.length > 0 ? gaserasOk : undefined;
          const np = productosOk.length > 0 ? productosOk : undefined;
          if (
            (ng?.length ?? 0) === (prev.gasera?.length ?? 0) &&
            (np?.length ?? 0) === (prev.producto?.length ?? 0)
          ) return prev;
          return { ...prev, gasera: ng, producto: np };
        });
        // Si el departamento seleccionado ya no existe en los datos nuevos
        // (el filtro lo eliminó), limpiar la selección para no mostrar un panel vacío
        const actual = deptoActualRef.current;
        const sigueExistiendo =
          actual == null ||
          nuevoMapa.departamentos.some((d) => d.departamento === actual);
        if (!sigueExistiendo) setDeptoSeleccionado(null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const activos =
    (filtros.contrato ? 1 : 0) +
    ((filtros.clase?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.gasera?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.producto?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.estado?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.aseguradora?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.tipo_siniestro?.length ?? 0) > 0 ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    ((filtros.desde && filtros.desde !== DEFAULT_DESDE && !filtros.mes) ? 1 : 0) +
    ((filtros.hasta && filtros.hasta !== DEFAULT_HASTA && !filtros.mes) ? 1 : 0);

  const deptoLider = useMemo(() => {
    if (!data.departamentos || data.departamentos.length === 0) return null;
    return data.departamentos[0];
  }, [data]);

  return (
    <div className="flex flex-col h-[calc(100vh-62px)] overflow-hidden gap-2">
      {/* Título y Filtros en una sola línea horizontal compacta */}
      <div className="shrink-0 space-y-1.5">
        <FiltrosPanel
          filtros={filtros}
          metadatos={metadatos}
          onChange={cambioFiltro}
          onReset={resetFiltros}
          activos={activos}
          cargando={cargando}
          mostrarTipoSiniestro
        />

        {/* Tira compacta de métricas clave (KPIs más grandes, sin afectar el scroll) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-tinta/50 block leading-tight">Siniestros Mapeados</span>
              <span className="text-xl font-black text-tinta leading-none">{formatNum(data.totalNacional)}</span>
            </div>
          </div>

          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-tinta/50 block leading-tight">Total Pagado Territorial</span>
              <span className="text-lg font-black text-xuma-verde-oscuro dark:text-xuma-verde-claro leading-none truncate block" title={formatCOP(data.totalPagadoNacional)}>
                {formatCOP(data.totalPagadoNacional)}
              </span>
            </div>
          </div>

          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-tinta/50 block leading-tight">Dpto. Mayor Concentración</span>
              <span className="text-lg font-extrabold text-tinta leading-none truncate block">
                {deptoLider ? `${deptoLider.departamento} (${formatNum(deptoLider.total)})` : 'Sin datos'}
              </span>
            </div>
          </div>

          <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Compass className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-tinta/50 block leading-tight">Departamentos Activos</span>
              <span className="text-xl font-black text-tinta leading-none">
                {data.departamentos.length} <span className="text-[11px] font-normal text-tinta/50">({data.departamentos.reduce((acc, d) => acc + d.municipios.length, 0)} zonas)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor flexible del Mapa Real y el Panel lateral (ocupa el 100% del espacio restante sin scroll) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <MapaColombia
          data={data}
          deptoSeleccionado={deptoSeleccionado}
          onSelectDepto={setDeptoSeleccionado}
        />
      </div>
    </div>
  );
}
