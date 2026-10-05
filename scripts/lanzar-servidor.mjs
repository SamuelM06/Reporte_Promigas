// ============================================================================
// LANZADOR ÚNICO del portal (producción).
// ----------------------------------------------------------------------------
// Hace, en orden y sin intervención, lo mismo que lanzar el servidor a mano:
//   1. Detiene la instancia anterior (si hay una ocupando el puerto).
//   2. Verifica dependencias (`npm ci` solo si falta node_modules).
//   3. Construye (`npm run build`); si falla, NO levanta nada.
//   4. Levanta scripts/serve.mjs en segundo plano con log en archivo.
//   5. Espera a que responda y verifica las 6 rutas.
//   6. Imprime los dos enlaces: local y red.
//
// Uso:  npm run servidor
//       PORT=4321 npm run servidor   (o $env:PORT=4322 en PowerShell)
//
// Idempotente: correrlo dos veces solo reinicia limpio.
// ============================================================================
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { networkInterfaces } from 'node:os';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '0.0.0.0';
const DIR_TMP = resolve(process.env.TEMP || process.env.TMPDIR || '/tmp', 'reporte-promigas');
const PIDFILE = resolve(DIR_TMP, `servidor-${PORT}.pid`);
const LOG = resolve(DIR_TMP, `servidor-${PORT}.log`);
const RUTAS = ['/', '/dashboard', '/por-gasera', '/por-gasera?page=2', '/detalle', '/politica-datos'];
const LISTO_MS = 90_000;
const PASO_MS = 750;

const log = (m) => console.log(`[lanzar] ${m}`);
const fallar = (m) => { console.error(`[lanzar] ERROR: ${m}`); process.exit(1); };

mkdirSync(DIR_TMP, { recursive: true });

// En Windows, `npm` es un .cmd y Node NO puede ejecutarlo sin shell
// (daría ENOENT aunque exista en el PATH). Se invoca como cadena completa
// con shell (sin array de args: así no hay DEP0190 ni problemas de escape).
// En POSIX corre igual vía /bin/sh.
const NPM_SHELL = true;

async function npmRun(script, timeoutMs) {
  const cmd = process.platform === 'win32' ? `npm.cmd ${script}` : `npm ${script}`;
  return exec(cmd, { cwd: RAIZ, timeout: timeoutMs, shell: NPM_SHELL, maxBuffer: 64 * 1024 * 1024 });
}

function describirFalloNpm(err) {
  const salir = (s) => (s ? String(s).trim().slice(-3000) : '');
  const partes = [
    salir(err?.stderr),
    salir(err?.stdout),
    err?.killed ? '(el proceso fue terminado por timeout)' : '',
  ].filter(Boolean);
  return partes.join('\n');
}

// --- 1) Detener instancia anterior -----------------------------------------
async function pidVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Solo se mata si la línea de comando es la de ESTE servidor (nunca un
// proceso ajeno que casualmente use el puerto). Windows: CIM; POSIX: ps.
async function esNuestro(pid) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await exec('powershell', [
        '-NoProfile', '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ], { timeout: 10_000 });
      return /serve\.mjs/.test(stdout);
    }
    const { stdout } = await exec('ps', ['-p', String(pid), '-o', 'args='], { timeout: 10_000 });
    return /serve\.mjs/.test(stdout);
  } catch {
    return false;
  }
}

// Busca el PID que escucha en el puerto (para cazar instancias sin pidfile).
async function pidEnPuerto(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await exec('powershell', [
        '-NoProfile', '-Command',
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`,
      ], { timeout: 10_000 });
      const pid = Number((stdout || '').trim());
      return Number.isFinite(pid) && pid > 0 ? pid : null;
    }
    const { stdout } = await exec('sh', ['-c', `lsof -tiTCP:${port} -sTCP:LISTEN | head -1`], { timeout: 10_000 }).catch(() => ({ stdout: '' }));
    const pid = Number((stdout || '').trim());
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function esperarPuertoLibre(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const pid = await pidEnPuerto(PORT);
    if (pid === null) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function detenerAnteriores() {
  const candidatos = new Set();
  if (existsSync(PIDFILE)) {
    const pid = Number((readFileSync(PIDFILE, 'utf8') || '').trim());
    if (Number.isFinite(pid) && pid > 0 && (await pidVivo(pid)) && (await esNuestro(pid))) {
      candidatos.add(pid);
    }
    rmSync(PIDFILE, { force: true });
  }
  const otro = await pidEnPuerto(PORT);
  if (otro !== null && (await pidVivo(otro)) && (await esNuestro(otro))) candidatos.add(otro);

  if (candidatos.size === 0) {
    const ocupado = (await pidEnPuerto(PORT)) !== null;
    if (ocupado) fallar(`el puerto ${PORT} está ocupado por OTRO programa (no es el servidor del portal). Libéralo o usa otro puerto.`);
    log(`puerto ${PORT} libre, no hay instancia anterior.`);
    return;
  }
  for (const pid of candidatos) {
    log(`deteniendo instancia anterior (PID ${pid})...`);
    try { process.kill(pid, 'SIGTERM'); } catch { /* ya murió */ }
  }
  // Si no se suelta con SIGTERM en 10 s, se fuerza (Windows no lo implementa
  // de la misma forma que POSIX; process.kill basta en la práctica).
  if (!(await esperarPuertoLibre(10_000))) {
    for (const pid of candidatos) {
      try { process.kill(pid, 'SIGKILL'); } catch { /* ya murió */ }
    }
    if (!(await esperarPuertoLibre(10_000))) {
      fallar(`no se pudo liberar el puerto ${PORT}. Ciérralo a mano e inténtalo de nuevo.`);
    }
  }
  log('instancia anterior detenida.');
}

// --- 2) Dependencias --------------------------------------------------------
async function asegurarDependencias() {
  if (existsSync(resolve(RAIZ, 'node_modules'))) {
    log('dependencias OK (node_modules existe).');
    return;
  }
  log('node_modules no existe: instalando con `npm ci` (solo la primera vez)...');
  try {
    await npmRun('ci', 600_000);
  } catch (err) {
    fallar(`fallo \`npm ci\`:\n${describirFalloNpm(err)}`);
  }
  log('dependencias instaladas.');
}

