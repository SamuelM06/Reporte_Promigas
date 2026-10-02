import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { PuntoTendencia } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoTendencia[];
}

// Etiquetas de valores con fondo transparente: usan la tinta del tema
// (azul marino en claro, casi blanca en oscuro) para leerse sin ningún halo.
const estiloEtiqueta = {
  fill: 'var(--ctinta)',
  fontSize: 12,
  fontWeight: 800,
  fontFamily: "'Raleway', sans-serif",
} as const;

// En modo día (filtro mes) las etiquetas van más pequeñas para que 30 días
// no se encimen; los montos COP NO se etiquetan (solo hover en el tooltip).
const estiloEtiquetaDia = { ...estiloEtiqueta, fontSize: 10.5 } as const;

// Título del tooltip: en modo día muestra "12 de septiembre de 2026"
// (el punto trae mes ISO YYYY-MM-DD); en modo mes el nombre del mes.
function tituloPunto(p: PuntoTendencia | undefined, label: string): string {
  if (p?.dia != null) {
    const iso = p.mes; // YYYY-MM-DD
    const fecha = new Date(`${iso}T12:00:00`);
    if (!Number.isNaN(fecha.getTime())) {
      return `Día ${p.dia} · ${fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}`;
    }
    return `Día ${p.dia}`;
  }
  return mesLabel(label);
}

// Tendencia mensual en dos paneles apilados (siniestros arriba, montos abajo)
// con el mismo eje X: las dos series nunca se cruzan y siempre se entienden.
// Con filtro de mes activo el backend entrega puntos por DÍA y el eje cambia
// a números de día automáticamente (p.dia != null); sin filtro vuelve a meses.
export default function TendenciaLineChart({ data }: Props) {
  const modoDia = data.length > 0 && data[0]?.dia != null;
  const tickDias = { fill: 'var(--ctinta-suave)', fontSize: 10.5, fontWeight: 700 } as const;
  return (
    <div>
      <div className="flex h-40 flex-col gap-2">
        {/* Siniestros por mes */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAreaTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cgraf-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--cgraf-1)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
              <XAxis
                dataKey="mes"
                hide
                padding={{ left: 16, right: 16 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0]?.payload as PuntoTendencia | undefined;
                  return (
                    <div style={GLASS_TOOLTIP as React.CSSProperties}>
                      <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{tituloPunto(p, String(label ?? ''))}</p>
                      <p style={{ margin: 0 }}>Siniestros: <b>{formatNum(Number(payload[0]?.value ?? 0))}</b></p>
                    </div>
                  );
                }}
                cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Siniestros"
                stroke="var(--cgraf-1)"
                strokeWidth={2.5}
                fill="url(#gradAreaTotal)"
                animationDuration={1500}
                animationEasing="ease-out"
                dot={modoDia ? false : { r: 3.5, fill: 'var(--cgraf-1)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: 'var(--cgraf-1)', stroke: '#ffffff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={modoDia ? 6 : 8}
                  formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
                  style={modoDia ? estiloEtiquetaDia : estiloEtiqueta}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Total pagado por mes */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAreaValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cgraf-2)" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="var(--cgraf-2)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
              <XAxis
                dataKey="mes"
                tickFormatter={modoDia ? (v: string) => v.slice(8, 10).replace(/^0/, '') : mesCorto}
                tick={modoDia ? tickDias : { fill: 'var(--ctinta-suave)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={modoDia ? (data.length > 20 ? 1 : 0) : 0}
                padding={{ left: 16, right: 16 }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0]?.payload as PuntoTendencia | undefined;
                  return (
                    <div style={GLASS_TOOLTIP as React.CSSProperties}>
                      <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{tituloPunto(p, String(label ?? ''))}</p>
                      <p style={{ margin: 0 }}>Total pagado: <b>{formatCOP(Number(payload[0]?.value ?? 0))}</b></p>
                    </div>
                  );
                }}
                cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="valorPagado"
                name="Total pagado"
                stroke="var(--cgraf-2)"
                strokeWidth={2.5}
                fill="url(#gradAreaValor)"
                animationDuration={1500}
                animationEasing="ease-out"
                dot={modoDia ? false : { r: 3.5, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }}
              >
                {/* Montos solo en hover: en modo día las etiquetas COP se
                    enciman entre sí y no se entienden. */}
                {!modoDia && (
                  <LabelList
                    dataKey="valorPagado"
                    position="top"
                    offset={8}
                    formatter={(v) => (typeof v === 'number' ? formatCOPCompact(v) : v)}
                    style={estiloEtiqueta}
                  />
                )}
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-1)' }} />
          Siniestros
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />
          Total pagado (COP)
        </span>
        {modoDia && <span className="font-semibold text-tinta/50">Días del mes · montos al pasar el cursor</span>}
      </div>
    </div>
  );
}