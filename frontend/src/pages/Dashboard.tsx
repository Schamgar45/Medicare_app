import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  Coins,
  FlaskConical,
  Hourglass,
  Pill,
  Stethoscope,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Dashboard, MonthPoint } from '@/lib/types';
import { PageHeader, Skeleton, Stat, ErrorState } from '@/components/ui';
import { label, money, monthLabel, num } from '@/lib/format';

function ChartCard({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`card p-4 ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="h-60">{children}</div>
    </section>
  );
}

function Tip({ active, payload, label: l, money: m }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{l}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums text-sub">
          {m ? money(p.value) : num(p.value)}
        </p>
      ))}
    </div>
  );
}

function Monthly({
  data,
  color = 'var(--chart-1)',
  isMoney,
}: {
  data: MonthPoint[];
  color?: string;
  isMoney?: boolean;
}) {
  const d = data.map((p) => ({ ...p, name: monthLabel(p.month) }));
  return (
    <ResponsiveContainer>
      <BarChart data={d} margin={{ left: -12, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
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
          tickFormatter={(v) => (isMoney && v >= 1000 ? `${Math.round(v / 1000)}k` : v)}
        />
        <Tooltip cursor={{ fill: 'rgb(var(--sunken))' }} content={<Tip money={isMoney} />} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ByStatus({ data }: { data: Record<string, number> }) {
  const d = Object.entries(data)
    .map(([k, v]) => ({ name: label(k), value: v }))
    .sort((a, b) => b.value - a.value);
  if (!d.length)
    return <p className="grid h-full place-items-center text-sm text-mute">Aucune donnée</p>;
  return (
    <ResponsiveContainer>
      <BarChart data={d} layout="vertical" margin={{ left: 8, right: 24 }}>
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
          {d.map((_, i) => (
            <Cell key={i} fill="var(--chart-1)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const { user, doctor } = useAuth();
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () =>
      (await api.get<Dashboard>('/stats/dashboard/', { params: { months: 12 } })).data,
    refetchInterval: 120_000,
  });
  const d = q.data;
  const hello = `Bonjour ${user?.first_name || user?.username || ''}`.trim();

  return (
    <>
      <PageHeader
        title={hello}
        subtitle={
          user?.role === 'DOCTOR'
            ? `Vos chiffres${doctor?.service_detail ? ` · ${doctor.service_detail.name}` : ''}`
            : "Vue d'ensemble de l'activité"
        }
      />
      {q.isError && (
        <div className="card">
          <ErrorState onRetry={() => q.refetch()} />
        </div>
      )}
      {q.isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </div>
      )}
      {d && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {d.patients && (
              <Stat
                icon={<Users className="h-5 w-5" />}
                label="Patients"
                value={num(d.patients.total)}
                hint={`+${d.patients.new_this_month} ce mois`}
              />
            )}
            {d.appointments && (
              <Stat
                icon={<CalendarDays className="h-5 w-5" />}
                label="RDV aujourd'hui"
                value={num(d.appointments.today)}
                tone="accent"
              />
            )}
            {d.consultations && (
              <Stat
                icon={<Stethoscope className="h-5 w-5" />}
                label="Consultations"
                value={num(d.consultations.total)}
                hint={`${d.consultations.today} aujourd'hui`}
              />
            )}
            {d.doctors && (
              <Stat
                icon={<UserRound className="h-5 w-5" />}
                label="Médecins"
                value={num(d.doctors.total)}
                hint={`${d.doctors.available} disponible${d.doctors.available > 1 ? 's' : ''}`}
                tone="accent"
              />
            )}
            {d.lab && (
              <Stat
                icon={<FlaskConical className="h-5 w-5" />}
                label="Examens en attente"
                value={num(d.lab.pending_requests)}
                tone="warn"
              />
            )}
            {d.billing && (
              <Stat
                icon={<Coins className="h-5 w-5" />}
                label="Recettes du mois"
                value={money(d.billing.revenue_this_month)}
                hint={`Total ${money(d.billing.revenue_total)}`}
                tone="accent"
              />
            )}
            {d.billing && (
              <Stat
                icon={<Wallet className="h-5 w-5" />}
                label="Reste à encaisser"
                value={money(d.billing.outstanding_balance)}
                hint={`${d.billing.unpaid_invoices} facture${d.billing.unpaid_invoices > 1 ? 's' : ''}`}
                tone="bad"
              />
            )}
            {d.pharmacy && (
              <Stat
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Stock bas"
                value={num(d.pharmacy.low_stock_count)}
                hint={`${d.pharmacy.expired_count} lot${d.pharmacy.expired_count > 1 ? 's' : ''} périmé${d.pharmacy.expired_count > 1 ? 's' : ''}`}
                tone="warn"
              />
            )}
            {d.pharmacy && (
              <Stat
                icon={<Hourglass className="h-5 w-5" />}
                label="Péremption proche"
                value={num(d.pharmacy.expiring_soon_count)}
                tone="bad"
              />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {d.patients && (
              <ChartCard title="Nouveaux patients par mois">
                <Monthly data={d.patients.per_month} />
              </ChartCard>
            )}
            {d.appointments && (
              <ChartCard title="Rendez-vous par mois">
                <Monthly data={d.appointments.per_month} color="var(--chart-2)" />
              </ChartCard>
            )}
            {d.billing && (
              <ChartCard title="Recettes par mois" wide>
                <Monthly data={d.billing.revenue_per_month} isMoney />
              </ChartCard>
            )}
            {d.consultations && (
              <ChartCard title="Consultations par mois">
                <Monthly data={d.consultations.per_month} color="var(--chart-3)" />
              </ChartCard>
            )}
            {d.appointments && (
              <ChartCard title="Rendez-vous par statut">
                <ByStatus data={d.appointments.by_status} />
              </ChartCard>
            )}
            {d.lab && (
              <ChartCard title="Examens par statut">
                <ByStatus data={d.lab.by_status} />
              </ChartCard>
            )}
            {d.lab && (
              <ChartCard title="Demandes d'examens par mois">
                <Monthly data={d.lab.requests_per_month} color="var(--chart-2)" />
              </ChartCard>
            )}
            {d.pharmacy && (
              <ChartCard title="Consommation de médicaments par mois">
                <Monthly data={d.pharmacy.consumed_per_month} />
              </ChartCard>
            )}
            {d.pharmacy && d.pharmacy.top_consumed.length > 0 && (
              <ChartCard title="Médicaments les plus consommés">
                <ByStatus
                  data={Object.fromEntries(
                    d.pharmacy.top_consumed.map((t) => [t.medication, t.quantity]),
                  )}
                />
              </ChartCard>
            )}
          </div>
        </div>
      )}
    </>
  );
}
