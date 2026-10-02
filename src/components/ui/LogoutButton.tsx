import { useState } from 'react';
import { motion } from 'motion/react';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const [cargando, setCargando] = useState(false);

  async function salir() {
    setCargando(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/login');
    }
  }

  return (
    <motion.button
      type="button"
      onClick={salir}
      disabled={cargando}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="glass glass-hover inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-tinta/85 transition-colors hover:bg-tinta/10 disabled:opacity-60"
      aria-label="Cerrar sesión"
    >
      {cargando ? 'Saliendo…' : (
        <>
          <LogOut className="h-4 w-4" />
          Salir
        </>
      )}
    </motion.button>
  );
}