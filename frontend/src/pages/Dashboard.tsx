import { lazy, ReactNode, Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Receipt,
  UserPlus,
  Coins,
  FlaskConical,
  Pill,
  Stethoscope,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Dashboard } from '@/lib/types';
import { Avatar, Skeleton, Stat, ErrorState, StatusBadge, Pagination } from '@/components/ui';
import { useList } from '@/lib/queries';
import type { Appointment } from '@/lib/types';
import { fmtTime, fullName, label, money, num, greeting } from '@/lib/format';

const Monthly = lazy(() =>
  import('@/components/DashboardCharts').then((m) => ({ default: m.Monthly })),
);
const Donut = lazy(() =>
  import('@/components/DashboardCharts').then((m) => ({ default: m.Donut })),
);
const ByStatus = lazy(() =>
  import('@/components/DashboardCharts').then((m) => ({ default: m.ByStatus })),
);

function ChartCard({
  title,
  children,
  wide,
  compact,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <section className={`card ${compact ? 'p-3' : 'p-4'} ${wide ? 'lg:col-span-2' : ''}`}>
      <h3 className={`${compact ? 'mb-2' : 'mb-3'} text-sm font-bold`}>{title}</h3>
      <div className={compact ? 'h-52' : 'h-60'}>
        <Suspense fallback={<Skeleton className="h-full" />}>{children}</Suspense>
      </div>
    </section>
  );
}

