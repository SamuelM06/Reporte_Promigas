// ============================================================================
// GENERACIÓN DEL .XLSX ESTILIZADO (SOLO SERVIDOR)
// ----------------------------------------------------------------------------
// Replica el diseño de la tabla web de detalle: banda de título, encabezado
// con los colores de marca, badges de Estado por categoría, formato de moneda
// y fecha reales, cebra de filas, bordes, autofiltro, panel congelado y totales.
//
// Se usa `exceljs` (el import por defecto es obligatorio: el paquete es CJS y
// Node no expone sus exports nombrados en ESM). Corre en el servidor, así que
// no pesa nada en el bundle del navegador.
// ============================================================================
import ExcelJS from 'exceljs';
import { estadoColorCat } from './normalizacion';
import { formatAseguradoExcel } from '../utils/formatters';
import type { RegistroTabla } from './types';

// Paleta de marca ( Tailwind: xuma-verde-oscuro / xuma-nube / tinta )
const TINTA = 'FF0C102A';
const VERDE = 'FF00CD93';
const VERDE_OSCURO = 'FF00875F';
const NUBE = 'FFF4F6FB';
const CEBRA = 'FFF8FAFD';
const BORDE = 'FFE2E8F0';
const GRIS_TXT = 'FF64748B';

// Badge de Estado: mismo color por categoría que `estadoBadge` en la web.
const BADGE: Record<string, { fill: string; font: string; border: string }> = {
  verde: { fill: 'FFD1FAE5', font: 'FF065F46', border: 'FF6EE7B7' },
  rojo: { fill: 'FFFEE2E2', font: 'FF991B1B', border: 'FFFCA5A5' },
  ambar: { fill: 'FFFEF3C7', font: 'FF92400E', border: 'FFFCD34D' },
  azul: { fill: 'FFE0F2FE', font: 'FF075985', border: 'FF7DD3FC' },
  cyan: { fill: 'FFCFFAFE', font: 'FF155E75', border: 'FF67E8F9' },
  morado: { fill: 'FFEDE9FE', font: 'FF5B21B6', border: 'FFC4B5FD' },
  gris: { fill: 'FFEEF1FB', font: 'FF334155', border: 'FFCBD5E1' },
};

const COLUMNAS = [
  { header: 'CONTRATO', key: 'contrato', width: 15 },
  { header: 'ASEGURADO', key: 'asegurado', width: 30 },
  { header: 'ASEGURADORA', key: 'aseguradora', width: 22 },
  { header: 'GASERA', key: 'gasera', width: 20 },
  { header: 'CLASE', key: 'clase', width: 16 },
  { header: 'PRODUCTO', key: 'producto', width: 28 },
  { header: 'ESTADO', key: 'estado', width: 22 },
  { header: 'RADICACIÓN', key: 'fecha', width: 14 },
  { header: 'MONTO', key: 'monto', width: 18 },
] as const;

const FILA_ENCABEZADO = 4;
const BORDE_FINO = { style: 'thin' as const, color: { argb: BORDE } };

export interface MetaExport {
  titulo: string;
  subtitulo: string;
  generado: Date;
}

// pg entrega las columnas DATE como objetos Date (no texto), aunque el tipo
// compartido las declare como string: se aceptan las dos formas.
function aFecha(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v);
  const d = new Date(/^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(0, 10)}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Construye el libro y devuelve el .xlsx como Buffer.
