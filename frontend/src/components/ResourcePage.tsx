import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader, DataTable, Column, Pagination, Confirm } from './ui';
import { FormModal, FieldDef } from './FormModal';
import { useList, useSave, useRemove } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { apiError } from '@/lib/api';
import type { Role } from '@/lib/types';
import { t, useLanguage } from '@/lib/i18n';

export interface ResourceConfig<T extends { id: number }> {
  path: string;
  title: string;
  subtitle?: string;
  singular: string;
  columns: Column<T>[];
  fields: FieldDef[];
  mobileTitle?: (r: T) => ReactNode;
  writeRoles?: Role[];
  canDelete?: boolean;
  canEdit?: boolean;
  /** Masque le bouton supprimer/éditer pour une ligne donnée (ex. hiérarchie des comptes). */
  canDeleteRow?: (r: T) => boolean;
  canEditRow?: (r: T) => boolean;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  ordering?: string;
  defaults?: Record<string, any>;
  detailPath?: (r: T) => string;
  toForm?: (r: T) => Record<string, any>;
  fixedParams?: Record<string, string>;
  createLabel?: string;
  extraHeader?: ReactNode;
  rowActions?: (r: T) => ReactNode;
  createRoles?: Role[]; // par défaut : writeRoles
  fieldsFor?: (role: Role | undefined, editing: boolean) => FieldDef[];
  extraPayload?: (ctx: { doctorId?: number }, editing: boolean) => Record<string, unknown>;
  hideActions?: boolean;
  createPath?: string;
  createHint?: string;
  embedded?: boolean;
  refetchInterval?: number;
  noCreate?: boolean;
  hideCreateButton?: boolean;
  onCreated?: (r: T, go: (to: string) => void) => void;
}

