import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, CheckCircle2, ChevronRight, Coins,
  Eye, HelpCircle, Layers, MapPin, RefreshCw, X, OctagonX, Maximize2, Search,
} from 'lucide-react';
import type { ItemMunicipio, MapaData } from '../../lib/types';
import { leafletEnPromesa } from '../../lib/leaflet';
import { formatCOP, formatNum } from '../../utils/formatters';

interface Props {
  data: MapaData;
  deptoSeleccionado: string | null;
  onSelectDepto: (depto: string | null) => void;
}

function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchDeptoName(geoName: string, deptoTarget: string): boolean {
  const g = norm(geoName);
  const t = norm(deptoTarget);
  if (g === t) return true;
  if (g.includes('SANTAFE DE BOGOTA') && t.includes('BOGOTA')) return true;
  if (g.includes('ARCHIPIELAGO') && t.includes('ANDRES')) return true;
  if (g.includes('VALLE') && t.includes('VALLE')) return true;
  if (g.includes('GUAJIRA') && t.includes('GUAJIRA')) return true;
  return g.includes(t) || t.includes(g);
}

function matchMunicipio(geoMpio: string, listaMpios: ItemMunicipio[]): ItemMunicipio | undefined {
  const gm = norm(geoMpio);
  return listaMpios.find((m) => {
    const lm = norm(m.municipio);
    if (gm === lm) return true;
    if (gm.includes('CARTAGENA') && lm.includes('CARTAGENA')) return true;
    if (gm.includes('BARRANQUILLA') && lm.includes('BARRANQUILLA')) return true;
    if (gm.includes('CALI') && lm.includes('CALI')) return true;
    if (gm.includes('BOGOTA') && lm.includes('BOGOTA')) return true;
    if (gm.includes('POPAYAN') && lm.includes('POPAYAN')) return true;
    if (gm.includes('MANIZALES') && lm.includes('MANIZALES')) return true;
    return gm.includes(lm) || lm.includes(gm);
  });
}

function getColorMpio(total: number, isSelected: boolean): string {
  if (isSelected) return '#f59e0b'; // Ámbar dorado brillante
  if (total >= 500) return '#047857'; // Verde esmeralda intenso
  if (total >= 100) return '#059669'; // Verde esmeralda medio
  if (total >= 20) return '#0d9488'; // Teal
  if (total >= 5) return '#0284c7'; // Azul cielo
  if (total > 0) return '#38bdf8'; // Celeste
  return '#94a3b8'; // Gris sin casos
}

function getColorDepto(total: number, isSelected: boolean): string {
  if (isSelected) return '#f59e0b';
  if (total >= 1500) return '#047857';
  if (total >= 500) return '#059669';
  if (total >= 50) return '#0d9488';
  if (total >= 10) return '#0284c7';
  if (total > 0) return '#38bdf8';
  return '#94a3b8';
}

// Caché en memoria viva del cliente para evitar re-descargas y re-parseos de GeoJSON
let memoriaGeoDeptos: any = null;
let memoriaGeoMpios: any = null;

