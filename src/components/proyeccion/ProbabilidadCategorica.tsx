import { motion } from 'motion/react';
import type { ProbItem } from '../../lib/types';
import { formatNum } from '../../utils/formatters';

interface Props {
  titulo: string;
  data: ProbItem[];
}

export default function ProbabilidadCategorica({ titulo, data }: Props) {
  return (
    <div className="space-y-1">
      <header className="flex items-center gap-1.5 text-xs font-bold text-tinta mb-1">{titulo}</header>
      {data.map((d) => (
        <motion.div
          key={d.nombre}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 text-[11px]"
        >
          <span className="w-[110px] shrink-0 font-semibold text-tinta/80 truncate">{d.nombre}</span>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-tinta/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-xuma-violeta to-xuma-ambar"
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