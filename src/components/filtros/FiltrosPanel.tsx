import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Filter, IdCard, RefreshCw, SlidersHorizontal, X } from 'lucide-react';
import type { Filters, Metadatos } from '../../lib/types';
import { formatNum, mesLabel } from '../../utils/formatters';
import SelectXuma from '../ui/SelectXuma';
import MultiSelectXuma from '../ui/MultiSelectXuma';

interface Props {
  filtros: Filters;
  metadatos: Metadatos;
  onChange: (cambio: Partial<Filters>) => void;
  onReset: () => void;
  activos: number;
  cargando?: boolean;
  mostrarTipoSiniestro?: boolean;
  modoAnio?: boolean;
  modoProyeccion?: boolean;
}

// Normaliza fechas que pueden llegar como string ISO o como Date (props del island).
function aISO(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

// Tipos de los meses disponibles según el rango real de los datos.
function mesesDisponibles(minRaw: string | Date | null, maxRaw: string | Date | null): { valor: string; etiqueta: string }[] {
  const min = aISO(minRaw);
  const max = aISO(maxRaw);
  if (!min || !max) return [];
  const inicio = min.slice(0, 7);
  const fin = max.slice(0, 7);
  const lista: { valor: string; etiqueta: string }[] = [];
  let y = Number(inicio.split('-')[0] ?? 1);
  let m = Number(inicio.split('-')[1] ?? 1);
  const yFin = Number(fin.split('-')[0] ?? 1);
  const mFin = Number(fin.split('-')[1] ?? 1);
  while (y < yFin || (y === yFin && m <= mFin)) {
    const valor = `${y}-${String(m).padStart(2, '0')}`;
    lista.push({ valor, etiqueta: mesLabel(valor) });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return lista;
}

// Panel de filtros en una sola línea horizontal con debounce en el input de contrato.
// En modo año (vista Históricos) se muestra Año + Mes juntos y se ocultan
// contrato/estado/tipo, dejando: Año, Mes, gasera, aseguradora y producto.
// En modo proyección se muestran SOLO gasera, aseguradora y producto (sin Año,
// sin Mes, sin contrato/estado/tipo) porque la proyección es probabilística.
// Con Año seleccionado, las opciones de Mes se acotan a ese año.
export default function FiltrosPanel({ filtros, metadatos, onChange, onReset, activos, cargando = false, mostrarTipoSiniestro = false, modoAnio = false, modoProyeccion = false }: Props) {
  const [texto, setTexto] = useState(filtros.contrato ?? '');

  const meses = useMemo(() => mesesDisponibles(metadatos.rangoFechas.min, metadatos.rangoFechas.max), [metadatos.rangoFechas.min, metadatos.rangoFechas.max]);
  // En modo año con Año elegido, el selector de Mes solo ofrece ese año.
  const mesesVisibles = useMemo(() => {
    if (!modoAnio || !filtros.anio) return meses;
    return meses.filter((m) => m.valor.startsWith(`${filtros.anio}-`));
  }, [modoAnio, filtros.anio, meses]);
  const aniosHist = useMemo(
    () => (metadatos.anios ?? []).filter((a) => a >= 2018).map((a) => ({ valor: String(a), etiqueta: String(a) })),
    [metadatos.anios],
  );
  const aseguradoras = useMemo(() => (metadatos.aseguradoras ?? []).map((a) => ({ valor: a, etiqueta: a })), [metadatos.aseguradoras]);
  const clases = useMemo(() => (metadatos.clases ?? []).map((c) => ({ valor: c, etiqueta: c })), [metadatos.clases]);
  const gaseras = useMemo(() => metadatos.gaseras.map((g) => ({ valor: g, etiqueta: g })), [metadatos.gaseras]);
  const productos = useMemo(() => metadatos.productos.map((p) => ({ valor: p, etiqueta: p })), [metadatos.productos]);
  const estados = useMemo(
    () => metadatos.estados.map((e) => ({ valor: e.estado, etiqueta: `${e.estado} (${formatNum(e.total)})` })),
    [metadatos.estados],
  );
  const tiposSiniestro = useMemo(
    () => (metadatos.tipos_siniestro ?? []).map((t) => ({ valor: t.tipo_siniestro, etiqueta: `${t.tipo_siniestro} (${formatNum(t.total)})` })),
    [metadatos.tipos_siniestro],
  );

  const elegirMes = useCallback((v: string) => {
    onChange({ mes: v || undefined, desde: undefined, hasta: undefined });
  }, [onChange]);

  const elegirAnio = useCallback((v: string) => {
    // Al cambiar de año, el mes elegido se limpia si ya no pertenece a ese año.
    const mes = v && filtros.mes && !filtros.mes.startsWith(`${v}-`) ? undefined : filtros.mes;
    onChange({ anio: v || undefined, mes });
  }, [onChange, filtros.mes]);

  const elegirClase = useCallback((v: string[]) => {
    onChange({ clase: v.length > 0 ? v : undefined });
  }, [onChange]);

  const elegirAseguradora = useCallback((v: string[]) => {
    onChange({ aseguradora: v.length > 0 ? v : undefined });
  }, [onChange]);

  const elegirGasera = useCallback((v: string[]) => {
    onChange({ gasera: v.length > 0 ? v : undefined });
  }, [onChange]);

  const elegirProducto = useCallback((v: string[]) => {
    onChange({ producto: v.length > 0 ? v : undefined });
  }, [onChange]);

  const elegirEstado = useCallback((v: string[]) => {
    onChange({ estado: v.length > 0 ? v : undefined });
  }, [onChange]);

  const elegirTipoSiniestro = useCallback((v: string[]) => {
    onChange({ tipo_siniestro: v.length > 0 ? v : undefined });
  }, [onChange]);

  useEffect(() => {
    const id = setTimeout(() => {
      onChange({ contrato: texto.trim() !== '' ? texto.trim() : undefined });
    }, 450);
    return () => clearTimeout(id);
  }, [texto, onChange]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="glass relative z-20 rounded-2xl px-3 py-2 shadow-md"
    >
      {/* Badge superior: solo filtros activos + X para limpiar todo */}
      <AnimatePresence mode="wait">
        {activos > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -12,
              scale: 0.9,
              filter: 'blur(4px)',
              transition: { duration: 0.4, ease: [0.33, 1, 0.68, 1] },
            }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mb-2 flex items-center gap-2 rounded-lg border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-3 py-2 text-sm font-medium text-xuma-verde-oscuro dark:text-xuma-verde-claro"
            role="status"
            aria-live="polite"
          >
            <Filter className="h-4 w-4 flex-shrink-0" />
            <span>{activos} filtro{activos > 1 ? 's' : ''} activo{activos > 1 ? 's' : ''}</span>
            <button
              type="button"
              title="Limpiar todos los filtros"
              onClick={() => { setTexto(''); onReset(); }}
              className="ml-auto flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-xuma-verde-claro/20"
              aria-label="Limpiar todos los filtros"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        {/* Etiqueta / Ícono */}
        <div className="flex items-center gap-1.5 font-bold text-tinta text-xs whitespace-nowrap shrink-0 mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
          <span>Filtros</span>
        </div>

        {/* Buscador Contrato / Cédula (oculto en modo año y en proyección) */}
        {!modoAnio && !modoProyeccion && (
        <div className="relative min-w-[130px] flex-1 sm:max-w-[180px]">
          <input
            type="text"
            className="w-full rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1.5 pl-6 text-xs text-tinta placeholder-tinta/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-tinta/10"
            placeholder="Contrato o cédula…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={80}
          />
          <IdCard className="absolute left-1.5 top-2 h-3.5 w-3.5 text-tinta/40" />
        </div>
        )}

        {/* Año (solo en modo año; nunca en proyección) */}
        {modoAnio && !modoProyeccion && (
          <div className="min-w-[110px] flex-1">
            <SelectXuma
              valor={filtros.anio ?? ''}
              opciones={aniosHist}
              alCambiar={elegirAnio}
              placeholder="Año"
              etiquetaTodo="Todos los años"
              compact
            />
          </div>
        )}

        {/* Mes (en modo año se acota al año elegido; oculto en proyección) */}
        {!modoProyeccion && (
        <div className="min-w-[125px] flex-1">
          <SelectXuma
            valor={filtros.mes ?? ''}
            opciones={mesesVisibles}
            alCambiar={elegirMes}
            placeholder="Mes"
            etiquetaTodo="Todos los meses"
            compact
          />
        </div>
        )}

        {/* Clase de cartera (Deudor / Microseguros / Salvafactura / Otros).
            En todas las vistas, incluso proyección: la data manda y la clase
            recorta Gasera y Producto en cascada. */}
        {clases.length > 0 && (
          <div className="min-w-[125px] flex-1">
            <MultiSelectXuma
              valores={filtros.clase ?? []}
              opciones={clases}
              alCambiar={elegirClase}
              placeholder="Clase"
              etiquetaTodo="Todas las clases"
              compact
            />
          </div>
        )}

        {/* Aseguradora */}
        {aseguradoras.length > 0 && (
          <div className="min-w-[125px] flex-1">
            <MultiSelectXuma
              valores={filtros.aseguradora ?? []}
              opciones={aseguradoras}
              alCambiar={elegirAseguradora}
              placeholder="Aseguradora"
              etiquetaTodo="Todas aseguradoras"
              compact
            />
          </div>
        )}

        {/* Gasera */}
        <div className="min-w-[120px] flex-1">
          <MultiSelectXuma
            valores={filtros.gasera ?? []}
            opciones={gaseras}
            alCambiar={elegirGasera}
            placeholder="Gasera"
            etiquetaTodo="Todas las gaseras"
            compact
          />
        </div>

        {/* Producto */}
        <div className="min-w-[130px] flex-1">
          <MultiSelectXuma
            valores={filtros.producto ?? []}
            opciones={productos}
            alCambiar={elegirProducto}
            placeholder="Producto"
            etiquetaTodo="Todos los productos"
            compact
          />
        </div>

        {/* Estado (oculto en modo año y en proyección) */}
        {!modoAnio && !modoProyeccion && (
        <div className="min-w-[130px] flex-1">
          <MultiSelectXuma
            valores={filtros.estado ?? []}
            opciones={estados}
            alCambiar={elegirEstado}
            placeholder="Estado"
            etiquetaTodo="Todos los estados"
            compact
          />
        </div>
        )}

        {/* Tipo Siniestro (sólo para vistas que lo necesiten, e.j. mapa; oculto en proyección) */}
        {!modoAnio && !modoProyeccion && mostrarTipoSiniestro && tiposSiniestro.length > 0 && (
          <div className="min-w-[140px] flex-1">
            <MultiSelectXuma
              valores={filtros.tipo_siniestro ?? []}
              opciones={tiposSiniestro}
              alCambiar={elegirTipoSiniestro}
              placeholder="Tipo Siniestro"
              etiquetaTodo="Todos los tipos"
              compact
            />
          </div>
        )}

        {/* Acciones: solo indicador de carga inline al final */}
        <AnimatePresence mode="wait">
          {cargando && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8, x: 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center gap-1.5 shrink-0 ml-auto rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-3 py-1.5 text-xs font-medium text-xuma-verde-oscuro dark:text-xuma-verde-claro"
              role="status"
              aria-live="polite"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Actualizando…</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}