export default function MapaColombia({ data, deptoSeleccionado, onSelectDepto }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const geojsonLayerRef = useRef<any>(null);

  const [geoDeptos, setGeoDeptos] = useState<any>(memoriaGeoDeptos);
  const [geoMpios, setGeoMpios] = useState<any>(memoriaGeoMpios);
  const [cargandoGeo, setCargandoGeo] = useState(!memoriaGeoDeptos);
  const [cargandoMpios, setCargandoMpios] = useState(false);
  const [mapaListo, setMapaListo] = useState(false);

  // Tipo de mapa base: 'google' (predeterminado), 'google-sat', 'osm', 'carto'
  const [tipoMapa, setTipoMapa] = useState<'google' | 'google-sat' | 'osm' | 'carto'>('google');

  // Modo de visualización: 'departamentos' o 'municipios'
  const [modoVista, setModoVista] = useState<'departamentos' | 'municipios'>('departamentos');
  const [mpioSeleccionado, setMpioSeleccionado] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState('');

  // Cargar geometría departamental (necesaria desde el inicio, ~1.3 MB)
  useEffect(() => {
    if (memoriaGeoDeptos) {
      setGeoDeptos(memoriaGeoDeptos);
      setCargandoGeo(false);
      return;
    }
    try {
      const enSesion = sessionStorage.getItem('xuma_geo_deptos');
      if (enSesion) {
        const d = JSON.parse(enSesion);
        memoriaGeoDeptos = d;
        setGeoDeptos(d);
        setCargandoGeo(false);
        return;
      }
    } catch {}

    let vivo = true;
    fetch('/data/colombia.geo.json')
      .then((r) => r.json())
      .catch(() => null)
      .then((d) => {
        if (!vivo || !d) return;
        memoriaGeoDeptos = d;
        setGeoDeptos(d);
        setCargandoGeo(false);
        try {
          sessionStorage.setItem('xuma_geo_deptos', JSON.stringify(d));
        } catch {}
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Cargar municipios SOLO bajo demanda (vista de municipios). Evita
  // descargar ~2.8 MB al abrir la página cuando solo se ven departamentos.
  useEffect(() => {
    if (modoVista !== 'municipios' || geoMpios != null) return;
    if (memoriaGeoMpios) {
      setGeoMpios(memoriaGeoMpios);
      setCargandoMpios(false);
      return;
    }
    try {
      const enSesion = sessionStorage.getItem('xuma_geo_mpios');
      if (enSesion) {
        const d = JSON.parse(enSesion);
        memoriaGeoMpios = d;
        setGeoMpios(d);
        setCargandoMpios(false);
        return;
      }
    } catch {}

    let vivo = true;
    setCargandoMpios(true);
    fetch('/data/colombia_municipios.geojson')
      .then((r) => r.json())
      .catch(() => null)
      .then((d) => {
        if (!vivo || !d) return;
        memoriaGeoMpios = d;
        setGeoMpios(d);
        setCargandoMpios(false);
        try {
          sessionStorage.setItem('xuma_geo_mpios', JSON.stringify(d));
        } catch {}
      });
    return () => {
      vivo = false;
    };
  }, [modoVista, geoMpios]);

  // Inicializar Leaflet de forma diferida (no bloquea el primer pintado)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let vivo = true;
    leafletEnPromesa()
      .then((L: any) => {
        if (!vivo || !mapContainerRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [4.5709, -74.2973],
          zoom: 5,
          zoomControl: true,
          attributionControl: false,
        });

        L.control.attribution({ position: 'bottomright', prefix: false })
          .addTo(map);

        mapInstanceRef.current = map;
        setMapaListo(true);
      })
      .catch(() => {
        setCargandoGeo(false);
      });

    return () => {
      vivo = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Actualizar capa base de azulejos (Google Maps / OpenStreetMap / Satelital / Carto)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !mapaListo) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let layer: any;
    if (tipoMapa === 'google') {
      layer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps',
      });
    } else if (tipoMapa === 'google-sat') {
      layer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        attribution: '&copy; Google Maps Satelital',
      });
    } else if (tipoMapa === 'osm') {
      layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      });
    } else {
      layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
        attribution: '&copy; CARTO &copy; OpenStreetMap',
      });
    }

    layer.addTo(map);
    tileLayerRef.current = layer;
  }, [tipoMapa, mapaListo]);

  // Cambiar a modo municipios automáticamente cuando se selecciona un departamento
  useEffect(() => {
    if (deptoSeleccionado) {
      setModoVista('municipios');
      setMpioSeleccionado(null);
    }
  }, [deptoSeleccionado]);

  // Al cambiar los datos (filtros aplicados):
  // - Limpiar la selección de municipio si éste ya no aparece bajo los nuevos filtros
  // - Limpiar el texto de búsqueda (evita mostrar listas vacías por texto viejo)
  useEffect(() => {
    if (mpioSeleccionado && deptoSeleccionado) {
      const deptoItem = data.departamentos.find((d) => norm(d.departamento) === norm(deptoSeleccionado));
      const sigue = deptoItem?.municipios.some((m) => norm(m.municipio) === norm(mpioSeleccionado));
      if (!sigue) setMpioSeleccionado(null);
    }
  }, [data, deptoSeleccionado, mpioSeleccionado]);

  // Renderizar o actualizar la capa geográfica
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = (window as any).L;
    if (!map || !L || !mapaListo) return;

    if (geojsonLayerRef.current) {
      map.removeLayer(geojsonLayerRef.current);
      geojsonLayerRef.current = null;
    }

    // Decidir qué GeoJSON renderizar
    const esModoMpio = modoVista === 'municipios' && geoMpios != null;

    if (esModoMpio && geoMpios) {
      // Filtrar municipios si hay un departamento seleccionado, o mostrar todos
      const features = deptoSeleccionado
        ? geoMpios.features.filter((f: any) => matchDeptoName(f.properties.DPTO_CNMBR, deptoSeleccionado))
        : geoMpios.features;

      const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
        style: (feature: any) => {
          const dptoName = feature.properties.DPTO_CNMBR ?? '';
          const mpioName = feature.properties.MPIO_CNMBR ?? '';
          const deptoItem = data.departamentos.find((d) => matchDeptoName(dptoName, d.departamento));
          const mpioItem = deptoItem ? matchMunicipio(mpioName, deptoItem.municipios) : undefined;
          const total = mpioItem?.total ?? 0;
          const isSelected = mpioSeleccionado != null && norm(mpioName) === norm(mpioSeleccionado);

          return {
            fillColor: getColorMpio(total, isSelected),
            fillOpacity: isSelected ? 0.9 : total > 0 ? 0.72 : 0.1,
            color: isSelected ? '#f59e0b' : total > 0 ? '#047857' : '#94a3b8',
            weight: isSelected ? 3 : total > 0 ? 1.5 : 0.6,
            dashArray: total === 0 ? '2, 2' : undefined,
          };
        },
        onEachFeature: (feature: any, featLayer: any) => {
          const dptoName = feature.properties.DPTO_CNMBR ?? '';
          const mpioName = feature.properties.MPIO_CNMBR ?? '';
          const deptoItem = data.departamentos.find((d) => matchDeptoName(dptoName, d.departamento));
          const mpioItem = deptoItem ? matchMunicipio(mpioName, deptoItem.municipios) : undefined;
          const total = mpioItem?.total ?? 0;
          const pagado = mpioItem?.pagado ?? 0;

          const tooltipHtml = `
            <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 130px; padding: 2px;">
              <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${mpioName}</div>
              <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">${dptoName}</div>
              <div style="margin-bottom: 2px;">Siniestros: <b style="color: #047857;">${formatNum(total)}</b></div>
              ${total > 0 ? `<div style="font-size: 11px; font-weight: 600; color: #0284c7;">Pagado: ${formatCOP(pagado)}</div>` : '<div style="font-size: 10px; color: #64748b;">Sin siniestros registrados</div>'}
            </div>
          `;

          featLayer.bindTooltip(tooltipHtml, { sticky: true, opacity: 0.95 });

          featLayer.on({
            mouseover: (e: any) => {
              e.target.setStyle({ weight: 2.5, color: '#38bdf8', fillOpacity: 0.9 });
              e.target.bringToFront();
            },
            mouseout: (e: any) => {
              if (geojsonLayerRef.current) geojsonLayerRef.current.resetStyle(e.target);
            },
            click: (e: any) => {
              setMpioSeleccionado(mpioName);
              if (deptoItem && !deptoSeleccionado) {
                onSelectDepto(deptoItem.departamento);
              }
              try {
                map.fitBounds(e.target.getBounds(), { maxZoom: 11, padding: [30, 30] });
              } catch {}
            },
          });
        },
      }).addTo(map);

      geojsonLayerRef.current = layer;

      try {
        if (features.length > 0) {
          map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        }
      } catch {}

    } else if (geoDeptos) {
      // Modo Departamentos (Macro)
      const layer = L.geoJSON(geoDeptos, {
        style: (feature: any) => {
          const dptoName = feature.properties.NOMBRE_DPT ?? '';
          const match = data.departamentos.find((d) => matchDeptoName(dptoName, d.departamento));
          const total = match?.total ?? 0;
          const isSelected = deptoSeleccionado != null && match != null &&
            norm(match.departamento) === norm(deptoSeleccionado);

          return {
            fillColor: getColorDepto(total, isSelected),
            fillOpacity: isSelected ? 0.85 : total > 0 ? 0.70 : 0.12,
            color: isSelected ? '#f59e0b' : total > 0 ? '#047857' : '#94a3b8',
            weight: isSelected ? 3.5 : total > 0 ? 1.8 : 1,
            dashArray: total === 0 ? '3, 3' : undefined,
          };
        },
        onEachFeature: (feature: any, featLayer: any) => {
          const dptoName = feature.properties.NOMBRE_DPT ?? '';
          const match = data.departamentos.find((d) => matchDeptoName(dptoName, d.departamento));
          const nombreDisplay = match ? match.departamento : dptoName;
          const total = match?.total ?? 0;

          const tooltipHtml = `
            <div style="font-family: inherit; font-size: 12px; color: #0f172a; min-width: 140px; padding: 2px;">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 3px; color: #0f172a;">${nombreDisplay}</div>
              <div style="margin-bottom: 2px;">Siniestros: <b style="color: #047857;">${formatNum(total)}</b></div>
              ${match ? `<div style="font-size: 11px; font-weight: 600; color: #0284c7;">Pagado: ${formatCOP(match.totalPagado)}</div>` : '<div style="font-size: 11px; color: #64748b;">Sin siniestros registrados</div>'}
              ${match ? `<div style="font-size: 10px; color: #475569; margin-top: 3px;">Municipios con siniestros: ${match.municipios.length}</div>` : ''}
            </div>
          `;

          featLayer.bindTooltip(tooltipHtml, { sticky: true, opacity: 0.95 });

          featLayer.on({
            mouseover: (e: any) => {
              e.target.setStyle({ weight: 3, color: '#38bdf8', fillOpacity: 0.88 });
              e.target.bringToFront();
            },
            mouseout: (e: any) => {
              if (geojsonLayerRef.current) geojsonLayerRef.current.resetStyle(e.target);
            },
            click: (e: any) => {
              if (match) {
                onSelectDepto(match.departamento);
                setModoVista('municipios');
                try {
                  map.fitBounds(e.target.getBounds(), { maxZoom: 8, padding: [25, 25] });
                } catch {}
              } else {
                onSelectDepto(null);
              }
            },
          });
        },
      }).addTo(map);

      geojsonLayerRef.current = layer;

      if (!deptoSeleccionado) {
        try {
          map.fitBounds(layer.getBounds(), { padding: [10, 10] });
        } catch {}
      }
    }
  }, [geoDeptos, geoMpios, modoVista, deptoSeleccionado, mpioSeleccionado, data, onSelectDepto, mapaListo]);

  // Resetear a vista nacional
  const resetVista = () => {
    onSelectDepto(null);
    setMpioSeleccionado(null);
    setModoVista('departamentos');
    setFiltroTexto('');
    const map = mapInstanceRef.current;
    if (map && geojsonLayerRef.current) {
      try {
        map.fitBounds(geojsonLayerRef.current.getBounds(), { padding: [10, 10] });
      } catch {
        map.setView([4.5709, -74.2973], 5);
      }
    }
  };

  const itemSeleccionado = useMemo(() => {
    if (!deptoSeleccionado) return null;
    return data.departamentos.find((d) => norm(d.departamento) === norm(deptoSeleccionado)) ?? null;
  }, [data, deptoSeleccionado]);

  // Municipios filtrados en la lista lateral
  const municipiosFiltrados = useMemo(() => {
    if (!itemSeleccionado) return [];
    if (!filtroTexto.trim()) return itemSeleccionado.municipios;
    const q = norm(filtroTexto);
    return itemSeleccionado.municipios.filter((m) => norm(m.municipio).includes(q));
  }, [itemSeleccionado, filtroTexto]);

  // Departamentos filtrados en la lista lateral
  const departamentosFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return data.departamentos;
    const q = norm(filtroTexto);
    return data.departamentos.filter((d) => norm(d.departamento).includes(q));
  }, [data.departamentos, filtroTexto]);

  return (
    <div className="grid h-full w-full gap-2.5 overflow-hidden lg:grid-cols-12">
      {/* Columna Izquierda: Mapa Interactivo DANE de Colombia */}
      <div className="relative flex flex-col rounded-2xl glass p-2 lg:col-span-8 overflow-hidden">
        {/* Barra superior de controles del mapa */}
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 px-1">
          {/* Breadcrumb de navegación territorial */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={resetVista}
              className="flex items-center gap-1 font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro hover:underline cursor-pointer"
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Colombia</span>
            </button>

            {deptoSeleccionado && (
              <>
                <ChevronRight className="h-3 w-3 text-tinta/40" />
                <button
                  type="button"
                  onClick={() => setMpioSeleccionado(null)}
                  className="font-bold text-tinta hover:underline cursor-pointer"
                >
                  {deptoSeleccionado}
                </button>
              </>
            )}

            {mpioSeleccionado && (
              <>
                <ChevronRight className="h-3 w-3 text-tinta/40" />
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {mpioSeleccionado}
                </span>
              </>
            )}
          </div>

          {/* Selector de capa de mapa (Google / Satélite), nivel y Botón Reset */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Switcher de Mapa Base (sólo Google Maps y Satélite; OSM y Carto se desactivaron porque no cargan) */}
            <div className="flex items-center rounded-lg border border-tinta/15 bg-tinta/5 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setTipoMapa('google')}
                className={`px-1.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  tipoMapa === 'google'
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-tinta/70 hover:text-tinta'
                }`}
                title="Mapa de calles de Google Maps"
              >
                Google Maps
              </button>
              <button
                type="button"
                onClick={() => setTipoMapa('google-sat')}
                className={`px-1.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  tipoMapa === 'google-sat'
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-tinta/70 hover:text-tinta'
                }`}
                title="Google Maps con vista satelital híbrida"
              >
                Satélite
              </button>
            </div>

            {/* Selector de nivel (Departamentos / Municipios) */}
            <div className="flex items-center rounded-lg border border-tinta/15 bg-tinta/5 p-0.5 text-[10px]">
              <button
                type="button"
                onClick={() => setModoVista('departamentos')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  modoVista === 'departamentos'
                    ? 'bg-xuma-verde-claro text-[#0a1030] font-bold shadow-sm'
                    : 'text-tinta/70 hover:text-tinta'
                }`}
              >
                Departamentos
              </button>
              <button
                type="button"
                onClick={() => setModoVista('municipios')}
                className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                  modoVista === 'municipios'
                    ? 'bg-xuma-verde-claro text-[#0a1030] font-bold shadow-sm'
                    : 'text-tinta/70 hover:text-tinta'
                }`}
              >
                Municipios
              </button>
            </div>

            <button
              type="button"
              onClick={resetVista}
              title="Restablecer encuadre nacional"
              className="flex items-center gap-1 rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1 text-[11px] font-medium text-tinta/70 hover:bg-tinta/10 hover:text-tinta transition-colors cursor-pointer"
            >
              <Maximize2 className="h-3 w-3" />
              <span className="hidden sm:inline">Ver todo</span>
            </button>
          </div>
        </div>

        {/* Contenedor Leaflet */}
        <div className="relative flex-1 w-full min-h-[300px] rounded-xl overflow-hidden border border-tinta/15 shadow-inner">
          {(cargandoGeo || (modoVista === 'municipios' && cargandoMpios)) && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-fondo/75 backdrop-blur-sm">
              <RefreshCw className="h-7 w-7 animate-spin text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
              <p className="mt-2 text-xs font-semibold text-tinta/70">Cargando cartografía municipal y departamental…</p>
            </div>
          )}

          <div ref={mapContainerRef} className="h-full w-full z-10" />

          {/* Leyenda de concentración de siniestros */}
          <div className="absolute bottom-2 left-2 z-20 rounded-xl glass px-2.5 py-1 text-[10px] text-tinta/80 shadow-lg border border-tinta/10 backdrop-blur-md">
            <div className="font-bold text-tinta text-[9px] uppercase tracking-wide mb-0.5">Siniestros</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#047857]" />
                <span>&gt;500</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#059669]" />
                <span>&gt;100</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#0d9488]" />
                <span>&gt;20</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#0284c7]" />
                <span>&gt;5</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#38bdf8]" />
                <span>1-5</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[#94a3b8] opacity-50" />
                <span>0</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Panel de Detalle Territorial y Explorador de Municipios */}
      <div className="flex flex-col rounded-2xl glass p-2.5 lg:col-span-4 overflow-hidden h-full">
        {itemSeleccionado ? (
          /* Departamento Seleccionado: Explorador de Municipios */
          <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-2 flex items-center justify-between border-b border-tinta/10 pb-1.5 shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-xuma-verde-oscuro dark:text-xuma-verde-claro">
                  Departamento Seleccionado
                </span>
                <h3 className="text-sm font-extrabold text-tinta">{itemSeleccionado.departamento}</h3>
              </div>
              <button
                type="button"
                onClick={resetVista}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-0.5 text-[10px] font-semibold text-tinta/70 hover:bg-tinta/10 hover:text-tinta"
              >
                <X className="h-3 w-3" />
                <span>Cerrar</span>
              </button>
            </div>

            {/* Micro métricas del departamento */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 shrink-0">
              <div className="rounded-lg border border-tinta/10 bg-tinta/5 p-1.5">
                <span className="text-[9px] font-semibold text-tinta/50">Total Siniestros</span>
                <p className="text-sm font-black text-tinta">{formatNum(itemSeleccionado.total)}</p>
                <span className="text-[9px] text-tinta/50">
                  {((itemSeleccionado.total / Math.max(1, data.totalNacional)) * 100).toFixed(1)}% nacional
                </span>
              </div>

              <div className="rounded-lg border border-tinta/10 bg-tinta/5 p-1.5">
                <span className="text-[9px] font-semibold text-tinta/50">Total Pagado</span>
                <p className="text-xs font-black text-xuma-verde-oscuro dark:text-xuma-verde-claro truncate" title={formatCOP(itemSeleccionado.totalPagado)}>
                  {formatCOP(itemSeleccionado.totalPagado)}
                </p>
                <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                  {itemSeleccionado.pagados} pagados
                </span>
              </div>
            </div>

            {/* Buscador de municipio */}
            <div className="relative mb-2 shrink-0">
              <input
                type="text"
                className="w-full rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1 pl-6 text-xs text-tinta placeholder-tinta/35 outline-none focus:border-xuma-verde-claro/70"
                placeholder="Buscar municipio en este dpto…"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
              <Search className="absolute left-1.5 top-2 h-3 w-3 text-tinta/40" />
            </div>

            {/* Cabecera de lista */}
            <div className="flex items-center justify-between mb-1 shrink-0 px-1 text-[10px] font-bold text-tinta/70">
              <span>Municipio ({municipiosFiltrados.length})</span>
              <span>Siniestros / Pagado</span>
            </div>

            {/* Listado con scroll interno de municipios */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 min-h-0 divide-y divide-tinta/5">
              {municipiosFiltrados.map((m) => {
                const isSelected = mpioSeleccionado != null && norm(m.municipio) === norm(mpioSeleccionado);
                return (
                  <div
                    key={m.municipio}
                    onClick={() => setMpioSeleccionado(m.municipio)}
                    className={`flex items-center justify-between py-1.5 px-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-amber-500/15 border border-amber-500/30 font-bold'
                        : 'hover:bg-tinta/5'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-semibold text-tinta block truncate text-xs">{m.municipio}</span>
                      <span className="text-[10px] text-tinta/50">{m.total} caso{m.total > 1 ? 's' : ''}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs">
                        {m.pagado > 0 ? formatCOP(m.pagado) : '$0'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Panorama Nacional: Explorador de Departamentos */
          <div className="flex flex-col h-full overflow-hidden">
            <div className="mb-1.5 shrink-0 border-b border-tinta/10 pb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-xuma-verde-oscuro dark:text-xuma-verde-claro">
                Panorama Nacional
              </span>
              <h3 className="text-xs font-extrabold text-tinta">Departamentos con Siniestralidad</h3>
              <p className="text-[10px] text-tinta/50">Selecciona un departamento para explorar todos sus municipios.</p>
            </div>

            {/* Buscador de departamento */}
            <div className="relative mb-2 shrink-0">
              <input
                type="text"
                className="w-full rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1 pl-6 text-xs text-tinta placeholder-tinta/35 outline-none focus:border-xuma-verde-claro/70"
                placeholder="Buscar departamento…"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
              <Search className="absolute left-1.5 top-2 h-3 w-3 text-tinta/40" />
            </div>

            {/* Lista scrollable de departamentos */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 min-h-0">
              {departamentosFiltrados.map((d, idx) => (
                <button
                  key={d.departamento}
                  type="button"
                  onClick={() => onSelectDepto(d.departamento)}
                  className="w-full flex items-center justify-between p-1.5 rounded-lg border border-tinta/10 bg-tinta/5 hover:bg-tinta/10 hover:border-xuma-verde-claro/50 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-tinta/10 text-[9px] font-bold text-tinta/70">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-tinta block truncate group-hover:text-xuma-verde-oscuro dark:group-hover:text-xuma-verde-claro">
                        {d.departamento}
                      </span>
                      <span className="text-[9px] text-tinta/50">
                        {d.municipios.length} municipios · {d.pagados} pagados
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-1.5">
                    <span className="font-extrabold text-xs text-tinta block">
                      {formatNum(d.total)}
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                      {formatCOP(d.totalPagado)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
