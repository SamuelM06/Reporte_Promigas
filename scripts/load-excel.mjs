// Carga hoja Base del Excel a reportes.reporte_promi.
// Uso: npm run db:load
// - Lee data/ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx, hoja Base, primeras 19 columnas.
// - Omite filas totalmente vacías (751 al final son artefacto de Excel).
// - Parseo robusto de fechas serial + texto.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL = path.join(__dirname, '..', 'data', 'ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'DataCenter_Promigas',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

function normUpper(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.toUpperCase().replace(/\s+/g, ' ').trim();
}

function excelSerialToISO(n) {
  // Excel epoch 1899-12-30
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseFecha(v) {
  if (v == null || v === '') return { date: null, raw: null };
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 60000) {
    return { date: excelSerialToISO(v), raw: String(v) };
  }
  const s = String(v).trim();
  if (!s || /^N\/?A$/i.test(s)) return { date: null, raw: s };
  // 13/012026 -> 13/01/2026
  let m = s.match(/^(\d{1,2})\/(\d{2})(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return { date: iso, raw: s };
  }
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = '20' + y;
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return { date: iso, raw: s };
    return { date: null, raw: s };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { date: s.slice(0, 10), raw: s };
  const d = new Date(s);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2035) {
    return { date: d.toISOString().slice(0, 10), raw: s };
  }
  return { date: null, raw: s };
}

function parseAnio(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) return null;
  const y = Math.trunc(n);
  return y >= 1900 && y <= 2035 ? y : null;
}

function clean(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function main() {
  console.log('Leyendo', EXCEL);
  const buf = fs.readFileSync(EXCEL);
  const wb = XLSX.read(buf, { cellDates: false, type: 'buffer' });
  const ws = wb.Sheets['Base'];
  if (!ws) throw new Error('No existe hoja Base');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  console.log('Filas inc header:', rows.length);
  const data = [];
  for (const r of rows.slice(1)) {
    const first19 = r.slice(0, 19);
    const has = first19.some((v) => v !== null && String(v).trim() !== '');
    if (!has) continue;
    data.push(first19);
  }
  console.log('Filas con datos:', data.length);

  await pool.query('TRUNCATE TABLE reportes.reporte_promi');

  const cols = ['distribuidora','aseguradora','medio_recepcion','contrato','localidad','operador','canal','producto','tipo_contacto','estado','subtipificacion','motivo','fecha_ejecucion','base_raw','fecha_venta','fecha_venta_raw','asesor_venta','mes','cabina','anio','distribuidora_norm','aseguradora_norm','canal_norm','cabina_norm','estado_norm','mes_norm'];
  const BATCH = 1000;
  let ok = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    const values = [];
    const ph = [];
    chunk.forEach((r, bi) => {
      const [dist, aseg, medio, contrato, localidad, operador, canal, producto, tipo, estado, subt, motivo, fEjec, base, fVenta, asesor, mes, cabina, anio] = r;
      const fe = parseFecha(fEjec);
      const fv = parseFecha(fVenta);
      const row = [
        clean(dist), clean(aseg), clean(medio), clean(contrato), clean(localidad), clean(operador), clean(canal), clean(producto), clean(tipo), clean(estado), clean(subt), clean(motivo),
        fe.date, clean(base) ?? (fEjec != null ? String(fEjec) : null),
        fv.date, fv.raw,
        clean(asesor), clean(mes), clean(cabina), parseAnio(anio),
        normUpper(dist), normUpper(aseg), normUpper(canal), normUpper(cabina), normUpper(estado), normUpper(mes),
      ];
      const base_idx = bi * row.length;
      ph.push(`(${row.map((_, k) => `$${base_idx + k + 1}`).join(',')})`);
      values.push(...row);
    });
    await pool.query(`INSERT INTO reportes.reporte_promi (${cols.join(',')}) VALUES ${ph.join(',')}`, values);
    ok += chunk.length;
    console.log(`  ${ok}/${data.length}`);
  }
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM reportes.reporte_promi');
  console.log('TOTAL EN TABLA:', c.rows[0].n);
  await pool.end();
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });
