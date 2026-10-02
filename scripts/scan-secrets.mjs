// ============================================================================
// ESCÁNER DE SECRETOS
// ----------------------------------------------------------------------------
// Por qué existe: el proyecto ya tuvo una contraseña de la BD escrita en texto
// plano DENTRO de un archivo versionado (`context/walkthrough.md`, commits
// c2ae307 / ff0f58e). El escaneo previo solo miraba scripts sueltos y no
// cubría `context/`, que es justo donde se coló.
//
// Este escaneo recorre TODOS los archivos versionados por git (no los
// ignorados), así que un `.gitignore` mal puesto no lo esquiva.
//
// No busca un valor concreto: busca PATRONES de "esto parece una credencial".
// Así avisa la próxima vez sin tener que acordarse de la contraseña anterior.
//
// Uso:
//   node scripts/scan-secrets.mjs           (solo informativo)
//   node scripts/scan-secrets.mjs --strict  (sale con código 1 si encuentra algo)
// ============================================================================
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ESTRICTO = process.argv.includes('--strict');

// Directorios que nunca aportan ruido: no se versionan, no se escanean.
const EXCLUIDOS = new Set(['node_modules', 'dist', '.astro', '.git', 'logs', 'coverage']);

// Extensiones que legítimamente guardan binarios o_LOCK no texto.
const BINARIOS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.xlsx', '.zip', '.woff', '.woff2', '.ttf', '.map', '.geojson']);

const REGLAS = [
  {
    nombre: 'Password de BD en texto plano',
    // Coincide con DB_PASSWORD=valor, pero no con los placeholders de ejemplo.
    re: /DB_PASSWORD\s*[=:]\s*["']?([^\s"'#]{6,})/gi,
    permitir: /^(tu_|x?uma?bd\d{4}\*?$|changeme|password|<|\$\{|process\.env|placeholder|ejemplo|example|secret$)/i,
    contexto: 'Sustituye el valor real por una referencia a la variable de entorno.',
  },
  {
    nombre: 'Asignación de password/secret en código',
    re: /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']([^"']{8,})["']/gi,
    permitir: /^(your|changeme|placeholder|example|tu_|xxx|\$\{|process\.env|undefined|null)/i,
    contexto: 'Lee el valor de process.env / import.meta.env, no lo escribas.',
  },
  {
    nombre: 'Hash de sesión con valor literal',
    re: /SESSION_SECRET\s*=\s*["']?([0-9a-f]{32,})["']?/gi,
    permitir: /^$/,
    contexto: 'SESSION_SECRET debe vivir solo en el entorno o en un gestor de secretos.',
  },
  {
    nombre: 'IP interna de la base de datos',
    re: /\b(?:DB_HOST\s*=\s*|host:\s*["'])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi,
    permitir: /^(0\.0\.0\.0|127\.0\.0\.1|localhost)/i,
    contexto: 'Usa un nombre DNS o una variable de entorno en vez de la IP cruda.',
  },
  {
    nombre: 'Cadena de conexión completa con credenciales',
    re: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi,
    permitir: /^postgres(?:ql)?:\/\/[^:]+:\*\*?@/i,
    contexto: 'Separa usuario y contraseña; no pegues la URL completa.',
  },
];

function archivosVersionados() {
  let salida = '';
  try {
    salida = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch {
    console.error('No se pudo ejecutar `git ls-files`. El escaneo necesita estar dentro de un repo.');
    process.exit(2);
  }
  return salida.split('\0').filter(Boolean);
}

/** Un archivo borrado del disco pero aún en el índice no se puede leer. */
function enDisco(ruta) {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    return null;
  }
}

function esLegible(ruta) {
  if (BINARIOS.has(ruta.slice(ruta.lastIndexOf('.')).toLowerCase())) return false;
  if (ruta.includes('/logs/') || ruta.startsWith('logs/')) return false;
  // .env y .env.example nunca se escanean: el primero está ignorado por git y el
  // segundo es una plantilla pública con placeholders por definición.
  const base = ruta.split('/').pop() ?? ruta;
  if (base === '.env' || base.startsWith('.env.')) return false;
  return true;
}

function revisar(ruta, contenido) {
  const hallazgos = [];
  for (const regla of REGLAS) {
    // Patrón global: se recrea en cada archivo para no arrastrar lastIndex.
    const re = new RegExp(regla.re.source, regla.re.flags);
    let m;
    while ((m = re.exec(contenido)) !== null) {
      const valor = m[1] ?? m[0];
      if (!valor || regla.permitir.test(valor.trim())) continue;
      const linea = contenido.slice(0, m.index).split('\n').length;
      hallazgos.push({ ruta, linea, nombre: regla.nombre, valor, contexto: regla.contexto });
      // Una coincidencia por archivo y regla: es suficiente para avisar.
      break;
    }
  }
  return hallazgos;
}

const archivos = archivosVersionados().filter(esLegible);
const todos = [];

// Se lee del DISCO, no del índice de git (`git show :archivo`): el caso de uso
// real es "acabo de escribir un secreto y todavía no he hecho `git add`". En CI
// el working tree es el checkout, así que el resultado es el mismo.
for (const ruta of archivos) {
  const crudo = enDisco(ruta);
  if (crudo === null) continue; // borrado, submodule o ilegible
  const contenido = crudo.charCodeAt(0) === 0xfeff ? crudo.slice(1) : crudo;
  todos.push(...revisar(ruta, contenido));
}

console.log(`[scan-secrets] ${archivos.length} archivo(s) versionado(s) revisado(s).`);

if (todos.length === 0) {
  console.log('[scan-secrets] ✅ Sin credenciales en texto plano en los archivos versionados.');
  process.exit(0);
}

console.error(`\n[scan-secrets] ❌ ${todos.length} hallazgo(s):\n`);
for (const h of todos) {
  console.error(`  ${h.ruta}:${h.linea}  [${h.nombre}]`);
  console.error(`      valor: ${h.valor.slice(0, 60)}${h.valor.length > 60 ? '…' : ''}`);
  console.error(`      qué hacer: ${h.contexto}\n`);
}
console.error(
  '[scan-secrets] Recuerda: sanear el archivo NO invalida una credencial ya expuesta.\n' +
    '[scan-secrets] Si es una contraseña real, rótala en el origen además de limpiarla.',
);

process.exit(ESTRICTO ? 1 : 0);
