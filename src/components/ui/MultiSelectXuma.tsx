import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  valores: string[];
  opciones: Opcion[];
  alCambiar: (valores: string[]) => void;
  placeholder: string;
  etiquetaTodo?: string;
  icono?: ReactNode;
  deshabilitado?: boolean;
  desplegableClase?: string;
  compact?: boolean;
}

// Selector múltiple con estética glass: lista vacía = Todos.
// Cada clic alterna sin cerrar, con casillas animadas y contador.
export default function MultiSelectXuma({ valores, opciones, alCambiar, placeholder, etiquetaTodo = 'Todos', icono, deshabilitado = false, desplegableClase = 'w-full', compact = false }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const seleccion = new Set(valores);
  const total = opciones.length;
  const elegidos = valores.filter((v) => opciones.some((o) => o.valor === v));
  const rotulo = elegidos.length === 0
    ? etiquetaTodo
    : elegidos.length === 1
      ? (opciones.find((o) => o.valor === elegidos[0])?.etiqueta ?? elegidos[0] ?? '')
      : `${elegidos.length} seleccionados`;

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const alternar = (v: string) => {
    const siguiente = new Set(valores);
    if (siguiente.has(v)) siguiente.delete(v);
    else siguiente.add(v);
    // Mantener el orden original de las opciones para etiquetas estables.
    alCambiar(opciones.map((o) => o.valor).filter((x) => siguiente.has(x)));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={deshabilitado}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        onClick={() => setAbierto((a) => !a)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border text-tinta outline-none transition-colors focus:bg-tinta/10 disabled:cursor-not-allowed disabled:opacity-50 ${
          abierto
            ? 'border-xuma-azul-3/60 bg-tinta/10'
            : 'border-tinta/15 bg-tinta/5 focus:border-xuma-verde-claro/70'
        } ${
          compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3.5 py-2.5 text-sm'
        }`}
      >
        {icono && <span className="shrink-0 text-tinta/60">{icono}</span>}
        <span className={`truncate text-left ${elegidos.length === 0 ? 'text-tinta/40' : ''}`}>
          {rotulo}
        </span>
        <AnimatePresence>
          {elegidos.length > 1 && (
            <motion.span
              key="contador"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 rounded-full bg-xuma-azul-3/15 px-1.5 py-0.5 text-[10px] leading-none font-bold text-xuma-azul-3 dark:text-xuma-violeta"
            >
              {elegidos.length}
            </motion.span>
          )}
        </AnimatePresence>
        <ChevronDown className={`ml-auto shrink-0 text-tinta/60 transition-transform duration-300 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.ul
            role="listbox"
            aria-label={placeholder}
            aria-multiselectable
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`glass absolute z-30 mt-2 rounded-2xl p-1.5 shadow-2xl ${desplegableClase}`}
            style={{ maxHeight: 'none', overflow: 'visible' }}
          >
            <li role="option" aria-selected={elegidos.length === 0}>
              <button
                type="button"
                onClick={() => alCambiar([])}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl text-left text-tinta/80 transition-colors hover:bg-tinta/10 ${
                  compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3 py-2 text-sm'
                } ${elegidos.length === 0 ? 'font-semibold' : ''}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${elegidos.length === 0 ? 'border-xuma-azul-3 bg-xuma-azul-3 text-white' : 'border-tinta/25 bg-transparent'}`}>
                  {elegidos.length === 0 && <Check className="h-3 w-3" />}
                </span>
                {etiquetaTodo}
              </button>
            </li>
            <li aria-hidden className="mx-2 my-1 border-t border-tinta/10" />
            {opciones.map((o) => {
              const activo = seleccion.has(o.valor);
              return (
                <li key={o.valor} role="option" aria-selected={activo}>
                  <button
                    type="button"
                    onClick={() => alternar(o.valor)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-tinta/10 ${
                      compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3 py-2 text-sm'
                    } ${
                      activo
                        ? 'bg-xuma-azul-3/10 font-semibold text-tinta'
                        : 'text-tinta/80'
                    }`}
                  >
                    <motion.span
                      initial={false}
                      animate={activo ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={{ duration: 0.22 }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors ${activo ? 'border-xuma-azul-3 bg-xuma-azul-3 text-white' : 'border-tinta/25 bg-transparent'}`}
                    >
                      {activo && <Check className="h-3 w-3" />}
                    </motion.span>
                    <span className="whitespace-normal break-words">{o.etiqueta}</span>
                  </button>
                </li>
              );
            })}
            {elegidos.length > 0 && (
              <li>
                <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5 text-[10px] text-tinta/50">
                  <span>{elegidos.length} de {total}</span>
                  <button
                    type="button"
                    onClick={() => alCambiar([])}
                    className="cursor-pointer font-semibold text-xuma-azul-3 hover:underline dark:text-xuma-violeta"
                  >
                    Limpiar
                  </button>
                </div>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
