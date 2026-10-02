import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Panel vidrio (glassmorphism) con animación de entrada escalonada.
export default function Panel({ titulo, icono, children, className = '', delay = 0 }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass rounded-3xl p-4 ${className}`}
    >
      {titulo && (
        <header className="mb-2 flex items-center gap-2">
          {icono && <span className="text-lg">{icono}</span>}
          <h2 className="text-sm font-bold text-tinta md:text-base">{titulo}</h2>
        </header>
      )}
      {children}
    </motion.section>
  );
}