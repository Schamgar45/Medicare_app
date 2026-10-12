import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, ChevronsLeft, ChevronsRight, LogOut, Menu, Moon, RefreshCw, Search, SlidersHorizontal, Sun, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { api } from "@/lib/api";
import { CENTER, APP_VERSION } from "@/lib/center";
import { label, initials, fmtDateTime } from "@/lib/format";
import { CIRCUIT, NAV, NavGroup, NavItem, allowed } from "./nav";
import { useList, useAction } from "@/lib/queries";
import type { AppNotification, Dashboard } from "@/lib/types";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/logo.png" alt="" className="h-11 w-11 rounded-full shadow-md shadow-brand/20" />
      <div className="leading-tight">
        <p className="text-[17px] font-bold tracking-tight">Medicare <span className="text-brand">Hospital</span></p>
        <p className="text-[11px] font-medium text-mute">{CENTER.slogan}</p>
      </div>
    </div>
  );
}

function useCounts() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get<Dashboard>("/stats/dashboard/", { params: { months: 12 } })).data, staleTime: 60_000 });
  const d = q.data;
  return {
    patients: d?.patients?.total, appointments: d?.appointments?.today, lab: d?.lab?.pending_requests,
    stock: d?.pharmacy?.low_stock_count, invoices: d?.billing?.unpaid_invoices,
  };
}
const COUNT_CLASS = "rounded-full bg-sunken px-2 py-0.5 text-xs font-bold text-sub num";

type Counts = { patients?: number; appointments?: number; lab?: number; stock?: number; invoices?: number };
const GROUPS: NavGroup[] = ["Navigation", "Soins médicaux", "Pharmacie & caisse", "Administration"];

