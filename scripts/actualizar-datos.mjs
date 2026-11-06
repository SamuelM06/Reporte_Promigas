// Actualiza la base de datos con el Excel de data/ en un solo comando.
// Uso: npm run actualizar
//
// Pasos: validar el Excel -> respaldo del archivo actual -> carga -> verificacion.
// No toca el Excel: solo lo lee. El respaldo va a backups/ (fuera de git).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const EXCEL = path.join(RAIZ, 'data', 'ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx');
const BACKUPS = path.join(RAIZ, 'backups');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'DataCenter_Promigas',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function sello() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const BACKUP_CONSERVAR = 5;

// --- 2.5 Poda de respaldos viejos: conserva solo los últimos BACKUP_CONSERVAR ---
function podarBackups() {
  try {
    const viejos = fs.readdirSync(BACKUPS)
      .filter((n) => /^ACUMULADO_\d{8}_\d{6}\.xlsx$/.test(n))
      .sort(); // el sello YYYYMMDD_HHMMSS ordena cronológicamente
    const sobrantes = viejos.slice(0, Math.max(0, viejos.length - BACKUP_CONSERVAR));
    for (const n of sobrantes) {
      fs.rmSync(path.join(BACKUPS, n), { force: true });
      console.log(`  poda respaldo viejo: ${n}`);
    }
  } catch (e) {
    console.log(`  aviso: no se pudieron podar respaldos (${e.message})`);
  }
}

async function main() {
  // --- 1. Validar el Excel ---
  if (!fs.existsSync(EXCEL)) {
    console.error('FAIL: no existe', EXCEL);
    process.exit(1);
  }
  const stat = fs.statSync(EXCEL);
  const wb = XLSX.read(fs.readFileSync(EXCEL), { cellDates: false, type: 'buffer' });
  if (!wb.Sheets['Base']) {
    console.error("FAIL: el Excel no tiene la hoja 'Base' (hojas: " + wb.SheetNames.join(', ') + ')');
    process.exit(1);
  }
  const filas = XLSX.utils.sheet_to_json(wb.Sheets['Base'], { header: 1, defval: null });
  let conDatos = 0;
  for (const r of filas.slice(1)) {
    if (r.slice(0, 20).some((v) => v !== null && String(v).trim() !== '')) conDatos++;
  }
  console.log(`Excel     : ${path.basename(EXCEL)} (${stat.size} bytes, modificado ${stat.mtime.toLocaleString('es-CO')})`);
  console.log(`Hoja Base : ${filas.length} filas, ${conDatos} con datos`);

  // --- 2. Respaldo ---
  fs.mkdirSync(BACKUPS, { recursive: true });
  const destino = path.join(BACKUPS, `ACUMULADO_${sello()}.xlsx`);
  fs.copyFileSync(EXCEL, destino);
  console.log(`Respaldo  : ${path.relative(RAIZ, destino)}`);
  podarBackups();

  // --- 3. Carga ---
  console.log('\n--- Cargando en la base de datos ---');
  const carga = spawnSync(process.execPath, [path.join(__dirname, 'load-excel.mjs')], {
    stdio: 'inherit',
    cwd: RAIZ,
  });
  if (carga.status !== 0) {
    console.error('\nFAIL: la carga fallo. La tabla puede haber quedado vacia (el loader hace TRUNCATE).');
    console.error(`      Restaura con:  npm run db:load   (o copia de nuevo el Excel y repite)`);
    process.exit(carga.status ?? 1);
  }

  // --- 4. Verificacion ---
  console.log('\n--- Verificacion ---');
  const r = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE fecha_ejecucion IS NULL)::int AS sin_fecha,
           COUNT(*) FILTER (WHERE fecha_ejecucion < '1990-01-01' OR fecha_ejecucion > '2030-12-31')::int AS fecha_anomala,
           COUNT(*) FILTER (WHERE fecha_venta < '1990-01-01' OR fecha_venta > '2030-12-31')::int AS venta_anomala,
           MIN(fecha_ejecucion) AS desde, MAX(fecha_ejecucion) AS hasta
      FROM reportes.reporte_promi`);
  const v = r.rows[0];
  console.log(`  filas en tabla      : ${v.total}`);
  console.log(`  sin fecha_ejecucion : ${v.sin_fecha} (${((v.sin_fecha / v.total) * 100).toFixed(2)}%)`);
  console.log(`  fecha_ejecucion rara: ${v.fecha_anomala} (anio fuera de 1990-2030)`);
  console.log(`  fecha_venta rara    : ${v.venta_anomala} (anio fuera de 1990-2030)`);
  console.log(`  rango               : ${v.desde ? v.desde.toISOString().slice(0, 10) : '-'} a ${v.hasta ? v.hasta.toISOString().slice(0, 10) : '-'}`);

  if (v.total !== conDatos) {
    console.error(`\nFAIL: el Excel tiene ${conDatos} filas con datos y la tabla quedo con ${v.total}.`);
    process.exit(1);
  }
  console.log(`\nOK: ${v.total} filas cargadas. El portal ya las muestra (la cache SSR se renueva en 10 s).`);
  if (v.sin_fecha || v.fecha_anomala || v.venta_anomala) {
    console.log('Aviso: quedan celdas que no se leen bien. Revisa con:  npm run auditar');
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error('FAIL:', e.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
