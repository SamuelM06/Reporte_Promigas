import { estadoColorCat } from '../../lib/normalizacion';

export type EstadoCat = 'verde' | 'rojo' | 'ambar' | 'azul' | 'morado' | 'gris' | 'cyan';

export const ESTADO_STYLE: Record<EstadoCat, string> = {
  verde: 'bg-emerald-100/80 text-emerald-800 border-emerald-300/80 dark:bg-xuma-verde-claro/15 dark:text-xuma-verde-claro dark:border-xuma-verde-claro/40',
  rojo: 'bg-red-500/15 text-red-700 border-red-300/70 dark:text-red-300 dark:border-red-400/40',
  ambar: 'bg-amber-400/15 text-amber-800 border-amber-300/70 dark:text-amber-300 dark:border-amber-300/40',
  azul: 'bg-sky-400/15 text-sky-800 border-sky-300/70 dark:text-sky-300 dark:border-sky-300/40',
  cyan: 'bg-cyan-300/15 text-cyan-800 border-cyan-300/70 dark:text-cyan-200 dark:border-cyan-300/40',
  morado: 'bg-violet-400/15 text-violet-800 border-violet-300/70 dark:text-violet-300 dark:border-violet-300/40',
  gris: 'bg-tinta/10 text-tinta/75 border-tinta/20',
};

export function estadoBadge(estado: string): { cat: EstadoCat; cls: string } {
  const cat = estadoColorCat(estado);
  return { cat, cls: ESTADO_STYLE[cat] };
}
