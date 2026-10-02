// Carga diferida de Leaflet (vendored en /vendor/leaflet). Evita que el
// <script> bloqueante retrase el primer pintado de la vista de mapa.
let promesa: Promise<any> | null = null;

export function leafletEnPromesa(): Promise<any> {
  const yaGlobal = (window as any).L;
  if (yaGlobal) return Promise.resolve(yaGlobal);
  if (!promesa) {
    promesa = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/vendor/leaflet/leaflet.css';
      document.head.appendChild(link);

      const s = document.createElement('script');
      s.src = '/vendor/leaflet/leaflet.js';
      s.async = true;
      s.onload = () => resolve((window as any).L);
      s.onerror = () => {
        promesa = null;
        reject(new Error('No se pudo cargar Leaflet'));
      };
      document.head.appendChild(s);
    });
  }
  return promesa;
}