export async function construirExcelDetalle(
  registros: RegistroTabla[],
  meta: MetaExport,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Portal Siniestros Xuma';
  libro.created = meta.generado;
  const hoja = libro.addWorksheet('Siniestros', {
    views: [{ state: 'frozen', ySplit: FILA_ENCABEZADO }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.columns = COLUMNAS.map((c) => ({ key: c.key, width: c.width }));

  const numCols = COLUMNAS.length;

  // 1) Banda de título
  hoja.mergeCells(1, 1, 1, numCols);
  const t = hoja.getCell(1, 1);
  t.value = meta.titulo;
  t.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TINTA } };
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  hoja.getRow(1).height = 34;

  // 2) Subtítulo: filtros aplicados + fecha de generación
  hoja.mergeCells(2, 1, 2, numCols);
  const s = hoja.getCell(2, 1);
  s.value = `${meta.subtitulo}   ·   Generado el ${meta.generado.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;
  s.font = { name: 'Calibri', size: 10, italic: true, color: { argb: GRIS_TXT } };
  s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NUBE } };
  s.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  hoja.getRow(2).height = 20;
  hoja.getRow(3).height = 6;

  // 3) Encabezado con los colores de marca
  const enc = hoja.getRow(FILA_ENCABEZADO);
  enc.values = COLUMNAS.map((c) => c.header);
  enc.height = 26;
  enc.eachCell((celda, n) => {
    const derecha = COLUMNAS[n - 1]?.key === 'monto';
    celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TINTA } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    celda.alignment = { vertical: 'middle', horizontal: derecha ? 'right' : 'left', indent: 1 };
    celda.border = { top: BORDE_FINO, left: BORDE_FINO, bottom: BORDE_FINO, right: BORDE_FINO };
  });

  // 4) Filas de datos
  let sumaMonto = 0;
  let conMonto = 0;
  for (const [i, r] of registros.entries()) {
    const n = FILA_ENCABEZADO + 1 + i;
    const fila = hoja.getRow(n);
    const fecha = aFecha(r.fecha_radicacion);
    const monto = r.monto;
    if (monto != null) {
      sumaMonto += monto;
      conMonto += 1;
    }
    fila.values = [
      r.numero_contrato ?? '—',
      formatAseguradoExcel(r.nombre_asegurado) || '—',
      r.aseguradora,
      r.gasera,
      r.clase,
      r.producto,
      r.estado || 'Sin estado',
      fecha,
      monto,
    ];
    fila.height = 18;
    const cebra = i % 2 === 1;

    fila.eachCell((celda, n) => {
      const col = COLUMNAS[n - 1]?.key;
      celda.border = { top: BORDE_FINO, left: BORDE_FINO, bottom: BORDE_FINO, right: BORDE_FINO };
      celda.alignment = { vertical: 'middle' };
      if (cebra && col !== 'estado') {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CEBRA } };
      }
      if (col === 'contrato') {
        celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TINTA } };
      } else if (col === 'monto') {
        celda.numFmt = '"$"#,##0';
        celda.font = { name: 'Calibri', size: 11, bold: true, color: { argb: VERDE_OSCURO } };
        celda.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      } else if (col === 'fecha') {
        celda.numFmt = 'dd/mm/yyyy';
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
        celda.font = { name: 'Calibri', size: 10, color: { argb: 'FF475569' } };
      } else if (col === 'estado') {
        const b = BADGE[estadoColorCat(String(celda.value ?? ''))] ?? BADGE.gris;
        if (!b) return;
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: b.fill } };
        celda.font = { name: 'Calibri', size: 10, bold: true, color: { argb: b.font } };
        celda.border = {
          top: { style: 'thin', color: { argb: b.border } },
          left: { style: 'thin', color: { argb: b.border } },
          bottom: { style: 'thin', color: { argb: b.border } },
          right: { style: 'thin', color: { argb: b.border } },
        };
        celda.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        celda.font = { name: 'Calibri', size: 11, color: { argb: 'FF1E293B' } };
        celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: col === 'producto' };
      }
    });
  }

  const ultimaFila = FILA_ENCABEZADO + registros.length;

  // 5) Totales
  const filaTotales = hoja.getRow(ultimaFila + 1);
  hoja.mergeCells(ultimaFila + 1, 1, ultimaFila + 1, numCols - 1);
  const et = hoja.getCell(ultimaFila + 1, 1);
  et.value = `TOTAL ${registros.length.toLocaleString('es-CO')} registros`;
  et.font = { name: 'Calibri', size: 11, bold: true, color: { argb: TINTA } };
  et.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  const mt = hoja.getCell(ultimaFila + 1, numCols);
  mt.value = conMonto > 0 ? sumaMonto : null;
  mt.numFmt = '"$"#,##0';
  mt.font = { name: 'Calibri', size: 11, bold: true, color: { argb: VERDE_OSCURO } };
  mt.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  for (let c = 1; c <= numCols; c++) {
    const celda = hoja.getCell(ultimaFila + 1, c);
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NUBE } };
    celda.border = {
      top: { style: 'double', color: { argb: VERDE } },
      left: BORDE_FINO,
      bottom: BORDE_FINO,
      right: BORDE_FINO,
    };
  }
  filaTotales.height = 22;

  // 6) Autofiltro sobre el encabezado
  hoja.autoFilter = {
    from: { row: FILA_ENCABEZADO, column: 1 },
    to: { row: ultimaFila, column: numCols },
  };

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
