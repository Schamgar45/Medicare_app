import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { CENTER, APP_VERSION } from '@/lib/center';
import { label, initials } from '@/lib/format';
import { NAV, allowed } from './nav';
import { useList, useAction } from '@/lib/queries';
import type { AppNotification } from '@/lib/types';
import { fmtDateTime } from '@/lib/format';

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/logo.png" alt="" className="h-10 w-10 rounded-full" />
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight">{CENTER.name}</p>
        <p className="text-[11px] text-sub">{CENTER.slogan}</p>
      </div>
    </div>
  );
}

function Bell_() {
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
        className="relative rounded-lg p-2 text-sub hover:bg-sunken"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-[min(92vw,360px)] overflow-hidden">
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

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);

  const items = NAV.filter((n) => allowed(n, user?.role));
  const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || user?.username || '';

  const Links = () => (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigation principale">
      {items.map(({ to, label: l, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-brand text-brand-ink shadow-sm'
                : 'text-sub hover:bg-sunken hover:text-ink',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {l}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-surface lg:flex">
        <div className="border-b p-4">
          <Brand />
        </div>
        <Links />
        <div className="border-t p-4 text-[11px] text-mute">Version {APP_VERSION}</div>
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
        <div className="flex items-center justify-between border-b p-4">
          <Brand />
          <button onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <Links />
        <div className="border-t p-4 text-[11px] text-mute">Version {APP_VERSION}</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-surface/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 hover:bg-sunken lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <button
            className="rounded-lg p-2 text-sub hover:bg-sunken"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Bell_ />
          <div className="ml-1 flex items-center gap-3 border-l pl-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-xs font-bold text-brand-ink">
              {initials(name) || '?'}
            </div>
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold">{name}</p>
              <p className="text-xs text-sub">{label(user?.role)}</p>
            </div>
            <button
              className="rounded-lg p-2 text-sub hover:bg-sunken"
              aria-label="Déconnexion"
              onClick={async () => {
                await logout();
                nav('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 animate-rise p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
