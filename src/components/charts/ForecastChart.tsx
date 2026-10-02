import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoForecast } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoForecast[];
  anioObjetivo: number;
  anioPrevio: number;
  compact?: boolean;
}

interface Fila {
  label: string;
  sin: number;
  sinRango: [number, number];
  monto: number;
  montoRango: [number, number];
  referencia: number;
  proyectado: boolean;
}

const COLORES_MES = [
  '#1e40af', '#0e7490', '#0d9488', '#059669', '#16a34a', '#65a30d',
  '#ca8a04', '#ea580c', '#dc2626', '#9333ea', '#7c3aed', '#2563eb',
];

const COLOR_CORTE = '#f59e0b';

function EtiquetaPildora(props: { x?: number | string; y?: number | string; value?: number | string }) {
  const cx = Number(props.x);
  const cy = Number(props.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const texto = typeof props.value === 'number' ? formatNum(props.value) : String(props.value ?? '');
  if (!texto) return null;
  const alto = 21;
  const ancho = texto.length * 7 + 14;
  const py = cy - 14;
  return (
    <g>
      <rect x={cx - ancho / 2} y={py - alto / 2} width={ancho} height={alto} rx={alto / 2} fill="var(--cpanel-fondo)" fillOpacity={0.97} stroke="var(--cglass-borde)" strokeOpacity={0.9} />
      <text x={cx} y={py + 0.5} textAnchor="middle" dominantBaseline="central" fill="var(--ctinta)" fontSize={12} fontWeight={800} fontFamily="'Raleway', sans-serif">{texto}</text>
    </g>
  );
}

// Línea vertical animada (separador real→proyectado): dibuja el corte entre
// el último mes observado y el primer mes proyectado con "marching dashes".
function FormaCorte(props: { x1?: number | string; y1?: number | string; x2?: number | string; y2?: number | string }) {
  const x1 = Number(props.x1);
  const y1 = Number(props.y1);
  const x2 = Number(props.x2);
  const y2 = Number(props.y2);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLOR_CORTE} strokeWidth={2.5} strokeLinecap="round" className="linea-corte" />;
}

