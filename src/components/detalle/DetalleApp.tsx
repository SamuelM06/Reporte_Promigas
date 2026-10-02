import { useCallback, useEffect, useState } from 'react';
import type { Filters, Metadatos, PaginaTabla } from '../../lib/types';
import { queryStringOpciones } from '../../utils/fetcher';
import FiltrosPanel from '../filtros/FiltrosPanel';
import TablaSiniestros from '../tabla/TablaSiniestros';

interface Props {
  metadatos: Metadatos;
  filtrosIniciales: Filters;
  datosIniciales?: PaginaTabla;
}

const DEFAULT_DESDE = '2026-01-01';
const DEFAULT_HASTA = '2026-12-31';

// Vista de detalle: filtros + tabla paginada y exportable de siniestros.
export default function DetalleApp({ metadatos, filtrosIniciales, datosIniciales }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [opciones, setOpciones] = useState<Metadatos>(metadatos);

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
      clase: undefined,
    });
  }, []);

  // Cascada Clase → Gasera/Producto con data en tiempo real.
  const claseKey = JSON.stringify(filtros.clase ?? null);
  const rangoKey = `${filtros.desde ?? ''}|${filtros.hasta ?? ''}|${filtros.mes ?? ''}`;
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
  }, [claseKey, rangoKey]);

  const activos =
    (filtros.contrato ? 1 : 0) +
    ((filtros.clase?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.gasera?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.producto?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.estado?.length ?? 0) > 0 ? 1 : 0) +
    ((filtros.aseguradora?.length ?? 0) > 0 ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    ((filtros.desde && filtros.desde !== DEFAULT_DESDE && !filtros.mes) ? 1 : 0) +
    ((filtros.hasta && filtros.hasta !== DEFAULT_HASTA && !filtros.mes) ? 1 : 0);

  return (
    <div className="space-y-6">
      <FiltrosPanel
        filtros={filtros}
        metadatos={opciones}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
      />
      <TablaSiniestros filtros={filtros} datosIniciales={datosIniciales} />
    </div>
  );
}
