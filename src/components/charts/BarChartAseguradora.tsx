import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieAseguradora } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, EjeIzquierdoTick, GLASS_TOOLTIP } from './palette';

interface Props {
  data: SerieAseguradora[];
}

interface Total {
  aseguradora: string;
  total: number;
  totalFmt: string;
  pct: number;
}

function AsegTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Total }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ margin: 0, fontWeight: 700 }}>{d.aseguradora}</p>
      <p style={{ margin: 0 }}>Total: <b>{d.totalFmt}</b> ({d.pct}%)</p>
    </div>
  );
}

// Barras horizontales: las aseguradoras van en el eje Y (izquierda, nombres
// completos) y los valores en el eje X (abajo), con la cantidad al final.
export default function BarChartAseguradora({ data }: Props) {
  const aseguradoras = data.length > 0 ? Object.keys(data[0]!.porAseguradora) : [];

  const totalPorAseg = aseguradoras
    .map((a) => ({ aseguradora: a, total: data.reduce((s, m) => s + (m.porAseguradora[a] ?? 0), 0) }))
    .filter((t) => t.total > 0)
    .sort((x, y) => y.total - x.total);

  const granTotal = totalPorAseg.reduce((s, t) => s + t.total, 0);
  const totales: Total[] = totalPorAseg.map((t) => ({
    ...t,
    totalFmt: formatNum(t.total),
    pct: granTotal > 0 ? Math.round((t.total / granTotal) * 1000) / 10 : 0,
  }));

  const anchoEjes = Math.min(210, 40 + Math.max(0, ...totales.map((t) => t.aseguradora.length)) * 6.6);

  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={totales} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 4 }} barCategoryGap="26%">
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
            dataKey="aseguradora"
            axisLine={false}
            tickLine={false}
            width={anchoEjes}
            interval={0}
            tick={<EjeIzquierdoTick />}
          />
          <Tooltip content={<AsegTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          <Bar dataKey="total" radius={[0, 7, 7, 0]} animationDuration={1200} animationEasing="ease-out" barSize={15}>
            {totales.map((item) => (
              <Cell key={item.aseguradora} fill={CHART_COLORS[totales.indexOf(item) % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
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