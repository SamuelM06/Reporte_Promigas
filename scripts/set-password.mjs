// Genera y escribe ADMIN_USER / ADMIN_PASSWORD_HASH (scrypt) en el .env local.
// Pide la contraseña por consola; la contraseña en sí NUNCA se guarda en el archivo.
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readlineSync } from './_prompt.mjs';

const ENV_PATH = fileURLToPath(new URL('../.env', import.meta.url));

const username = (await readlineSync('Usuario: ')).trim();
const password = await readlineSync('Contraseña (mínimo 8 caracteres): ', true);

if (!username) { console.error('El usuario no puede estar vacío.'); process.exit(1); }
if (password.length < 8) { console.error('La contraseña debe tener al menos 8 caracteres.'); process.exit(1); }

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');
const hashEntry = `${salt}:${hash}`;

let env = '';
if (existsSync(ENV_PATH)) env = await readFile(ENV_PATH, 'utf8');
else env = '# Variables de entorno locales\n';

const sinLinea = (bloque, lineaClave) =>
  bloque.split('\n').filter((l) => !l.trim().startsWith(`${lineaClave}=`)).join('\n');

env = sinLinea(env, 'ADMIN_USER');
env = sinLinea(env, 'ADMIN_PASSWORD_HASH');
env += `\nADMIN_USER=${username}\nADMIN_PASSWORD_HASH=${hashEntry}\n`;

await writeFile(ENV_PATH, env, 'utf8');
console.log('\n✅ Usuario y hash scrypt actualizados en .env');
console.log('   (la contraseña en texto plano NO quedó almacenada)');