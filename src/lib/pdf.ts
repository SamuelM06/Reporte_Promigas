// ============================================================================
// GENERACIÓN DEL PDF DEL DETALLE (SOLO SERVIDOR)
// ----------------------------------------------------------------------------
// Replica la tabla web en papel: banda de título con los colores de marca,
// encabezado verde repetido en cada página, badges de Estado por categoría,
// cebra de filas, bordes, montos alineados y pie con "Página X de Y".
//
// Se usa `pdfkit` (import por defecto: el paquete es CJS y Node no expone sus
// exports nombrados de forma fiable en ESM). Corre en el servidor, así que no
// pesa nada en el bundle del navegador.
//
// OJO: en PDFKit 0.20 `lineBreak: false` ya NO desactiva el ajuste de línea
// (sólo afecta al ancho por defecto), así que pasar `width` siempre envuelve.
// Por eso cada celda se recorta a su propio ancho con `widthOfString` y se
// dibuja SIN `width`, alineando x a mano. Así ninguna celda invade la vecina.
// ============================================================================
import PDFDocument from 'pdfkit';
import { estadoColorCat } from './normalizacion';
import { formatAseguradoExcel, formatCOP } from '../utils/formatters';
import type { RegistroTabla } from './types';

// Paleta de marca (mismos valores que src/styles/global.css)
const TINTA = '#0C102A';
const VERDE = '#00CD93';
const VERDE_OSCURO = '#00875F';
const NUBE = '#F4F6FB';
const CEBRA = '#F8FAFD';
const BORDE = '#E2E8F0';
const GRIS = '#64748B';

// Badge de Estado: mismo color por categoría que `estadoBadge` en la web.
const BADGE: Record<string, { fill: string; font: string; borde: string }> = {
  verde: { fill: '#D1FAE5', font: '#065F46', borde: '#6EE7B7' },
  rojo: { fill: '#FEE2E2', font: '#991B1B', borde: '#FCA5A5' },
  ambar: { fill: '#FEF3C7', font: '#92400E', borde: '#FCD34D' },
  azul: { fill: '#E0F2FE', font: '#075985', borde: '#7DD3FC' },
  cyan: { fill: '#CFFAFE', font: '#155E75', borde: '#67E8F9' },
  morado: { fill: '#EDE9FE', font: '#5B21B6', borde: '#C4B5FD' },
  gris: { fill: '#EEF1FB', font: '#334155', borde: '#CBD5E1' },
};

// Carta horizontal: 792 x 612 pt
const PAG_ANCHO = 792;
const PAG_ALTO = 612;
const MARGEN = 28;
const USABLE = PAG_ANCHO - MARGEN * 2; // 736
const Y_PIE = PAG_ALTO - 22;            // línea base del pie
const Y_LIMITE = PAG_ALTO - 44;         // por debajo de esto, página nueva

const COLUMNAS = [
  { titulo: 'CONTRATO', ancho: 56, al: 'left' as const },
  { titulo: 'ASEGURADO', ancho: 120, al: 'left' as const },
  { titulo: 'ASEGURADORA', ancho: 74, al: 'left' as const },
  { titulo: 'GASERA', ancho: 72, al: 'left' as const },
  { titulo: 'CLASE', ancho: 60, al: 'left' as const },
  { titulo: 'PRODUCTO', ancho: 104, al: 'left' as const },
  { titulo: 'ESTADO', ancho: 106, al: 'center' as const },
  { titulo: 'RADICACIÓN', ancho: 56, al: 'center' as const },
  { titulo: 'MONTO', ancho: 88, al: 'right' as const },
];
const X_INI: number[] = (() => {
  const xs: number[] = [];
  let x = MARGEN;
  for (const c of COLUMNAS) {
    xs.push(x);
    x += c.ancho;
  }
  return xs;
})();

const ALTO_ENCABEZADO = 19;
const ALTO_FILA = 16;
const FS_DATO = 8;
const FS_ENCABEZADO = 7.5;
const FS_BADGE = 6.5;
const FS_PIE = 7;

type Doc = PDFKit.PDFDocument;
type Alineo = 'left' | 'center' | 'right';

export interface MetaPdf {
  titulo: string;
  subtitulo: string;
  generado: Date;
}

// Centra verticalmente una línea dentro de una celda.
function yCelda(y: number, alto: number, fs: number): number {
  return y + (alto - fs * 1.15) / 2;
}

