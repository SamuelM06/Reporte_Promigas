// Auditoria de calidad del Excel fuente: data/ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx
// Uso: npm run auditar
//
// NO modifica nada. Solo reporta que celdas no se van a leer bien por
// scripts/load-excel.mjs y deja un CSV con la fila exacta a corregir.
//
// El parseo de fechas de abajo es una COPIA del de load-excel.mjs: si se cambia
// uno hay que cambiar el otro, o la auditoria miente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..');
const EXCEL = path.join(RAIZ, 'data', 'ACUMULADO_ENERO_DICIEMBRE_2026_PROMI.xlsx');
const SALIDA = path.join(RAIZ, 'CORRECCIONES_PENDIENTES.csv');

// Columnas que espera el loader (posicionales, 0-based).
const COLUMNAS = [
  'DISTRIBUIDORA', 'ASEGURADORA', 'MEDIO DE RECEPCION', 'CONTRATO', 'LOCALIDAD',
  'OPERADOR', 'CANAL', 'PRODUCTO', 'TIPO DE CONTACTO', 'ESTADO', 'SUBTIPIFICACION',
  'MOTIVO', 'FECHA DE EJECUCION', 'BASE', 'fecha de venta', 'asesor de venta',
  'Mes', 'Cabina', 'AÑO', 'CLASIFICACION',
];

