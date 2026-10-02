// Definición central de filtros del portal (como en Siniestros: src/components/filtros).
// Cada filtro declara: clave, etiqueta, parámetro URL, icono moderno (estilo Lucide)
// y de qué columna de `reportes.reporte_promi` trae sus ítems (vía metadatos).
// Todas las páginas usan este catálogo para que los desplegables siempre
// muestren los ítems de la base de datos.

export interface FiltroDef {
  key: 'mes' | 'gasera' | 'aseguradora' | 'canal' | 'cabina' | 'estado';
  label: string;
  param: string;
  columnaDb: string;
  placeholder: string;
  icon: string;
}

const svg = (inner: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const ICONOS = {
  calendario: svg('<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>'),
  edificio: svg('<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/><path d="M12 14h.01"/>'),
  sombrilla: svg('<path d="M22 12a10.06 10.06 0 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>'),
  megafono: svg('<path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>'),
  idaVuelta: svg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
  etiqueta: svg('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  embudo: svg('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>'),
};

export const FILTROS: FiltroDef[] = [
  { key: 'mes', label: 'Mes', param: 'mes', columnaDb: 'mes_norm', placeholder: 'Todos', icon: ICONOS.calendario },
  { key: 'gasera', label: 'Gasera', param: 'gasera', columnaDb: 'gasera_norm', placeholder: 'Todas', icon: ICONOS.edificio },
  { key: 'aseguradora', label: 'Aseguradora', param: 'aseguradora', columnaDb: 'aseguradora_norm', placeholder: 'Todas', icon: ICONOS.sombrilla },
  { key: 'canal', label: 'Canal', param: 'canal', columnaDb: 'canal_norm', placeholder: 'Todos', icon: ICONOS.megafono },
  { key: 'cabina', label: 'Cabina', param: 'cabina', columnaDb: 'cabina_norm', placeholder: 'Todas', icon: ICONOS.idaVuelta },
  { key: 'estado', label: 'Estado', param: 'estado', columnaDb: 'estado_norm', placeholder: 'Todos', icon: ICONOS.etiqueta },
];
