import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ItemDona } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemDona[];
}

// Dona grande que crece para llenar el panel (manteniendo la proporción 62%/88%).
export default function DonutChart({ data }: Props) {
  const total = data.reduce((a, b) => a + Number(b.total || 0), 0);

  const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (!active || !payload || payload.length === 0) return null;
    const p = payload[0];
    if (!p) return null;
    const val = Number(p.value ?? 0);
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    return (
      <div style={GLASS_TOOLTIP as React.CSSProperties}>
        <p style={{ margin: 0, fontWeight: 700 }}>{p.name}</p>
        <p style={{ margin: 0 }}>{formatNum(val)} · {pct}%</p>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-64 flex-col">
      <div className="relative min-h-40 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="nombre"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={7}
              stroke="none"
              animationDuration={1300}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-xl font-extrabold text-tinta md:text-2xl">{formatNum(total)}</span>
          <span className="text-[10px] text-tinta/55">siniestros</span>
        </div>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {data.map((item, i) => {
          const val = Number(item.total || 0);
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
          return (
            <li key={item.nombre} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="truncate text-tinta/75">{item.nombre}</span>
              </span>
              <span className="tabular font-semibold text-tinta/90">
                {formatNum(val)}
                <span className="ml-1.5 text-tinta/45">
                  {total > 0 ? `${pct}%` : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}