export function ResourcePage<T extends { id: number }>({
  cfg,
  onCreateActionReady,
}: {
  cfg: ResourceConfig<T>;
  onCreateActionReady?: (open: (() => void) | null) => void;
}) {
  useLanguage();
  const { can, user, doctor } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(() => (cfg.embedded ? '' : (sp.get('q') ?? '')));
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);
  useEffect(() => {
    if (!cfg.embedded && sp.get('new') === '1') {
      setCreating(true);
      const n = new URLSearchParams(sp);
      n.delete('new');
      setSp(n, { replace: true });
    }
    // eslint-disable-next-line
  }, []);
  useEffect(() => {
    if (cfg.embedded) return;
    setSearch(sp.get('q') ?? '');
    setPage(1);
  }, [sp, cfg.embedded]);

  const list = useList<T>(cfg.path, {
    page,
    search,
    ordering: cfg.ordering,
    ...filters,
    ...cfg.fixedParams,
  }, true, cfg.refetchInterval);
  const save = useSave(cfg.path, cfg.createPath);
  const remove = useRemove(cfg.path);

  const canWrite = can(...(cfg.writeRoles ?? []));
  const canCreate = !cfg.noCreate && can(...(cfg.createRoles ?? cfg.writeRoles ?? []));
  const canEdit = canWrite && cfg.canEdit !== false;
  const fields = useMemo(
    () => (cfg.fieldsFor ? cfg.fieldsFor(user?.role, !!editing) : cfg.fields),
    [cfg.fields, cfg.fieldsFor, user?.role, editing],
  );
  const localizedColumns = cfg.columns.map((column) => ({ ...column, header: t(column.header) }));
  const canDelete = can() && cfg.canDelete !== false; // can() sans rôle = ADMIN seulement
  useEffect(() => {
    if (!onCreateActionReady) return;
    onCreateActionReady(canCreate ? () => setCreating(true) : null);
    return () => onCreateActionReady(null);
  }, [canCreate, onCreateActionReady]);

  const blank = useMemo(() => {
    const o: Record<string, any> = {};
    cfg.fields.forEach((f) => {
      o[f.name] =
        f.type === 'checkbox' ? (cfg.defaults?.[f.name] ?? true) : (cfg.defaults?.[f.name] ?? '');
    });
    return o;
  }, [cfg.defaults, cfg.fields]);

  const initial = useMemo(() => {
    if (editing) {
      if (cfg.toForm) return cfg.toForm(editing);
      const o: Record<string, any> = {};
      cfg.fields.forEach((f) => {
        const v = (editing as any)[f.name];
        o[f.name] = v ?? (f.type === 'checkbox' ? false : '');
      });
      return o;
    }
    return blank;
  }, [editing, blank, cfg.toForm, cfg.fields]);

  const columns = useMemo<Column<T>[]>(() => {
    if (cfg.hideActions || (!canEdit && !canDelete && !cfg.rowActions)) return localizedColumns;
    return [
      ...localizedColumns,
      {
        key: '_actions',
        header: '',
        className: 'w-28 text-right',
        render: (r: T) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {cfg.rowActions?.(r)}
            {canEdit && (!cfg.canEditRow || cfg.canEditRow(r)) && (
              <button
                className="rounded-md p-2 text-sub hover:bg-sunken"
                aria-label={t('Modifier')}
                onClick={() => setEditing(r)}
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canDelete && (!cfg.canDeleteRow || cfg.canDeleteRow(r)) && (
              <button
                className="rounded-md p-2 text-bad hover:bg-bad/10"
                aria-label={t('Supprimer')}
                onClick={() => setDeleting(r)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ];
  }, [cfg, canEdit, canDelete, localizedColumns]);

  const onSubmit = useCallback(
    async (payload: Record<string, unknown>) => {
      const r = (await save.mutateAsync({
        id: editing?.id,
        data: { ...payload, ...cfg.extraPayload?.({ doctorId: doctor?.id }, !!editing) },
      })) as T;
      toast.ok(editing ? t('Modifications enregistrées') : `${t(cfg.singular)} ${t('créé')}`);
      if (!editing && r) cfg.onCreated?.(r, nav);
    },
    [save, editing, toast, cfg.singular, cfg, doctor, nav],
  );

  const showForm = creating || !!editing;
  const size = 20;

  return (
    <>
      {(() => {
        const actions = (
          <>
            {cfg.extraHeader}
            {canCreate && !cfg.hideCreateButton && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                {t(cfg.createLabel ?? 'Nouveau')}
              </button>
            )}
          </>
        );
        return cfg.embedded ? (
          <div className="mb-3 flex flex-wrap justify-end gap-2">{actions}</div>
        ) : (
          <PageHeader title={t(cfg.title)} subtitle={cfg.subtitle ? t(cfg.subtitle) : undefined} actions={actions} />
        );
      })()}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input
              className="input pl-9"
              placeholder={t('Rechercher…')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={t('Rechercher…')}
            />
          </div>
          {cfg.filters?.map((f) => (
            <select
              key={f.name}
              className="input w-auto min-w-[140px]"
              aria-label={t(f.label)}
              value={filters[f.name] ?? ''}
              onChange={(e) => {
                setFilters({ ...filters, [f.name]: e.target.value });
                setPage(1);
              }}
            >
              <option value="">{t(f.label)}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={list.data?.results}
          loading={list.isLoading}
          error={list.isError}
          onRetry={() => list.refetch()}
          mobileTitle={cfg.mobileTitle}
          onRowClick={cfg.detailPath ? (r) => nav(cfg.detailPath!(r)) : undefined}
        />
        <Pagination page={page} count={list.data?.count ?? 0} size={size} onPage={setPage} />
      </div>

      <FormModal
        open={showForm}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={
          editing
            ? `${t('Modifier')} ${t(cfg.singular).toLowerCase()}`
            : `${t('Nouveau :')} ${t(cfg.singular).toLowerCase()}`
        }
        fields={fields}
        initial={initial}
        editing={!!editing}
        onSubmit={onSubmit}
      />
      <Confirm
        open={!!deleting}
        title={t('Supprimer cet élément ?')}
        text={t('Cette action est définitive.')}
        busy={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(deleting!.id);
            toast.ok(t('Supprimé'));
          } catch (e) {
            toast.err(apiError(e).message);
          }
          setDeleting(null);
        }}
      />
    </>
  );
}
