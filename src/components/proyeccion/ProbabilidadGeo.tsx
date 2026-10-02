import { motion } from 'motion/react';
import type { ProbItem } from '../../lib/types';
import { formatNum } from '../../utils/formatters';

interface Props {
  data: ProbItem[];
}

export default function ProbabilidadLista({ data }: Props) {
  // Sin header interno: el Panel que lo envuelve ya lleva el título, y al
  // estar en fila de altura fija cada píxel cuenta (el último item, p.ej.
  // Caldas, se cortaba con overflow-hidden).
  return (
    <div className="min-h-0 flex-1 space-y-0.5">
      {data.map((d) => (
        <motion.div
          key={d.nombre}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 text-[11px]"
        >
          <span className="w-[100px] shrink-0 font-semibold text-tinta/80 truncate">{d.nombre}</span>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-tinta/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-xuma-verde-claro to-xuma-verde-oscuro"
                style={{ width: `${Math.min(100, d.prob * 200)}%` }}
              />
            </div>
          </div>
          <span className="w-[52px] text-right font-bold tabular">{(d.prob * 100).toFixed(1)}%</span>
          <span className="w-[72px] text-right tabular text-tinta/60">{formatNum(d.casos)}</span>
        </motion.div>
      ))}
    </div>
  );
}