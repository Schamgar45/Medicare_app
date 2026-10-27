import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { api } from '@/lib/api';
import { CENTER, APP_VERSION } from '@/lib/center';
import { label, initials, fmtDateTime } from '@/lib/format';
import { CIRCUIT, NAV, NavGroup, NavItem, allowed } from './nav';
import { useList, useAction } from '@/lib/queries';
import type { AppNotification, Dashboard } from '@/lib/types';

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/brand/logo.png"
        alt=""
        className="h-11 w-11 shrink-0 object-contain"
      />
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-ink sm:text-[17px]">
          {CENTER.name}
        </p>
        <p className="hidden text-[11px] font-medium text-mute sm:block">{CENTER.slogan}</p>
      </div>
    </div>
  );
}

function useCounts() {
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () =>
      (await api.get<Dashboard>('/stats/dashboard/', { params: { months: 12 } })).data,
    staleTime: 120_000,
  });
  const d = q.data;
  return {
    patients: d?.patients?.total,
    appointments: d?.appointments?.today,
    lab: d?.lab?.pending_requests,
    stock: d?.pharmacy?.low_stock_count,
    invoices: d?.billing?.unpaid_invoices,
  };
}
const COUNT_CLASS = 'rounded-full bg-sunken px-2 py-0.5 text-xs font-bold text-sub num';

type Counts = {
  patients?: number;
  appointments?: number;
  lab?: number;
  stock?: number;
  invoices?: number;
};
const GROUPS: NavGroup[] = ['Navigation', 'Soins médicaux', 'Pharmacie & caisse', 'Administration'];

