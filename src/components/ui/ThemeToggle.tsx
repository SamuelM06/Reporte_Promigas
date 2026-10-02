import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const CLAVE = 'xuma_tema';

function leerTema(): 'claro' | 'oscuro' {
  if (typeof document === 'undefined') return 'oscuro';
  try {
    return localStorage.getItem(CLAVE) === 'claro' ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

function aplicar(tema: 'claro' | 'oscuro') {
  const root = document.documentElement;
  root.classList.toggle('dark', tema === 'oscuro');
  try {
    localStorage.setItem(CLAVE, tema === 'claro' ? 'claro' : 'oscuro');
  } catch { /* almacenamiento no disponible */ }
}

// Conmutador claro/oscuro (sol / luna) persistente; el tema oscuro es el predeterminado.
export default function ThemeToggle() {
  const [tema, setTema] = useState<'claro' | 'oscuro'>('oscuro');

  useEffect(() => {
    const t = leerTema();
    setTema(t);
    aplicar(t);
  }, []);

  const alternar = () => {
    const nuevo = tema === 'oscuro' ? 'claro' : 'oscuro';
    setTema(nuevo);
    aplicar(nuevo);
  };

  const oscuro = tema === 'oscuro';

  return (
    <motion.button
      type="button"
      onClick={alternar}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.9 }}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className="glass inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-tinta/85 transition-colors hover:bg-tinta/10"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={oscuro ? 'luna' : 'sol'}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="block h-4 w-4"
        >
          {oscuro ? (
            // Luna
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
                fill="#eef1fb"
                stroke="#8b7bff"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            // Sol
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="4.4" fill="#f0b429" />
              <g stroke="#f0b429" strokeWidth="1.8" strokeLinecap="round">
                <line x1="12" y1="1.8" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22.2" />
                <line x1="1.8" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22.2" y2="12" />
                <line x1="4.9" y1="4.9" x2="6.4" y2="6.4" />
                <line x1="17.6" y1="17.6" x2="19.1" y2="19.1" />
                <line x1="4.9" y1="19.1" x2="6.4" y2="17.6" />
                <line x1="17.6" y1="6.4" x2="19.1" y2="4.9" />
              </g>
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
      Tema
    </motion.button>
  );
}