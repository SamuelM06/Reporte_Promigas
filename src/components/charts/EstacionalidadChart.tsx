import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { IndiceEstacional } from '../../lib/types';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: IndiceEstacional[];
}

function EtiquetaIndice(props: { x?: number | string; y?: number | string; value?: number }) {
  const cx = Number(props.x);
  const cy = Number(props.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const texto = typeof props.value === 'number' ? `${(props.value * 100).toFixed(0)}%` : '';
  if (!texto) return null;
  const alto = 15;
  const ancho = texto.length * 5.5 + 8;
  const py = cy - 10;
  return (
    <g>
      <rect x={cx - ancho / 2} y={py - alto / 2} width={ancho} height={alto} rx={alto / 2} fill="var(--cpanel-fondo)" fillOpacity={0.95} stroke="var(--cglass-borde)" strokeOpacity={0.8} />
      <text x={cx} y={py + 0.5} textAnchor="middle" dominantBaseline="central" fill="var(--ctinta)" fontSize={9} fontWeight={800} fontFamily="'Raleway', sans-serif">{texto}</text>
    </g>
  );
}

export default function EstacionalidadChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos estacionales.</p>;
  }
  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="h-[210px] w-full xl:h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--ctinta-suave)', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={{ fill: 'var(--ctinta-suave)', fontSize: 9.5 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0]?.payload as IndiceEstacional;
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700 }}>{String(d.label ?? '')}</p>
                    <p style={{ margin: 0 }}>Índice: <b>{(d.indice * 100).toFixed(0)}%</b></p>
                    <p style={{ margin: 0, opacity: 0.75 }}>Rango: {(d.low * 100).toFixed(0)}%–{(d.high * 100).toFixed(0)}%</p>
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            <Bar dataKey="indice" fill="var(--cgraf-1)" radius={[4, 4, 0, 0]} barSize={22} animationDuration={1200} animationEasing="ease-out">
              <LabelList dataKey="indice" position="top" offset={6} content={<EtiquetaIndice />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}