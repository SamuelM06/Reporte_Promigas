import type { Filters } from '../lib/types';
import { queryString } from './fetcher';

// ---- Exportación de la matriz de estatus (gasera × estado × mes) ---------------
export interface FilaEstatusExcel {
  gasera: string;
  estado: string; // 'TOTAL' en la fila agregada de cada gasera
  meses: number[];
  total: number;
}

// Genera y descarga el .xlsx de la matriz de estatus con sus estados.
// xlsx se carga bajo demanda para no inflar el bundle inicial.
export async function descargarExcelEstatus(args: {
  anio: number;
  meses: string[];
  filas: FilaEstatusExcel[];
}): Promise<void> {
  const XLSX = await import('xlsx');
  const encabezado = ['Gasera', 'Estado', ...args.meses, 'Total'];
  const cuerpo: (string | number)[][] = args.filas.map((f) => [f.gasera, f.estado, ...f.meses, f.total]);
  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...cuerpo]);
  hoja['!cols'] = [{ wch: 26 }, { wch: 24 }, ...args.meses.map(() => ({ wch: 12 })), { wch: 14 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, `Estatus ${args.anio}`);
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `estatus_siniestros_${args.anio}_${fecha}.xlsx`;
  const datos = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Genera y descarga el detalle en Excel o PDF.
// El archivo lo arma el SERVIDOR (/api/exportar) para mantener el diseño de la
// tabla web y evitar cientos de peticiones desde el navegador (rate limit/DB).
export async function descargarDetalle(args: {
  filtros: Filters;
  formato: 'excel' | 'pdf';
  modo: 'todo' | 'pagina' | 'rango';
  pagina: number;
  desde: number;
  hasta: number;
  tamano: number;
}): Promise<void> {
  const ext = args.formato === 'pdf' ? 'pdf' : 'xlsx';
  const p = new URLSearchParams({ formato: args.formato, modo: args.modo, size: String(args.tamano) });
  if (args.modo === 'pagina') p.set('pagina', String(args.pagina));
  if (args.modo === 'rango') {
    p.set('paginaDesde', String(args.desde));
    p.set('paginaHasta', String(args.hasta));
  }
  const q = queryString(args.filtros);
  const res = await fetch(`/api/exportar?${q}${q ? '&' : ''}${p.toString()}`);
  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(cuerpo?.error ?? `Error ${res.status} al generar el archivo.`);
  }
  const nombre =
    /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
    `siniestros_xuma_${new Date().toISOString().slice(0, 10)}.${ext}`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}