function SideNav({ items, counts }: { items: NavItem[]; counts: Counts }) {
  const groups = GROUPS.map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter((x) => x.list.length);
  return (
    <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3" aria-label="Navigation principale">
      {groups.map(({ g, list }) => (
        <div key={g} className="mb-4">
          <p className="px-5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-mute">{g}</p>
          {list.map(({ to, label: l, icon: Icon, countKey }) => {
            const c = countKey ? counts[countKey] : undefined;
            return (
              <NavLink key={to} to={to} end={to === "/"}
                className={({ isActive }) => clsx("flex items-center gap-3 border-r-[3px] px-5 py-2.5 text-[15px] font-medium transition",
                  isActive ? "border-brand bg-brand/10 text-brand" : "border-transparent text-sub hover:bg-sunken hover:text-ink")}>
                <Icon className="h-[18px] w-[18px]" /><span className="flex-1">{l}</span>
                {c !== undefined && c > 0 && <span className={COUNT_CLASS}>{c}</span>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SideFoot({ name, role, avatar, onLogout }: { name: string; role?: string; avatar?: string | null; onLogout: () => void }) {
  return (
    <div className="shrink-0 space-y-2 border-t p-4">
      <NavLink to="/mon-profil" className="flex items-center gap-3 rounded-xl border bg-surface p-2.5 transition hover:border-brand/40 hover:bg-brand/5">
        {avatar ? (
          <img src={avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{initials(name) || "?"}</div>
        )}
        <div className="min-w-0 leading-tight"><p className="truncate text-sm font-bold">{name}</p><p className="text-xs text-mute">{label(role)}</p></div>
      </NavLink>
      <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-bad/10 py-2.5 text-sm font-bold text-bad hover:bg-bad/15" onClick={onLogout}><LogOut className="h-4 w-4" />Déconnexion</button>
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const q = useList<AppNotification>("notifications", { ordering: "-created_at", page_size: 10 });
  const mark = useAction("notifications");
  const unread = q.data?.results.filter((n) => !n.is_read).length ?? 0;
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button className="relative grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken" onClick={() => setOpen(!open)} aria-label="Notifications">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface" />}
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-[min(92vw,360px)] overflow-hidden shadow-xl">
          <div className="border-b px-4 py-3 text-sm font-bold">Notifications</div>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {q.data?.results.map((n) => (
              <li key={n.id}>
                <button className={clsx("w-full px-4 py-3 text-left hover:bg-sunken", !n.is_read && "bg-brand/5")}
                  onClick={() => !n.is_read && mark.mutate({ url: `${n.id}/`, method: "patch", data: { is_read: true } })}>
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="text-xs text-sub">{n.message}</p>
                  <p className="mt-1 text-[11px] text-mute">{fmtDateTime(n.created_at)}</p>
                </button>
              </li>
            ))}
            {!q.data?.results.length && <li className="p-6 text-center text-sm text-mute">Aucune notification</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { user, logout, can } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [search, setSearch] = useState("");
  const loc = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const counts = useCounts();
  useEffect(() => setOpen(false), [loc.pathname]);

  const items = NAV.filter((n) => allowed(n, user?.role));
  const name = `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || user?.username || "";
  const circuit = CIRCUIT.filter((c) => { const it = NAV.find((n) => n.to === c.to); return it && allowed(it, user?.role) && user?.role !== "CASHIER" || (c.to === "/billing" && can("RECEPTIONIST", "CASHIER")); });

  const handleLogout = async () => { await logout(); nav("/"); };

  return (
    <div className={clsx("min-h-screen lg:grid", closed ? "lg:grid-cols-[0px_1fr]" : "lg:grid-cols-[260px_1fr]")}>
      <aside className={clsx("sticky top-0 hidden h-screen flex-col overflow-hidden border-r bg-surface transition-all duration-300 lg:flex", closed ? "w-0 border-r-0 opacity-0" : "w-[260px] opacity-100")}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <Brand />
          <button className="grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sub hover:bg-sunken hover:text-ink" onClick={() => setClosed(true)} aria-label="Réduire le menu"><ChevronsLeft className="h-4 w-4" /></button>
        </div>
        <SideNav items={items} counts={counts} />
        <SideFoot name={name} role={user?.role} avatar={user?.avatar} onLogout={handleLogout} />
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={clsx("fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface shadow-xl transition-transform lg:hidden", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-4"><Brand /><button onClick={() => setOpen(false)} aria-label="Fermer le menu"><X className="h-5 w-5" /></button></div>
        <SideNav items={items} counts={counts} />
        <SideFoot name={name} role={user?.role} avatar={user?.avatar} onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b bg-surface/90 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button className={clsx("grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken", closed ? "" : "lg:hidden")} onClick={() => (closed ? setClosed(false) : setOpen(true))} aria-label={closed ? "Déplier le menu" : "Ouvrir le menu"}>
              {closed ? <ChevronsRight className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {can("RECEPTIONIST", "DOCTOR") && (
              <form className="relative hidden max-w-md flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); nav(`/patients?q=${encodeURIComponent(search)}`); }}>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input className="input h-11 rounded-full pl-11" placeholder="Rechercher un patient…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher un patient" />
              </form>
            )}
            <div className="flex-1" />
            <button className="grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken" onClick={() => qc.invalidateQueries()} aria-label="Actualiser"><RefreshCw className="h-[18px] w-[18px]" /></button>
            <button className="grid h-10 w-10 place-items-center rounded-full border bg-surface text-sub hover:bg-sunken" onClick={toggle} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <Notifications />
            <NavLink to="/mon-profil" className="hidden items-center gap-3 rounded-full border bg-surface py-1 pl-4 pr-1 transition hover:border-brand/40 hover:bg-brand/5 md:flex" aria-label="Ouvrir mon profil">
              <div className="text-right leading-tight"><p className="text-sm font-bold">{name}</p><p className="text-[11px] text-mute">{label(user?.role)}</p></div>
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">{initials(name) || "?"}</div>
              )}
            </NavLink>
          </div>
          {circuit.length > 0 && (
            <div className="hidden items-center gap-1 overflow-x-auto border-t px-6 py-2 md:flex" aria-label="Parcours du patient">
              <span className="mr-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-mute"><SlidersHorizontal className="h-3.5 w-3.5" />Circuit :</span>
              {circuit.map((c, i) => (
                <div key={c.to} className="flex items-center">
                  <NavLink to={c.to} className={({ isActive }) => clsx("whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition", isActive ? "bg-brand/12 text-brand ring-1 ring-brand/30" : "text-sub hover:bg-sunken")}>{c.label}</NavLink>
                  {i < circuit.length - 1 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-mute" />}
                </div>
              ))}
            </div>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 animate-rise p-4 sm:p-6"><Outlet /></main>
        <footer className="flex items-center justify-between border-t bg-surface px-6 py-3 text-xs text-mute">
          <span>{CENTER.name} · version {APP_VERSION}</span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-accent" />Opérationnel</span>
        </footer>
      </div>
    </div>
  );
}