// --- 3) Build ---------------------------------------------------------------
async function construir() {
  log('construyendo (`npm run build`)...');
  try {
    await npmRun('run build', 600_000);
  } catch (err) {
    fallar(`el build fallo y el servidor NO se levanto. Revisa el error:\n${describirFalloNpm(err)}`);
  }
  log('build OK.');
}

// --- 4) Levantar en segundo plano -------------------------------------------
function levantar() {
  const fd = openSync(LOG, 'a');
  const hijo = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: RAIZ,
    detached: true,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, PORT: String(PORT), HOST },
    windowsHide: true,
  });
  hijo.unref();
  writeFileSync(PIDFILE, String(hijo.pid));
  log(`servidor lanzado en segundo plano (PID ${hijo.pid}). Log: ${LOG}`);
  return hijo.pid;
}

// --- 5) Esperar + verificar ---------------------------------------------------
async function esperarListo() {
  const t0 = Date.now();
  const base = `http://127.0.0.1:${PORT}`;
  while (Date.now() - t0 < LISTO_MS) {
    try {
      const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        await r.text().catch(() => '');
        return { base, ms: Date.now() - t0 };
      }
    } catch { /* aún no responde */ }
    await new Promise((r) => setTimeout(r, PASO_MS));
  }
  return null;
}

async function verificarRutas(base) {
  const filas = [];
  for (const ruta of RUTAS) {
    try {
      const r = await fetch(`${base}${ruta}`, { signal: AbortSignal.timeout(30_000) });
      await r.text().catch(() => '');
      filas.push({ ruta, ok: r.ok, estado: r.status });
    } catch (e) {
      filas.push({ ruta, ok: false, estado: `ERROR ${e?.message ?? e}` });
    }
  }
  return filas;
}

// --- 6) Enlaces ----------------------------------------------------------------
function ipRed() {
  for (const ifs of Object.values(networkInterfaces())) {
    for (const nic of ifs ?? []) {
      if (nic.family === 'IPv4' && !nic.internal) return nic.address;
    }
  }
  return null;
}

const base = `http://localhost:${PORT}`;

// --- Principal -----------------------------------------------------------------
await detenerAnteriores();
await asegurarDependencias();
await construir();
levantar();

const listo = await esperarListo();
if (!listo) {
  fallar(`el servidor no respondió en ${Math.round(LISTO_MS / 1000)} s. Mira el final del log:\n${LOG}`);
}

const filas = await verificarRutas(listo.base);
const malas = filas.filter((f) => !f.ok);
log(`servidor listo en ${(listo.ms / 1000).toFixed(1)} s. Rutas:`);
  for (const f of filas) console.log(`   [${f.ok ? 'OK' : 'X'}] ${f.ruta.padEnd(22)} -> ${f.estado}`);
  if (malas.length > 0) {
    fallar(`${malas.length} ruta(s) fallaron. El servidor SIGUE corriendo; revisa el log:\n${LOG}`);
  }

const lan = ipRed();
// Salida en ASCII plano a proposito: la consola de Windows (PowerShell 5.1)
// muestra los emojis y las cajas Unicode como mojibake.
console.log('');
console.log('==============================================================');
console.log('  Portal Gestion Diaria Promigas 2026 - en linea');
console.log('--------------------------------------------------------------');
console.log(`  Local:  ${base}`);
console.log(`  Red:    ${lan ? `http://${lan}:${PORT}` : '(no se detecto IP de red)'}`);
console.log('--------------------------------------------------------------');
console.log(`  Log:     ${LOG}`);
console.log('  Detener: vuelve a correr `npm run servidor` (reinicia limpio)');
console.log('==============================================================');