const QUEUE_SIZE = 8;
function Queue() {
  const today = new Date().toISOString().slice(0, 10);
  const [page, setPage] = useState(1);
  const q = useList<Appointment>('appointments', {
    appointment_date: today,
    ordering: 'appointment_time',
    page,
    page_size: QUEUE_SIZE,
  });
  const rows = q.data?.results ?? [];
  const count = q.data?.count ?? 0;
  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h3 className="font-bold">File d'attente du jour</h3>
        <Link to="/appointments" className="text-xs font-semibold text-brand hover:underline">
          Tout voir
        </Link>
      </div>
      {q.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : !rows.length ? (
        <p className="p-8 text-center text-sm text-mute">Aucun rendez-vous aujourd'hui.</p>
      ) : (
        <>
          <ul className="divide-y">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={fullName(a.patient_detail)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{fullName(a.patient_detail)}</p>
                  <p className="truncate text-xs text-sub">
                    {a.doctor_detail?.name}
                    {a.reason ? ` · ${a.reason}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{fmtTime(a.appointment_time)}</p>
                  <StatusBadge value={a.status} />
                </div>
              </li>
            ))}
          </ul>
          {count > QUEUE_SIZE && (
            <Pagination page={page} count={count} size={QUEUE_SIZE} onPage={setPage} />
          )}
        </>
      )}
    </section>
  );
}

function PageTabs({
  view,
  count,
  onChange,
}: {
  view: number;
  count: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        className="inline-flex h-9 items-center gap-1 rounded-full border bg-surface px-3 text-xs font-bold text-sub transition hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        disabled={view === 0}
        onClick={() => onChange(view - 1)}
        aria-label="Page précédente"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Précédent</span>
      </button>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-current={i === view}
          aria-label={`Aller à la page ${i + 1}`}
          className={clsx(
            'grid h-9 w-9 place-items-center rounded-full text-sm font-bold tabular-nums transition',
            i === view
              ? 'bg-brand text-brand-ink shadow-md shadow-brand/25'
              : 'border bg-surface text-sub hover:bg-sunken hover:text-ink',
          )}
        >
          {i + 1}
        </button>
      ))}
      <button
        className="inline-flex h-9 items-center gap-1 rounded-full border bg-surface px-3 text-xs font-bold text-sub transition hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        disabled={view === count - 1}
        onClick={() => onChange(view + 1)}
        aria-label="Page suivante"
      >
        <span className="hidden sm:inline">Suivant</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Instant serveur en direct (salutation/horloge alignées sur l'heure du centre, pas l'appareil).
 *  On interroge /auth/server-time/ pour corriger l'horloge locale, puis on avance
 *  d'une seconde à la fois ; le drift éventuel est négligeable entre deux refetch. */
function useServerNow() {
  const { data } = useQuery({
    queryKey: ['server-time'],
    queryFn: async () =>
      (await api.get<{ now: string; timezone: string }>('/auth/server-time/')).data,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const serverEpoch = data?.now ? new Date(data.now).getTime() : null;
  const [now, setNow] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  // On ne recalcule l'offset qu'à l'arrivée d'une nouvelle heure serveur,
  // sinon Date.now() change à chaque rendu et réinitialise l'intervalle.
  useEffect(() => {
    if (serverEpoch !== null) {
      setOffset(serverEpoch - Date.now());
      setNow(new Date(serverEpoch));
    }
  }, [serverEpoch]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date(Date.now() + offset)), 1000);
    return () => clearInterval(t);
  }, [offset]);
  return now;
}

export default function DashboardPage() {
  const { user, doctor, can } = useAuth();
  const [view, setView] = useState(0);
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () =>
      (await api.get<Dashboard>('/stats/dashboard/', { params: { months: 12 } })).data,
    staleTime: 120_000,
    refetchInterval: 5 * 60_000,
  });
  const d = q.data;
  const name = user?.first_name || user?.username || '';
  // Horloge/heure serveur (dérive de l'appareil corrigée par le back) : tick chaque seconde
  const now = useServerNow();
  const date = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const hello = greeting(now);
  const quick = [
    can('RECEPTIONIST') && {
      to: '/patients?new=1',
      t: 'Nouveau patient',
      i: <UserPlus className="h-4 w-4" />,
    },
    can('RECEPTIONIST', 'DOCTOR') && {
      to: '/appointments?new=1',
      t: 'Nouveau rendez-vous',
      i: <CalendarDays className="h-4 w-4" />,
    },
    can('RECEPTIONIST', 'CASHIER') && {
      to: '/billing',
      t: 'Facturation',
      i: <Receipt className="h-4 w-4" />,
    },
    can('DOCTOR') && {
      to: '/consultations',
      t: 'Consultations',
      i: <Stethoscope className="h-4 w-4" />,
    },
    can('LABORANT') && { to: '/lab', t: 'Examens', i: <FlaskConical className="h-4 w-4" /> },
    can('PHARMACIST') && { to: '/pharmacy', t: 'Pharmacie', i: <Pill className="h-4 w-4" /> },
  ].filter(Boolean) as { to: string; t: string; i: ReactNode }[];

  return (
    <div className="space-y-5">
      {q.isError && (
        <div className="card">
          <ErrorState onRetry={() => q.refetch()} />
        </div>
      )}
      {q.isLoading && (
        <div className="space-y-4" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </div>
      )}
      {d &&
        (() => {
          const views: { label: string; hint: string; node: ReactNode }[] = [];

          const statCards: ReactNode[] = [];
          if (d.patients)
            statCards.push(
              <Stat
                key="patients"
                icon={<Users className="h-5 w-5" />}
                label="Patients"
                value={num(d.patients.total)}
                hint={`+${d.patients.new_this_month} ce mois`}
              />,
            );
          if (d.appointments)
            statCards.push(
              <Stat
                key="rdv"
                icon={<CalendarDays className="h-5 w-5" />}
                label="RDV aujourd'hui"
                value={num(d.appointments.today)}
                tone="accent"
              />,
            );
          if (d.consultations)
            statCards.push(
              <Stat
                key="cons"
                icon={<Stethoscope className="h-5 w-5" />}
                label="Consultations"
                value={num(d.consultations.total)}
                hint={`${d.consultations.today} aujourd'hui`}
              />,
            );
          if (d.doctors)
            statCards.push(
              <Stat
                key="docs"
                icon={<UserRound className="h-5 w-5" />}
                label="Médecins"
                value={num(d.doctors.total)}
                hint={`${d.doctors.available} disponible${d.doctors.available > 1 ? 's' : ''}`}
                tone="accent"
              />,
            );
          if (d.lab)
            statCards.push(
              <Stat
                key="lab"
                icon={<FlaskConical className="h-5 w-5" />}
                label="Examens en attente"
                value={num(d.lab.pending_requests)}
                tone="warn"
              />,
            );
          if (d.billing)
            statCards.push(
              <Stat
                key="rev"
                icon={<Coins className="h-5 w-5" />}
                label="Recettes du mois"
                value={money(d.billing.revenue_this_month)}
                hint={`Total ${money(d.billing.revenue_total)}`}
                tone="accent"
              />,
            );
          if (d.billing)
            statCards.push(
              <Stat
                key="out"
                icon={<Wallet className="h-5 w-5" />}
                label="Reste à encaisser"
                value={money(d.billing.outstanding_balance)}
                hint={`${d.billing.unpaid_invoices} facture${d.billing.unpaid_invoices > 1 ? 's' : ''}`}
                tone="bad"
              />,
            );
          if (d.pharmacy)
            statCards.push(
              <Stat
                key="stock"
                icon={<AlertTriangle className="h-5 w-5" />}
                label="Stock bas"
                value={num(d.pharmacy.low_stock_count)}
                hint={`${d.pharmacy.expired_count} périmé(s) · ${d.pharmacy.expiring_soon_count} bientôt`}
                tone="warn"
              />,
            );

          // PAGE 1 : stats + TOUTES les sections graphiques d'origine
          const graphCards: ReactNode[] = [];
          if (d.billing)
            graphCards.push(
              <ChartCard key="rev-m" title="Recettes par mois" compact wide>
                <Monthly data={d.billing.revenue_per_month} isMoney />
              </ChartCard>,
            );
          else if (d.patients)
            graphCards.push(
              <ChartCard key="pat-m" title="Nouveaux patients par mois" compact wide>
                <Monthly data={d.patients.per_month} />
              </ChartCard>,
            );
          if (d.appointments)
            graphCards.push(
              <ChartCard key="rdv-s" title="Rendez-vous par statut" compact>
                <Donut data={d.appointments.by_status} />
              </ChartCard>,
            );
          else if (d.lab)
            graphCards.push(
              <ChartCard key="lab-s" title="Examens par statut" compact>
                <Donut data={d.lab.by_status} />
              </ChartCard>,
            );
          if (d.billing && d.patients)
            graphCards.push(
              <ChartCard key="pat-m2" title="Nouveaux patients par mois" compact>
                <Monthly data={d.patients.per_month} />
              </ChartCard>,
            );
          if (d.appointments)
            graphCards.push(
              <ChartCard key="rdv-m" title="Rendez-vous par mois" compact>
                <Monthly data={d.appointments.per_month} color="var(--chart-2)" />
              </ChartCard>,
            );
          if (d.consultations)
            graphCards.push(
              <ChartCard key="cons-m" title="Consultations par mois" compact>
                <Monthly data={d.consultations.per_month} color="var(--chart-3)" />
              </ChartCard>,
            );
          if (d.lab)
            graphCards.push(
              <ChartCard key="lab-m" title="Demandes d'examens par mois" compact>
                <Monthly data={d.lab.requests_per_month} color="var(--chart-2)" />
              </ChartCard>,
            );
          if (d.pharmacy)
            graphCards.push(
              <ChartCard key="ph-m" title="Consommation de médicaments" compact>
                <Monthly data={d.pharmacy.consumed_per_month} />
              </ChartCard>,
            );
          if (d.pharmacy && d.pharmacy.top_consumed.length > 0) {
            graphCards.push(
              <ChartCard key="ph-top" title="Médicaments les plus consommés" compact>
                <ByStatus
                  data={Object.fromEntries(
                    d.pharmacy.top_consumed.map((t) => [t.medication, t.quantity]),
                  )}
                />
              </ChartCard>,
            );
          }
          views.push({
            label: 'Chiffres clés',
            hint: 'Stats + sections en une seule vue',
            node: (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{statCards}</div>
                <div className="grid gap-3 md:grid-cols-2">{graphCards}</div>
              </div>
            ),
          });

          // Dernière page : infos SANS stats (file d'attente compacte), tient en une vue
          views.push({
            label: 'Aperçu',
            hint: 'Infos du jour, sans les stats',
            node: <Queue />,
          });

          const cur = Math.min(view, views.length - 1);
          return (
            <section
              aria-label="Tableau de bord paginé"
              aria-roledescription="carrousel"
              className="overflow-hidden rounded-2xl border bg-surface shadow-sm"
            >
              {/* DIV 1 fusionné avec le message bonjour : fixe, élégant, ne change jamais */}
              <div className="relative overflow-hidden bg-gradient-to-br from-brand via-brand/90 to-accent p-4 text-white sm:p-5">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                      {date} · {time} · Tableau de bord
                    </p>
                    <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                      {hello} {name}
                    </h1>
                    <p className="mt-0.5 text-sm text-white/85">
                      {views[cur].label} · Page {cur + 1} / {views.length} — {views[cur].hint}
                    </p>
                  </div>
                  <div className="[&_button]:!border-white/25 [&_button]:!bg-white/10 [&_button]:!text-white [&_button]:backdrop-blur [&_button]:hover:!bg-white/20">
                    <PageTabs view={cur} count={views.length} onChange={setView} />
                  </div>
                </div>
                {quick.length > 0 && (
                  <div className="relative mt-3 flex flex-wrap gap-2">
                    {quick.slice(0, 4).map((x) => (
                      <Link
                        key={x.t}
                        to={x.to}
                        className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
                      >
                        {x.i}
                        {x.t}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* DIV 2 : seule zone qui change — Précédent remplace Suivant */}
              <div className="p-4 print:hidden sm:p-5">{views[cur].node}</div>
            </section>
          );
        })()}
    </div>
  );
}