function SideNav({ items, counts, collapsed = false }: { items: NavItem[]; counts: Counts; collapsed?: boolean }) {
  const groups = GROUPS.map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter(
    (x) => x.list.length,
  );
  return (
    <nav
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3"
      aria-label="Navigation principale"
    >
      {groups.map(({ g, list }) => (
        <div key={g} className="mb-4">
          {!collapsed && (
            <p className="px-5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-mute">
              {g}
            </p>
          )}
          {list.map(({ to, label: l, icon: Icon, countKey }) => {
            const c = countKey ? counts[countKey] : undefined;
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                title={collapsed ? l : undefined}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 border-r-[3px] py-2.5 text-[15px] font-medium transition',
                    collapsed ? 'justify-center px-0' : 'px-5',
                    isActive
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-transparent text-sub hover:bg-sunken hover:text-ink',
                  )
                }
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{l}</span>
                    {c !== undefined && c > 0 && <span className={COUNT_CLASS}>{c}</span>}
                  </>
                )}
                {collapsed && <span className="sr-only">{l}</span>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SideFoot({
  name,
  role,
  avatar,
  onLogout,
  collapsed = false,
}: {
  name: string;
  role?: string;
  avatar?: string | null;
  onLogout: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className={clsx('shrink-0 border-t', collapsed ? 'space-y-2 p-2' : 'space-y-3 p-4')}>
      <NavLink
        to="/mon-profil"
        title={collapsed ? `${name} · ${label(role)}` : undefined}
        aria-label={collapsed ? `Profil de ${name}` : undefined}
        className={clsx(
          'flex rounded-xl transition hover:bg-sunken',
          collapsed ? 'justify-center p-1.5' : 'items-center gap-3 p-1.5',
        )}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-navy/20"
          />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy text-sm font-bold text-white">
            {initials(name) || '?'}
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="text-xs text-mute">{label(role)}</p>
          </div>
        )}
      </NavLink>
      <button
        className={clsx(
          'flex items-center justify-center rounded-lg border border-bad/40 bg-surface text-bad transition hover:bg-bad/5',
          collapsed ? 'h-10 w-full' : 'w-full gap-2 py-2.5 text-sm font-bold',
        )}
        onClick={onLogout}
        title={collapsed ? 'Déconnexion' : undefined}
        aria-label="Déconnexion"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {!collapsed && 'Déconnexion'}
      </button>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = useList<AppNotification>('notifications', { ordering: '-created_at', page_size: 10 });
  const mark = useAction('notifications');
  const unread = q.data?.results.filter((n) => !n.is_read).length ?? 0;
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        className="relative grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface" />
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-[min(92vw,360px)] overflow-hidden shadow-xl">
          <div className="border-b px-4 py-3 text-sm font-bold">Notifications</div>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {q.data?.results.map((n) => (
              <li key={n.id}>
                <button
                  className={clsx(
                    'w-full px-4 py-3 text-left hover:bg-sunken',
                    !n.is_read && 'bg-brand/5',
                  )}
                  onClick={() =>
                    !n.is_read &&
                    mark.mutate({ url: `${n.id}/`, method: 'patch', data: { is_read: true } })
                  }
                >
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-sub">{n.message}</p>
                  <p className="mt-1 text-[11px] text-mute">{fmtDateTime(n.created_at)}</p>
                </button>
              </li>
            ))}
            {!q.data?.results.length && (
              <li className="p-6 text-center text-sm text-mute">Aucune notification</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const GLOBAL_SEARCH = [
  {
    title: 'Patients',
    path: 'patients',
    to: '/patients',
    roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'],
    name: (x: any) => `${x.first_name ?? ''} ${x.last_name ?? ''}`.trim(),
    detail: (x: any) => x.patient_number ?? x.phone,
  },
  {
    title: 'Rendez-vous',
    path: 'appointments',
    to: '/appointments',
    roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'],
    name: (x: any) =>
      x.patient_detail
        ? `${x.patient_detail.first_name} ${x.patient_detail.last_name}`
        : x.appointment_number,
    detail: (x: any) => x.appointment_number,
  },
  {
    title: 'Consultations',
    path: 'consultations',
    to: '/consultations',
    roles: ['ADMIN', 'DOCTOR'],
    name: (x: any) =>
      x.patient_detail
        ? `${x.patient_detail.first_name} ${x.patient_detail.last_name}`
        : x.consultation_number,
    detail: (x: any) => x.consultation_number,
  },
  {
    title: 'Ordonnances',
    path: 'prescriptions',
    to: '/prescriptions',
    roles: ['ADMIN', 'DOCTOR', 'PHARMACIST'],
    name: (x: any) =>
      x.patient_detail
        ? `${x.patient_detail.first_name} ${x.patient_detail.last_name}`
        : x.prescription_number,
    detail: (x: any) => x.prescription_number,
  },
  {
    title: 'Laboratoire',
    path: 'lab/requests',
    to: '/lab',
    roles: ['ADMIN', 'DOCTOR', 'LABORANT'],
    name: (x: any) =>
      x.patient_detail
        ? `${x.patient_detail.first_name} ${x.patient_detail.last_name}`
        : x.request_number,
    detail: (x: any) => x.request_number,
  },
  {
    title: 'Médicaments',
    path: 'medications',
    to: '/pharmacy',
    roles: ['ADMIN', 'PHARMACIST'],
    name: (x: any) => x.name,
    detail: (x: any) => x.generic_name,
  },
  {
    title: 'Factures',
    path: 'invoices',
    to: '/billing',
    roles: ['ADMIN', 'RECEPTIONIST', 'CASHIER'],
    name: (x: any) =>
      x.patient_detail
        ? `${x.patient_detail.first_name} ${x.patient_detail.last_name}`
        : x.invoice_number,
    detail: (x: any) => x.invoice_number,
  },
  {
    title: 'Paiements',
    path: 'payments',
    to: '/billing',
    roles: ['ADMIN', 'RECEPTIONIST', 'CASHIER'],
    name: (x: any) => x.payment_number,
    detail: (x: any) => x.invoice_number,
  },
  {
    title: 'Médecins',
    path: 'doctors',
    to: '/doctors',
    roles: ['ADMIN', 'RECEPTIONIST'],
    name: (x: any) => x.name,
    detail: (x: any) => x.specialty_name,
  },
];

function GlobalSearch({ role }: { role?: string }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const groups = GLOBAL_SEARCH.filter((g) => role === 'ADMIN' || g.roles.includes(role ?? ''));
  const result = useQuery({
    queryKey: ['global-search', query, role],
    enabled: query.trim().length > 0,
    queryFn: async () =>
      Promise.all(
        groups.map(async (g) => {
          try {
            const r = await api.get<{ results: any[] }>(`/${g.path}/`, {
              params: { search: query.trim(), page_size: 5 },
            });
            return { ...g, results: r.data.results };
          } catch {
            return { ...g, results: [] };
          }
        }),
      ),
    staleTime: 10_000,
  });
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const hasResults = result.data?.some((g) => g.results.length);
  return (
    <div ref={ref} className="relative mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-mute" />
      <input
        className="input h-10 bg-sunken pl-9 pr-9"
        placeholder="Rechercher patients, rendez-vous, médicaments…"
        aria-label="Recherche globale"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {query && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-mute hover:text-ink"
          aria-label="Effacer la recherche"
          onClick={() => {
            setQuery('');
            setOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {open && query.trim() && (
        <div className="card absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,520px)] overflow-y-auto p-2 shadow-xl">
          {result.isFetching && <p className="p-3 text-sm text-mute">Recherche en cours…</p>}
          {result.isFetched && !result.isFetching && !hasResults && (
            <p className="p-4 text-center text-sm text-mute">Aucun résultat pour « {query} » </p>
          )}
          {result.data?.map(
            (g) =>
              g.results.length > 0 && (
                <section key={g.path} className="mb-2">
                  <h3 className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-mute">
                    {g.title}
                  </h3>
                  {g.results.map((x: any) => (
                    <button
                      key={x.id}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-sunken"
                      onClick={() => {
                        navigate(g.to);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {g.name(x) || g.title}
                        </span>
                        <span className="block truncate text-xs text-mute">{g.detail(x)}</span>
                      </span>
                    </button>
                  ))}
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const { theme, toggle } = useTheme();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const counts = useCounts();
  useEffect(() => setOpen(false), [loc.pathname]);

  const items = NAV.filter((n) => allowed(n, user?.role));
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || '';
  const circuit = CIRCUIT.filter((c) => {
    const it = NAV.find((n) => n.to === c.to);
    return (
      (it && allowed(it, user?.role) && user?.role !== 'CASHIER') ||
      (c.to === '/billing' && can('RECEPTIONIST', 'CASHIER'))
    );
  });

  const handleLogout = async () => {
    await logout();
    nav('/');
  };

  return (
    <div
      className={clsx(
        'min-h-screen lg:grid',
        collapsed ? 'lg:grid-cols-[76px_1fr]' : 'lg:grid-cols-[260px_1fr]',
      )}
    >
      <aside
        className={clsx(
          'sticky top-0 hidden h-screen flex-col overflow-hidden border-r bg-surface transition-all duration-300 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[260px]',
        )}
      >
        <div className={clsx('flex shrink-0 items-center border-b py-4', collapsed ? 'justify-center px-2' : 'justify-start gap-3 px-5')}>
          <button
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-brand hover:bg-sunken"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
            title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          >
            <Menu className="h-4 w-4" />
          </button>
          {!collapsed && (
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-sub">
              Navigation
            </span>
          )}
        </div>
        <SideNav items={items} counts={counts} collapsed={collapsed} />
        <SideFoot name={name} role={user?.role} avatar={user?.avatar} onLogout={handleLogout} collapsed={collapsed} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-xl transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sub">
            <Menu className="h-4 w-4 text-brand" />
            Navigation
          </span>
          <button onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <SideNav items={items} counts={counts} />
        <SideFoot name={name} role={user?.role} avatar={user?.avatar} onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              className="grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Brand />
            <GlobalSearch role={user?.role} />
            <div className="flex shrink-0 items-center gap-3">
              <button
                className="grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken"
                onClick={() => qc.invalidateQueries()}
                aria-label="Actualiser"
              >
                <RefreshCw className="h-[18px] w-[18px]" />
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken"
                onClick={toggle}
                aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-[18px] w-[18px]" />
                ) : (
                  <Moon className="h-[18px] w-[18px]" />
                )}
              </button>
              <Notifications />
              <NavLink
                to="/mon-profil"
                className="relative hidden h-10 w-10 items-center justify-center rounded-full bg-navy text-xs font-bold text-white ring-2 ring-brand/20 transition hover:ring-brand/40 md:flex"
                aria-label="Ouvrir mon profil (en ligne)"
                title={`${name} · ${label(user?.role)} · En ligne`}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span>{initials(name) || '?'}</span>
                )}
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-ok"
                  aria-hidden="true"
                />
              </NavLink>
            </div>
          </div>
          {circuit.length > 0 && (
            <div
              className="hidden items-center gap-1 overflow-x-auto border-t px-6 py-2 md:flex"
              aria-label="Parcours du patient"
            >
              <span className="mr-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-mute">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Circuit :
              </span>
              {circuit.map((c, i) => (
                <div key={c.to} className="flex items-center">
                  <NavLink
                    to={c.to}
                    className={({ isActive }) =>
                      clsx(
                        'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition',
                        isActive
                          ? 'bg-brand/12 text-brand ring-1 ring-brand/30'
                          : 'text-sub hover:bg-sunken',
                      )
                    }
                  >
                    {c.label}
                  </NavLink>
                  {i < circuit.length - 1 && (
                    <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-mute" />
                  )}
                </div>
              ))}
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 animate-rise p-4 sm:p-6">
          <Outlet />
        </main>
        <footer className="flex items-center justify-between border-t bg-surface px-6 py-3 text-xs text-mute">
          <span>
            {CENTER.name} · version {APP_VERSION}
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-accent" />
            Opérationnel
          </span>
        </footer>
      </div>
    </div>
  );
}
