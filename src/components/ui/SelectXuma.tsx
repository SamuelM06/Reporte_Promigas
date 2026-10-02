import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

interface Opcion {
  valor: string;
  etiqueta: string;
}

interface Props {
  valor: string;
  opciones: Opcion[];
  alCambiar: (valor: string) => void;
  placeholder: string;
  etiquetaTodo?: string;
  icono?: ReactNode;
  deshabilitado?: boolean;
  desplegableClase?: string;
  compact?: boolean;
}

// Selector desplegable con estética glass (evita los options nativos de fondo blanco).
export default function SelectXuma({ valor, opciones, alCambiar, placeholder, etiquetaTodo = 'Todos', icono, deshabilitado = false, desplegableClase = 'w-full', compact = false }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const actual = opciones.find((o) => o.valor === valor);

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

  const elegir = (v: string) => {
    alCambiar(v);
    setAbierto(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={deshabilitado}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        onClick={() => setAbierto((a) => !a)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border border-tinta/15 bg-tinta/5 text-tinta outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-tinta/10 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3.5 py-2.5 text-sm'
        }`}
      >
        {icono && <span className="shrink-0 text-tinta/60">{icono}</span>}
        <span className={`truncate text-left ${valor ? '' : 'text-tinta/40'}`}>
          {valor ? (actual?.etiqueta ?? valor) : etiquetaTodo}
        </span>
        <ChevronDown className={`ml-auto shrink-0 text-tinta/60 transition-transform duration-300 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${abierto ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {abierto && (
          <motion.ul
            role="listbox"
            aria-label={placeholder}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`glass absolute z-30 mt-2 max-h-64 overflow-auto rounded-2xl p-1.5 shadow-2xl ${desplegableClase}`}
          >
            <li role="option" aria-selected={valor === ''}>
              <button
                type="button"
                onClick={() => elegir('')}
                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl text-left text-tinta/80 transition-colors hover:bg-tinta/10 ${
                  compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3 py-2 text-sm'
                }`}
              >
                {etiquetaTodo}
                {valor === '' && <Check className="h-4 w-4 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
              </button>
            </li>
            {opciones.map((o) => (
              <li key={o.valor} role="option" aria-selected={valor === o.valor}>
                <button
                  type="button"
                  onClick={() => elegir(o.valor)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl text-left transition-colors hover:bg-tinta/10 ${
                    compact ? 'px-2.5 py-1.5 text-xs rounded-lg' : 'px-3 py-2 text-sm'
                  } ${
                    valor === o.valor
                      ? 'bg-xuma-verde-claro/15 font-semibold text-xuma-verde-oscuro dark:text-xuma-verde-claro'
                      : 'text-tinta/80'
                  }`}
                >
                  <span className="whitespace-normal break-words">{o.etiqueta}</span>
                  {valor === o.valor && <Check className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}