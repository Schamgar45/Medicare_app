import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { label, money, monthLabel, num } from '@/lib/format';
import type { MonthPoint } from '@/lib/types';

function Tip({ active, payload, label: title, money: isMoney }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{title}</p>
      {payload.map((point: any) => (
        <p key={point.dataKey} className="tabular-nums text-sub">
          {isMoney ? money(point.value) : num(point.value)}
        </p>
      ))}
    </div>
  );
}

export function Monthly({
  data,
  color = 'var(--chart-1)',
  isMoney,
}: {
  data: MonthPoint[];
  color?: string;
  isMoney?: boolean;
}) {
  const points = data.map((point) => ({ ...point, name: monthLabel(point.month) }));
  const gradientId = `g${color.replace(/\W/g, '')}`;

  return (
    <ResponsiveContainer>
      <AreaChart data={points} margin={{ left: -12, right: 4, top: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'rgb(var(--sub))' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={isMoney ? 56 : 36}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'rgb(var(--sub))' }}
          tickFormatter={(value) =>
            isMoney && value >= 1000 ? `${Math.round(value / 1000)}k` : value
          }
        />
        <Tooltip content={<Tip money={isMoney} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const DONUT_COLORS = [
  'var(--chart-1)',
  '#64748B',
  '#F59E0B',
  '#94A3B8',
  'var(--chart-2)',
  '#CBD5E1',
];

export function Donut({ data }: { data: Record<string, number> }) {
  const points = Object.entries(data)
    .map(([key, value]) => ({ name: label(key), value }))
    .filter((point) => point.value > 0);
  const total = points.reduce((sum, point) => sum + point.value, 0);

  if (!points.length) {
    return <p className="grid h-full place-items-center text-sm text-mute">Aucune donnée</p>;
  }

  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full min-w-0 flex-1">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={points}
              dataKey="value"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {points.map((point, index) => (
                <Cell key={point.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-extrabold tabular-nums">{num(total)}</p>
            <p className="text-xs text-sub">Total</p>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs">
        {points.map((point, index) => (
          <li key={point.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
            />
            <span className="text-sub">{point.name}</span>
            <b className="tabular-nums">{point.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ByStatus({ data }: { data: Record<string, number> }) {
  const points = Object.entries(data)
    .map(([key, value]) => ({ name: label(key), value }))
    .sort((a, b) => b.value - a.value);

  if (!points.length) {
    return <p className="grid h-full place-items-center text-sm text-mute">Aucune donnée</p>;
  }

  return (
    <ResponsiveContainer>
      <BarChart data={points} layout="vertical" margin={{ left: 8, right: 24 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'rgb(var(--ink))' }}
        />
        <Tooltip cursor={{ fill: 'rgb(var(--sunken))' }} content={<Tip />} />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
          label={{ position: 'right', fontSize: 11, fill: 'rgb(var(--sub))' }}
        >
          {points.map((point, index) => (
            <Cell key={point.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
