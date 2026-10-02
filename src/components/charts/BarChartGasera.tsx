import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, EjeIzquierdoTick, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

function GaseraTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ItemGasera }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ margin: 0, fontWeight: 700 }}>{d.gasera}</p>
      <p style={{ margin: 0 }}>Siniestros: <b>{formatNum(d.total)}</b></p>
    </div>
  );
}

// Barras horizontales: las gaseras van en el eje Y (izquierda, nombres
// completos y alineados a la izquierda) y los valores en el eje X (abajo).
export default function BarChartGasera({ data }: Props) {
  const anchoEjes = Math.min(210, 40 + Math.max(0, ...data.map((d) => d.gasera.length)) * 6.6);

  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 0, bottom: 4 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="gasera"
            axisLine={false}
            tickLine={false}
            width={anchoEjes}
            interval={0}
            tick={<EjeIzquierdoTick />}
          />
          <Tooltip content={<GaseraTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          <Bar dataKey="total" radius={[0, 7, 7, 0]} animationDuration={1200} animationEasing="ease-out" barSize={15}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              offset={6}
              formatter={(v) => formatNum(Number(v))}
              style={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 800 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}