import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieMensualAnio } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, COLOR_OTROS, GLASS_TOOLTIP } from './palette';

interface Props {
  series: SerieMensualAnio[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Comparativa interanual con barras agrupadas: meses en el eje X y una barra
// por cada año. El año en curso se corta en el último mes con dato
// (null = sin dato, no se dibuja barra). La leyenda permite resaltar un año
// atenuando los demás al pasar el cursor.
export default function BarrasMensualesAnio({ series }: Props) {
  const [resaltado, setResaltado] = useState<number | null>(null);

  const ordenadas = useMemo(
    () => [...series].sort((a, b) => a.anio - b.anio),
    [series],
  );

  const barras = useMemo(() => {
    const base = [...CHART_COLORS, COLOR_OTROS];
    return ordenadas.map((s, i) => {
      let ultimo = -1;
      for (let m = 0; m < s.meses.length; m += 1) {
        if (s.meses[m] !== null) ultimo = m;
      }
      return {
        anio: s.anio,
        color: base[i % base.length] ?? 'var(--cgraf-1)',
        parcial: ultimo >= 0 && ultimo < 11,
        ultimo,
      };
    });
  }, [ordenadas]);

  const datos = useMemo(
    () =>
      MESES.map((mes, i) => {
        const fila: Record<string, number | string | null> = { mes };
        for (const s of ordenadas) fila[String(s.anio)] = s.meses[i] ?? null;
        return fila;
      }),
    [ordenadas],
  );

  if (ordenadas.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }

  return (
    <div>
      <style>{'@keyframes pulsoXuma { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }'}</style>
      <div className="h-[430px] w-full xl:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 16, right: 8, left: 4, bottom: 0 }} barCategoryGap="20%" barGap={1}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const filas = payload
                  .filter((p) => p.value !== null && p.value !== undefined)
                  .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
                if (filas.length === 0) return null;
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{String(label ?? '')}</p>
                    {filas.map((p) => (
                      <p key={String(p.dataKey)} style={{ margin: 0 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: String(p.color ?? p.fill),
                            marginRight: 6,
                          }}
                        />
                        {String(p.name)}: <b>{formatNum(Number(p.value ?? 0))}</b>
                      </p>
                    ))}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            {barras.map((b) => (
              <Bar
                key={b.anio}
                dataKey={String(b.anio)}
                name={String(b.anio)}
                fill={b.color}
                fillOpacity={resaltado !== null && resaltado !== b.anio ? 0.15 : 1}
                radius={[2, 2, 0, 0]}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        {[...barras].reverse().map((b) => (
          <button
            key={b.anio}
            type="button"
            onMouseEnter={() => setResaltado(b.anio)}
            onMouseLeave={() => setResaltado(null)}
            onFocus={() => setResaltado(b.anio)}
            onBlur={() => setResaltado(null)}
            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 outline-none transition-opacity"
            style={{ opacity: resaltado !== null && resaltado !== b.anio ? 0.4 : 1 }}
            title={b.parcial && b.ultimo >= 0 ? `${b.anio} (parcial, hasta ${MESES[b.ultimo]})` : String(b.anio)}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: b.color,
                animation: b.parcial ? 'pulsoXuma 1.8s ease-in-out infinite' : undefined,
              }}
            />
            {b.anio}
            {b.parcial ? ' (parcial)' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