// Recorta el texto con puntos suspensivos hasta que quepa en `max`.
// Depende de la fuente/tamaño activos en el documento.
function recortar(doc: Doc, texto: string, max: number): string {
  if (max <= 0) return '';
  if (doc.widthOfString(texto) <= max) return texto;
  let s = texto;
  while (s.length > 1 && doc.widthOfString(`${s}…`) > max) s = s.slice(0, -1);
  return `${s}…`;
}

// Escribe una celda de una sola línea, alineada y recortada a la columna.
function celda(
  doc: Doc,
  texto: string,
  x: number,
  w: number,
  y: number,
  alto: number,
  o: { negrita?: boolean; fs?: number; color?: string; al?: Alineo; sangria?: number } = {},
): void {
  const fs = o.fs ?? FS_DATO;
  const sangria = o.sangria ?? 4;
  doc.font(o.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs).fillColor(o.color ?? TINTA);
  const t = recortar(doc, texto, w - sangria * 2);
  const tw = doc.widthOfString(t);
  const px = o.al === 'right' ? x + w - sangria - tw : o.al === 'center' ? x + (w - tw) / 2 : x + sangria;
  doc.text(t, px, yCelda(y, alto, fs));
}

function pintarEncabezado(doc: Doc, y: number): void {
  doc.rect(MARGEN, y, USABLE, ALTO_ENCABEZADO).fill(VERDE);
  COLUMNAS.forEach((c, i) => {
    celda(doc, c.titulo, X_INI[i] ?? MARGEN, c.ancho, y, ALTO_ENCABEZADO, {
      negrita: true,
      fs: FS_ENCABEZADO,
      color: TINTA,
      al: c.al,
      sangria: 2,
    });
  });
  doc.moveTo(MARGEN, y + ALTO_ENCABEZADO).lineTo(MARGEN + USABLE, y + ALTO_ENCABEZADO).lineWidth(0.8).stroke(TINTA);
}

function pintarBadge(doc: Doc, estado: string, x: number, w: number, y: number, alto: number): void {
  const b = BADGE[estadoColorCat(estado)] ?? BADGE.gris;
  if (!b) return;
  doc.font('Helvetica-Bold').fontSize(FS_BADGE);
  const t = recortar(doc, estado, w - 14);
  const ancho = doc.widthOfString(t) + 10;
  const bx = x + (w - ancho) / 2;
  const bh = 10.5;
  const by = y + (alto - bh) / 2;
  doc.roundedRect(bx, by, ancho, bh, 5).fillAndStroke(b.fill, b.borde);
  doc
    .font('Helvetica-Bold')
    .fontSize(FS_BADGE)
    .fillColor(b.font)
    .text(t, bx + (ancho - doc.widthOfString(t)) / 2, by + (bh - FS_BADGE * 1.15) / 2);
}