// ---------- COPIA de load-excel.mjs ----------
function excelSerialToISO(n) {
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
// ---------- fin de la copia ----------

const anioDe = (fecha) => {
  const m = /^(\d{1,4})-/.exec(fecha || '');
  return m ? Number(m[1]) : null;
};
const esVacio = (v) => v === null || v === undefined || String(v).trim() === '';
const pareceFecha = (v) => typeof v === 'number' || /\d{1,4}\s*[\/\-]\s*\d{1,2}/.test(String(v));

function main() {
  if (!fs.existsSync(EXCEL)) {
    console.error('FAIL: no existe', EXCEL);
    process.exit(1);
  }
  const buf = fs.readFileSync(EXCEL);
  const wb = XLSX.read(buf, { cellDates: false, type: 'buffer' });

  console.log('Archivo :', path.relative(RAIZ, EXCEL));
  console.log('Hojas   :', wb.SheetNames.join(', '));
  const ws = wb.Sheets['Base'];
  if (!ws) {
    console.error("FAIL: no existe la hoja 'Base'. El loader solo lee esa hoja.");
    process.exit(1);
  }
  const ref = XLSX.utils.decode_range(ws['!ref']);
  const maxRow = ref.e.r + 1;

  // Encabezados
  const cel = (f, c) => ws[XLSX.utils.encode_cell({ r: f - 1, c })];
  const val = (f, c) => { const x = cel(f, c); return x && x.v !== undefined ? x.v : null; };
  const head = [];
  for (let c = 0; c < COLUMNAS.length; c++) head.push(String(val(1, c) ?? '').trim());
  const headOk = head.every((h, i) => h.toUpperCase() === COLUMNAS[i].toUpperCase());
  console.log('Encabezados A..T:', headOk ? 'OK (coinciden con lo esperado)' : 'DIFIEREN');
  if (!headOk) {
    console.table(COLUMNAS.map((exp, i) => ({ col: XLSX.utils.encode_col(i), esperado: exp, encontrado: head[i] })));
  }

  // Recorrido fila a fila
  const problemas = [];
  for (let f = 2; f <= maxRow; f++) {
    const m = val(f, 12), n = val(f, 13), o = val(f, 14);
    if (esVacio(m) && esVacio(n) && esVacio(o) && esVacio(val(f, 0))) continue;
    const ctx = {
      fila: f,
      dist: val(f, 0),
      contrato: val(f, 3),
      mes: val(f, 16),
    };

    // --- Columna M: FECHA DE EJECUCION ---
    const pm = parseFecha(m);
    if (esVacio(m)) {
      const pn = parseFecha(n);
      if (pn.date) {
        problemas.push({
          ...ctx, col: 'M', tipo: 'FECHA DE EJECUCION vacia (la fecha esta en BASE)',
          valor: '(vacia)', sugerido: pn.date.split('-').reverse().join('/'),
          nota: `BASE=${n}`,
        });
      } else if (!esVacio(n)) {
        problemas.push({ ...ctx, col: 'M', tipo: 'FECHA DE EJECUCION vacia', valor: '(vacia)', sugerido: '', nota: `BASE=${n} (tampoco se puede leer)` });
      } else {
        problemas.push({ ...ctx, col: 'M', tipo: 'FECHA DE EJECUCION y BASE vacias', valor: '(vacia)', sugerido: '', nota: 'no recuperable desde el Excel' });
      }
    } else if (!pm.date) {
      const s = String(m).trim();
      const mmdd = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const y3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{3})$/);
      let tipo = 'no se puede leer';
      let sugerido = '';
      if (mmdd && Number(mmdd[2]) > 12) {
        tipo = 'formato mm/dd/yyyy (el loader lee dd/mm/yyyy)';
        sugerido = `${mmdd[2].padStart(2, '0')}/${mmdd[1].padStart(2, '0')}/${mmdd[3]}`;
      } else if (y3) {
        tipo = 'anio de 3 digitos';
        sugerido = `${y3[1].padStart(2, '0')}/${y3[2].padStart(2, '0')}/${y3[3][0]}0${y3[3].slice(1)}`;
      } else if (mmdd) {
        tipo = 'fecha con formato dd/mm/yyyy incompleto';
      }
      problemas.push({ ...ctx, col: 'M', tipo, valor: s, sugerido, nota: `BASE=${n}` });
    } else {
      const a = anioDe(pm.date);
      if (a !== null && (a < 1990 || a > 2030)) {
        const s = String(m).trim();
        const y3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{3})$/);
        problemas.push({
          ...ctx, col: 'M', tipo: `anio invalido (${a})`,
          valor: s,
          sugerido: y3 ? `${y3[1].padStart(2, '0')}/${y3[2].padStart(2, '0')}/${y3[3][0]}0${y3[3].slice(1)}` : '',
          nota: `BASE=${n}`,
        });
      }
    }

    // --- Columna O: fecha de venta ---
    const po = parseFecha(o);
    if (!esVacio(o) && !po.date && pareceFecha(o)) {
      const s = String(o).trim();
      const y3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{3})$/);
      problemas.push({
        ...ctx, col: 'O', tipo: 'fecha de venta no se puede leer',
        valor: s,
        sugerido: y3 ? `${y3[1].padStart(2, '0')}/${y3[2].padStart(2, '0')}/${y3[3][0]}0${y3[3].slice(1)}` : '',
        nota: '',
      });
    } else if (po.date) {
      const a = anioDe(po.date);
      if (a !== null && (a < 1990 || a > 2030)) {
        const s = String(o).trim();
        const y3 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{3})$/);
        problemas.push({
          ...ctx, col: 'O', tipo: `anio invalido (${a})`,
          valor: s,
          sugerido: y3 ? `${y3[1].padStart(2, '0')}/${y3[2].padStart(2, '0')}/${y3[3][0]}0${y3[3].slice(1)}` : '',
          nota: '',
        });
      }
    }
  }

  const resumen = new Map();
  for (const p of problemas) {
    const k = `${p.col} | ${p.tipo}`;
    resumen.set(k, (resumen.get(k) || 0) + 1);
  }
  console.log('\n=== CELDAS QUE NO SE LEEN BIEN ===');
  if (!problemas.length) console.log('  (ninguna: el Excel se carga 100% limpio)');
  else console.table([...resumen].map(([k, n]) => ({ problema: k, celdas: n })));

  const csv = ['fila_excel,columna,distribuidora,contrato,mes,problema,valor_actual,valor_sugerido,nota']
    .concat(problemas.map((p) => [p.fila, p.col, p.dist, p.contrato, p.mes, `"${p.tipo}"`, `"${p.valor}"`, `"${p.sugerido}"`, `"${p.nota}"`].join(',')))
    .join('\n');
  fs.writeFileSync(SALIDA, '\uFEFF' + csv, 'utf8');
  console.log(`\nDetalle celda por celda: ${path.relative(RAIZ, SALIDA)} (${problemas.length} filas)`);
}

main();
