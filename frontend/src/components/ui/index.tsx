import { ReactNode, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { initials, label } from '@/lib/format';
import { t } from '@/lib/i18n';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={clsx('skeleton', className)} aria-hidden />
);
export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={clsx('h-4 w-4 animate-spin', className)} />
);

const TONES: Record<string, string> = {
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/12 text-bad',
  info: 'bg-brand/12 text-brand',
  mute: 'bg-sunken text-sub',
};
export const Badge = ({
  tone = 'mute',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      TONES[tone],
    )}
  >
    {children}
  </span>
);

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  ACTIVE: 'ok',
  COMPLETED: 'ok',
  PAID: 'ok',
  DISPENSED: 'ok',
  VALIDATED: 'ok',
  CONFIRMED: 'info',
  SCHEDULED: 'info',
  OPEN: 'info',
  REQUESTED: 'info',
  WAITING: 'warn',
  IN_PROGRESS: 'warn',
  PENDING: 'warn',
  PARTIALLY_PAID: 'warn',
  PARTIALLY_DISPENSED: 'warn',
  SAMPLE_COLLECTED: 'warn',
  RESULT_AVAILABLE: 'info',
  URGENT: 'warn',
  CANCELLED: 'bad',
  NO_SHOW: 'bad',
  UNPAID: 'bad',
  SUSPENDED: 'bad',
  CRITICAL: 'bad',
  EXPIRED: 'bad',
  INACTIVE: 'mute',
  ARCHIVED: 'mute',
  DRAFT: 'mute',
  NORMAL: 'mute',
};
export const StatusBadge = ({ value }: { value?: string | null }) => (
  <Badge tone={STATUS_TONE[value ?? ''] ?? 'mute'}>{t(label(value))}</Badge>
);

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-2xl">{t(title)}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-sub">{t(subtitle)}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={clsx(
        'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy text-xs font-bold text-white ring-2 ring-brand/15',
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}

export function EmptyState({ title = 'Rien à afficher', hint }: { title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-sunken text-mute">
        <Inbox className="h-6 w-6" />
      </div>
      <p className="font-semibold">{t(title)}</p>
      {hint && <p className="max-w-sm text-sm text-sub">{t(hint)}</p>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="font-semibold">{t('Impossible de charger les données')}</p>
      <p className="text-sm text-sub">{t('Vérifiez la connexion puis réessayez.')}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          {t('Réessayer')}
        </button>
      )}
    </div>
  );
}

export function Field({
  label: l,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-sub">
        {t(l)}
        {required && <span className="text-bad"> *</span>}
      </label>
      <div id={id}>{children}</div>
      {hint && !error && <p className="text-xs text-mute">{t(hint)}</p>}
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4 print:hidden"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          'card flex max-h-[92vh] w-full animate-rise flex-col rounded-b-none sm:rounded-b-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-xl',
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('Fermer')}
            className="rounded-md p-1 text-sub hover:bg-sunken"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  open,
  title,
  text,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            {t('Annuler')}
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />}{t('Confirmer')}
          </button>
        </>
      }
    >
      <p className="text-sm text-sub">{t(text)}</p>
    </Modal>
  );
}

export function Pagination({
  page,
  count,
  size,
  onPage,
}: {
  page: number;
  count: number;
  size: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / size));
  if (count <= size) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-sub">
      <span>{count} {t('résultats')}</span>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('Page précédente')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('Page suivante')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id: number }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  onRowClick,
  empty,
  mobileTitle,
}: {
  columns: Column<T>[];
  rows?: T[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  mobileTitle?: (r: T) => ReactNode;
}) {
  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-label={t('Chargement')}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  if (!rows?.length) return <>{empty ?? <EmptyState />}</>;
  return (
    <>
      {/* Mobile : cartes */}
      <ul className="divide-y md:hidden">
        {rows.map((r) => (
          <li
            key={r.id}
            onClick={() => onRowClick?.(r)}
            className={clsx('space-y-1.5 p-4', onRowClick && 'cursor-pointer active:bg-sunken')}
          >
            {mobileTitle && <div className="font-semibold">{mobileTitle(r)}</div>}
            {columns
              .filter((c) => !c.hideOnMobile)
              .map((c) => (
                <div key={c.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-sub">{t(c.header)}</span>
                  <span className="text-right">{c.render(r)}</span>
                </div>
              ))}
          </li>
        ))}
      </ul>
      {/* Bureau : tableau */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b bg-sunken/50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="th">
                  {t(c.header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick?.(r)}
                className={clsx(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-sunken/60',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('td', c.className)}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const STAT_TONE = {
  brand: 'bg-brand/10 text-brand',
  accent: 'bg-accent/10 text-accent',
  warn: 'bg-warn/10 text-warn',
  bad: 'bg-bad/10 text-bad',
};
export function Stat({
  icon,
  label: l,
  value,
  hint,
  tone = 'brand',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'brand' | 'accent' | 'warn' | 'bad';
}) {
  return (
    <div className="card flex min-h-[106px] flex-col justify-between gap-2 p-3 sm:p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-sub">{t(l)}</p>
        <div
          className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-md', STAT_TONE[tone])}
        >
          {icon}
        </div>
      </div>
      <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="truncate text-[10px] text-sub">{t(hint)}</p>}
    </div>
  );
}

export function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-sub">{t(k)}</dt>
          <dd className="mt-0.5 text-sm">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
