import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

const AXIS = { fontSize: 12, fill: 'var(--na-ink-secondary)' } as const;

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--na-surface)',
  borderRadius: 'var(--na-radius-md)',
  border: '1px solid var(--na-border-strong)',
  fontSize: 12,
  color: 'var(--na-ink-primary)',
  boxShadow: 'var(--na-shadow-sm)',
} as const;

export function HBar({
  data,
  dataKey = 'value',
  nameKey = 'name',
  color = 'var(--na-accent)',
  height = 220,
  suffix = '',
}: {
  data: any[];
  dataKey?: string;
  nameKey?: string;
  color?: string | ((v: any, i: number) => string);
  height?: number;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--na-border)" />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey={nameKey}
          width={118}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip formatter={(v: any) => `${v}${suffix}`} contentStyle={TOOLTIP_STYLE} />
        <Bar
          dataKey={dataKey}
          radius={[0, 4, 4, 0]}
          barSize={14}
          fill={typeof color === 'function' ? undefined : color}
        >
          {typeof color === 'function' &&
            data.map((_, i) => <Cell key={i} fill={color(null, i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 210,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="85%"
          paddingAngle={2}
          strokeWidth={2}
          stroke="var(--na-surface)"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function Trend({
  data,
  series,
  height = 240,
  suffix = '',
}: {
  data: any[];
  series: { key: string; color: string }[];
  height?: number;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--na-border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip formatter={(v: any) => `${v}${suffix}`} contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: s.color }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FactorBars({
  factors,
}: {
  factors: { label: string; fit: number; contribution: number; weight: number }[];
}) {
  const maxC = Math.max(...factors.map((f) => f.contribution), 1);
  return (
    <div className="space-y-3">
      {factors.map((f) => (
        <div key={f.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-[var(--na-ink-primary)]">{f.label}</span>
            <span className="tabular-nums text-[var(--na-ink-secondary)]">
              <span>Fit {f.fit.toFixed(0)}%</span>
              <span className="ml-3 font-medium text-[var(--na-ink-primary)]">
                +{f.contribution.toFixed(1)} pts
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--na-well)]">
            <div
              className="h-full rounded-full bg-[var(--na-accent)]"
              style={{ width: `${(f.contribution / maxC) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