// dd/mm/yyyy: cabe en la columna y evita el corte de "24 de sept 2026".
// pg entrega las columnas DATE como objetos Date, aunque el tipo compartido las
// declare como string: se aceptan las dos formas.
function fechaCorta(iso?: string | Date | null): string {
  if (!iso) return '—';
  if (iso instanceof Date && !Number.isNaN(iso.getTime())) {
    const d = iso;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  const s = String(iso).slice(0, 10);
  const [a, m, d] = s.split('-');
  return a && m && d ? `${d}/${m}/${a}` : '—';
}

// Construye el PDF y lo devuelve como Buffer.
export function construirPdfDetalle(registros: RegistroTabla[], meta: MetaPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    // OJO: `layout: 'landscape'` ya invierte el tamaño, así que `size` se
    // declara en vertical (LETTER) y PDFKit entrega 792 x 612.
    size: 'LETTER',
    layout: 'landscape',
    margin: MARGEN,
    bufferPages: true,
    info: {
      Title: meta.titulo,
      Author: 'Portal Siniestros Xuma',
      Subject: meta.subtitulo,
      Creator: 'Portal Siniestros Xuma',
    },
  });

  const trozos: Buffer[] = [];
  const listo = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
  });

  const generado = `Generado el ${meta.generado.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}`;

  // ---- Banda de la portada (solo página 1) -----------------------------------
  doc.rect(0, 0, PAG_ANCHO, 44).fill(TINTA);
  celda(doc, meta.titulo, MARGEN, USABLE - 170, 0, 44, { negrita: true, fs: 15, color: '#FFFFFF', sangria: 0 });
  celda(doc, generado, MARGEN + USABLE - 170, 170, 0, 44, { fs: 7.5, color: '#A7F3D0', al: 'right', sangria: 0 });
  doc.rect(MARGEN, 44, USABLE, 2).fill(VERDE);
  celda(doc, meta.subtitulo, MARGEN, USABLE, 50, 12, { fs: 7.5, color: GRIS, al: 'left', sangria: 0 });

  let y = 64;
  pintarEncabezado(doc, y);
  y += ALTO_ENCABEZADO;

  // ---- Páginas 2..n: banda compacta + encabezado repetido --------------------
  doc.on('pageAdded', () => {
    doc.rect(0, 0, PAG_ANCHO, 24).fill(TINTA);
    celda(doc, `${meta.titulo} · continúa`, MARGEN, USABLE - 130, 0, 24, {
      negrita: true,
      fs: 9,
      color: '#FFFFFF',
      sangria: 0,
    });
    celda(doc, `${registros.length.toLocaleString('es-CO')} registros`, MARGEN + USABLE - 130, 130, 0, 24, {
      fs: 7,
      color: '#A7F3D0',
      al: 'right',
      sangria: 0,
    });
    y = 30;
    pintarEncabezado(doc, y);
    y += ALTO_ENCABEZADO;
  });

  // ---- Filas -----------------------------------------------------------------
  let sumaMonto = 0;
  let conMonto = 0;
  const filas = registros.map((r) => {
    if (r.monto != null) {
      sumaMonto += r.monto;
      conMonto += 1;
    }
    return [
      r.numero_contrato ?? '—',
      formatAseguradoExcel(r.nombre_asegurado) || '—',
      r.aseguradora,
      r.gasera,
      r.clase,
      r.producto,
      r.estado || 'Sin estado',
      fechaCorta(r.fecha_radicacion),
      r.monto == null ? '—' : formatCOP(r.monto),
    ];
  });

  filas.forEach((fila, i) => {
    if (y + ALTO_FILA > Y_LIMITE) doc.addPage();
    if (i % 2 === 1) doc.rect(MARGEN, y, USABLE, ALTO_FILA).fill(CEBRA);
    doc.moveTo(MARGEN, y).lineTo(MARGEN + USABLE, y).lineWidth(0.4).stroke(BORDE);

    COLUMNAS.forEach((c, j) => {
      const x = X_INI[j] ?? MARGEN;
      const valor = fila[j] ?? '';
      if (j === 6) {
        pintarBadge(doc, valor, x, c.ancho, y, ALTO_FILA);
        return;
      }
      celda(doc, valor, x, c.ancho, y, ALTO_FILA, {
        negrita: j === 0 || j === 8,
        color: j === 8 ? VERDE_OSCURO : TINTA,
        al: c.al,
      });
    });
    y += ALTO_FILA;
  });

  // ---- Totales ---------------------------------------------------------------
  if (y + 21 > Y_LIMITE) doc.addPage();
  doc.moveTo(MARGEN, y).lineTo(MARGEN + USABLE, y).lineWidth(1.2).stroke(VERDE);
  doc.rect(MARGEN, y + 1, USABLE, 19).fill(NUBE);
  celda(doc, `TOTAL ${registros.length.toLocaleString('es-CO')} registros`, MARGEN, USABLE - 88, y + 1, 19, {
    negrita: true,
    fs: 8.5,
    al: 'right',
  });
  celda(doc, conMonto > 0 ? formatCOP(sumaMonto) : '—', X_INI[8] ?? MARGEN, 88, y + 1, 19, {
    negrita: true,
    fs: 8.5,
    color: VERDE_OSCURO,
    al: 'right',
  });
  doc.moveTo(MARGEN, y + 20).lineTo(MARGEN + USABLE, y + 20).lineWidth(0.4).stroke(BORDE);

  // ---- Pie con "Página X de Y" (segunda pasada sobre las páginas en buffer) ----
  // El pie se escribe por debajo del margen inferior: sin neutralizar el margen,
  // `doc.text()` auto-agrega una página nueva por cada escritura y el PDF se infla.
  const rango = doc.bufferedPageRange();
  for (let p = rango.start; p < rango.start + rango.count; p++) {
    doc.switchToPage(p);
    const margenPrevio = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.moveTo(MARGEN, Y_PIE - 7).lineTo(MARGEN + USABLE, Y_PIE - 7).lineWidth(0.4).stroke(BORDE);
    celda(doc, meta.subtitulo, MARGEN, USABLE - 120, Y_PIE - 5, 12, { fs: FS_PIE, color: GRIS });
    celda(doc, `Página ${p - rango.start + 1} de ${rango.count}`, MARGEN + USABLE - 120, 120, Y_PIE - 5, 12, {
      fs: FS_PIE,
      color: GRIS,
      al: 'right',
    });
    doc.page.margins.bottom = margenPrevio;
  }
  doc.flushPages();
  doc.end();
  return listo;
}
