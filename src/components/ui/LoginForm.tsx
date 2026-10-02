import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Lock, ShieldCheck, User } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Usuario y contraseña son obligatorios. Completa los campos vacíos.');
      return;
    }
    setCargando(true);
    try {
      const form = new FormData();
      form.set('username', username);
      form.set('password', password);
      const res = await fetch('/api/auth/login', { method: 'POST', body: form });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        window.location.assign('/dashboard');
        return;
      }
      setError(data.error ?? 'No se pudo iniciar sesión.');
    } catch {
      setError('Error de conexión. Intente nuevamente.');
    } finally {
      setCargando(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-tinta/15 bg-tinta/5 py-3 pr-4 pl-10 text-tinta placeholder-tinta/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-tinta/10';

  return (
    <motion.form
      onSubmit={enviar}
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass w-full max-w-sm space-y-4 rounded-3xl p-8"
      aria-label="Formulario de acceso"
      noValidate
    >
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-tinta">Acceso restringido</h1>
        <p className="text-sm text-tinta/60">Portal de siniestros Xuma · 2026</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-semibold text-tinta/75">Usuario</label>
        <div className="relative">
          <User className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-tinta/40" />
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
            placeholder="usuario"
            aria-invalid={!username.trim() && error !== ''}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-semibold text-tinta/75">Contraseña</label>
        <div className="relative">
          <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-tinta/40" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••"
            aria-invalid={!password && error !== ''}
          />
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-2 text-sm text-red-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={cargando}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-xuma-verde-claro py-3 font-bold text-[#0a1030] shadow-lg shadow-xuma-verde-claro/25 transition-colors hover:bg-xuma-verde-oscuro disabled:opacity-60"
      >
        {cargando ? (
          'Verificando…'
        ) : (
          <>
            Ingresar
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </motion.button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-tinta/40">
        <ShieldCheck className="h-3.5 w-3.5" />
        Sesión cifrada · intentos limitados
      </p>
    </motion.form>
  );
}