export default function ForecastChart({ data, anioObjetivo, anioPrevio, compact = false }: Props) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }
  const filas: Fila[] = data.map((p) => ({
    label: p.label, sin: p.siniestros, sinRango: [p.sinLow, p.sinHigh], monto: p.monto, montoRango: [p.montoLow, p.montoHigh], referencia: p.refAnioPrevio, proyectado: p.proyectado === true,
  }));
  // Primer mes proyectado: ahí se dibuja el separador animado (si lo hay).
  const corte = filas.find((f) => f.proyectado)?.label;
  const corteIdx = filas.findIndex((f) => f.proyectado);
  const tieneCorte = corteIdx > 0 && corteIdx < filas.length;
  // Mes actual automático: último mes real observado (ej. Sep si Oct-Dic proyectados).
  const mesActualLabel = tieneCorte ? filas[corteIdx - 1]?.label : null;
  const barSize = compact ? 22 : 36;
  return (
    <div className="flex min-h-0 flex-col overflow-hidden gap-0">
      <div className={compact ? "relative h-[190px] w-full xl:h-[180px]" : "relative h-[285px] w-full xl:h-[270px]"}>
        {/* Bandas de fondo: izquierda = Actualidad (glass blur), derecha = Proyectado.
            - Si hay corte interno (ej. cierre 2026 con 9 reales + 3 proyectados Oct-Dic): divide proporcional.
            - Si todo es proyectado (corteIdx===0): banda completa PROYECTADO. */}
        {tieneCorte ? (
          <>
            {/* Banda de fondo dividida */}
            <div
              className="pointer-events-none absolute bottom-[26px] top-[28px] z-0 flex overflow-hidden rounded-xl"
              style={{ left: 62, right: 78 }}
              aria-hidden
            >
              <div className="flex-1" style={{ flex: corteIdx }} />
              <div
                className="flex-1 border-l-2 border-dashed bg-amber-400/10 backdrop-blur-[1px] dark:bg-amber-500/12"
                style={{ flex: filas.length - corteIdx, borderColor: COLOR_CORTE }}
              />
            </div>
            {/* Etiquetas arriba, a la misma altura — ACTUALIDAD anclada a Sep, PROYECTADO centrado en Oct-Dic */}
            <div
              className="pointer-events-none absolute z-[2] flex"
              style={{ left: 62, right: 78, top: 0, height: 16 }}
              aria-hidden
            >
              <div className="flex flex-1 justify-end pr-1" style={{ flex: corteIdx }}>
                <span className="actualidad-pill h-fit -translate-y-0.5 rounded-full border border-white/35 bg-white/65 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.16em] text-tinta shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-white/[0.08] dark:text-white/90">
                  ACTUALIDAD{mesActualLabel ? ` · ${mesActualLabel.toUpperCase()}` : ''}
                </span>
              </div>
              <div className="flex flex-1 justify-center" style={{ flex: filas.length - corteIdx }}>
                <span className="h-fit -translate-y-0.5 rounded-full bg-amber-500 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.16em] text-white shadow-md ring-1 ring-amber-600/20">
                  PROYECTADO
                </span>
              </div>
            </div>
          </>
        ) : corteIdx === 0 && filas.length > 0 ? (
          <div
            className="pointer-events-none absolute z-0 flex items-start justify-center overflow-hidden rounded-xl bg-amber-400/10 pt-1 backdrop-blur-[1px] dark:bg-amber-500/12"
            style={{ left: 62, right: 78, top: 2, bottom: 26 }}
            aria-hidden
          >
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[9px] font-extrabold tracking-[0.16em] text-white shadow-md ring-1 ring-amber-600/20">
              PROYECTADO
            </span>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%" style={{ position: 'relative', zIndex: 1 }}>
          <ComposedChart data={filas} margin={{ top: 28, right: 8, left: 8, bottom: 4 }} barCategoryGap="14%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--ctinta)', fontSize: 13, fontWeight: 800 }} axisLine={false} tickLine={false} interval={0} height={22} tickMargin={4} />
            <YAxis yAxisId="si" tickFormatter={(v: number) => formatNum(v)} tick={{ fill: 'var(--ctinta-suave)', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={56} />
            <YAxis yAxisId="dinero" orientation="right" tickFormatter={(v: number) => (v === 0 ? '0' : formatCOPCompact(v))} tick={{ fill: 'var(--ctinta-suave)', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const fila = filas.find((f) => f.label === String(label ?? ''));
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{String(label ?? '')} {anioObjetivo}{fila?.proyectado ? ' · proyectado' : ' · real'}</p>
                    {fila && (
                      <>
                        <p style={{ margin: 0 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-1)', marginRight: 6 }} />Siniestros: <b>{formatNum(fila.sin)}</b>{fila.proyectado && <span style={{ opacity: 0.7 }}> (80%: {formatNum(fila.sinRango[0])}–{formatNum(fila.sinRango[1])})</span>}</p>
                        <p style={{ margin: 0 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-2)', marginRight: 6 }} />Pagado: <b>{formatCOP(fila.monto)}</b>{fila.proyectado && <span style={{ opacity: 0.7 }}> (80%: {formatCOPCompact(fila.montoRango[0])}–{formatCOPCompact(fila.montoRango[1])})</span>}</p>
                        <p style={{ margin: 0, opacity: 0.75 }}>Real {anioPrevio}: <b>{formatNum(fila.referencia)}</b></p>
                      </>
                    )}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            {corte && (
              <ReferenceLine x={corte} yAxisId="si" position="start" stroke="none" shape={<FormaCorte />} />
            )}
            <Bar yAxisId="si" dataKey="sin" name={`Siniestros ${anioObjetivo}`} radius={[6, 6, 0, 0]} barSize={barSize} animationDuration={1200} animationEasing="ease-out">
              {filas.map((f, i) => (
                <Cell key={`c-${i}`} fill={COLORES_MES[i % COLORES_MES.length]} fillOpacity={f.proyectado ? 0.45 : 1} />
              ))}
              <LabelList dataKey="sin" position="top" offset={12} content={<EtiquetaPildora />} />
            </Bar>
            <Line yAxisId="si" type="monotone" dataKey="referencia" name={`Real ${anioPrevio}`} stroke="var(--ctinta-suave)" strokeDasharray="5 4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={1400} />
            <Line yAxisId="dinero" type="monotone" dataKey="monto" name={`Pagado ${anioObjetivo}`} stroke="var(--cgraf-2)" strokeWidth={3} dot={{ r: 4, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }} activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }} animationDuration={1400} animationEasing="ease-out" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] leading-none text-tinta/70">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm" style={{ background: 'var(--cgraf-1)' }} />Siniestros {anioObjetivo}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />Pagado {anioObjetivo} (COP)</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--ctinta-suave)' }} />Real {anioPrevio}</span>
        {corte && (
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: COLOR_CORTE }}>
            <span className="h-3 w-0 border-l-2 border-dashed" style={{ borderColor: COLOR_CORTE }} />
            Corte real → proyectado
          </span>
        )}
      </div>
    </div>
  );
}
