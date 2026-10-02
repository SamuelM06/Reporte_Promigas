import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoMesHist } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoMesHist[];
}

// `compacto` = modo día: píldora más pequeña para que 31 cantidades no se
// encimen. Solo lleva cantidad; el monto pagado se ve en el hover.
function EtiquetaPildora(props: { x?: number | string; y?: number | string; value?: number | string; compacto?: boolean }) {
  const cx = Number(props.x);
  const cy = Number(props.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const texto = typeof props.value === 'number' ? formatNum(props.value) : String(props.value ?? '');
  if (!texto) return null;
  const compacto = props.compacto === true;
  const alto = compacto ? 14 : 19;
  const ancho = texto.length * (compacto ? 5.4 : 6.6) + (compacto ? 8 : 12);
  const py = cy - (compacto ? 9 : 12);
  return (
    <g>
      <rect x={cx - ancho / 2} y={py - alto / 2} width={ancho} height={alto} rx={alto / 2} fill="var(--cpanel-fondo)" fillOpacity={0.95} stroke="var(--cglass-borde)" strokeOpacity={0.8} />
      <text x={cx} y={py + 0.5} textAnchor="middle" dominantBaseline="central" fill="var(--ctinta)" fontSize={compacto ? 9 : 10.5} fontWeight={800} fontFamily="'Raleway', sans-serif">{texto}</text>
    </g>
  );
}

export default function TendenciaMensualHist({ data }: Props) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }
  const modoDia = data[0]?.dia != null;
  return (
    <div>
      <div className="h-[300px] w-full xl:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 8, left: 4, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--ctinta-suave)', fontSize: modoDia ? 10 : 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              interval={modoDia ? (data.length > 20 ? 1 : 0) : 0}
            />
            <YAxis yAxisId="si" tickFormatter={(v: number) => formatNum(v)} tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }} axisLine={false} tickLine={false} width={48} />
            <YAxis yAxisId="dinero" orientation="right" tickFormatter={(v: number) => (v === 0 ? '0' : formatCOPCompact(v))} tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }} axisLine={false} tickLine={false} width={64} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const fila = payload[0]?.payload as { dia?: number } | undefined;
                const titulo = modoDia && fila?.dia != null ? `Día ${fila.dia}` : String(label ?? '');
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{titulo}</p>
                    {payload
                      .filter((p) => p.value !== null && p.value !== undefined)
                      .map((p) => (
                        <p key={String(p.dataKey)} style={{ margin: 0 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: String(p.color ?? p.fill ?? p.stroke), marginRight: 6 }} />
                          {String(p.name)}:{' '}
                          <b>{p.dataKey === 'valorPagado' ? formatCOP(Number(p.value ?? 0)) : formatNum(Number(p.value ?? 0))}</b>
                        </p>
                      ))}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            <Bar yAxisId="si" dataKey="total" name="Siniestros" fill="var(--cgraf-1)" radius={[4, 4, 0, 0]} barSize={modoDia ? 14 : 26} animationDuration={1200} animationEasing="ease-out">
              {/* Cantidad siempre visible (píldora compacta en modo día);
                  el monto pagado solo aparece en el tooltip al hacer hover. */}
              <LabelList dataKey="total" position="top" offset={modoDia ? 7 : 10} content={<EtiquetaPildora compacto={modoDia} />} />
            </Bar>
            <Line yAxisId="dinero" type="monotone" dataKey="valorPagado" name="Total pagado" stroke="var(--cgraf-2)" strokeWidth={2.5} dot={modoDia ? false : { r: 3.5, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }} activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }} animationDuration={1400} animationEasing="ease-out" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm" style={{ background: 'var(--cgraf-1)' }} />Siniestros</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />Total pagado (COP)</span>
        {modoDia && <span className="font-semibold text-tinta/50">Días del mes · montos al pasar el cursor</span>}
      </div>
    </div>
  );
}
