import type { Filters } from '../lib/types';

// Último día real de un mes según su año (respeta años bisiestos).
function ultimoDiaMes(mes: string): number {
  const [yy, mm] = mes.split('-').map(Number);
  if (!yy || !mm || mm < 1 || mm > 12) return 31;
  return new Date(yy, mm, 0).getDate();
}

// Convierte filtros en query string para los endpoints de la API.
// Las listas (selección múltiple) se repiten: ?gasera=A&gasera=B.
export function queryString(f: Filters): string {
  const p = new URLSearchParams();
  const lista = (clave: string, valores?: string[]) => {
    for (const v of valores ?? []) {
      if (v.trim() !== '') p.append(clave, v);
    }
  };
  if (f.contrato) p.set('contrato', f.contrato);
  if (f.mes) {
    p.set('mes', f.mes);
    p.set('desde', `${f.mes}-01`);
    p.set('hasta', `${f.mes}-${String(ultimoDiaMes(f.mes)).padStart(2, '0')}`);
  } else {
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
  }
  lista('gasera', f.gasera);
  lista('producto', f.producto);
  lista('estado', f.estado);
  lista('aseguradora', f.aseguradora);
  lista('tipo_siniestro', f.tipo_siniestro);
  lista('clase', f.clase);
  if (f.anio) p.set('anio', f.anio);
  return p.toString();
}

// Query para refrescar las OPCIONES de los selects (cascada Clase → Gasera/Producto):
// trae clase + fechas + estado + aseguradora, pero SIN gasera ni producto para no
// colapsar las listas sobre la selección actual. La data manda: las opciones salen
// de la DB en tiempo real.
export function queryStringOpciones(f: Filters): string {
  const p = new URLSearchParams();
  const lista = (clave: string, valores?: string[]) => {
    for (const v of valores ?? []) {
      if (v.trim() !== '') p.append(clave, v);
    }
  };
  if (f.mes) {
    p.set('mes', f.mes);
    p.set('desde', `${f.mes}-01`);
    p.set('hasta', `${f.mes}-${String(ultimoDiaMes(f.mes)).padStart(2, '0')}`);
  } else {
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
  }
  lista('estado', f.estado);
  lista('aseguradora', f.aseguradora);
  lista('tipo_siniestro', f.tipo_siniestro);
  lista('clase', f.clase);
  if (f.anio) p.set('anio', f.anio);
  return p.toString();
}