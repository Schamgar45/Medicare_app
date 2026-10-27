import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import type { FieldDef } from '@/components/FormModal';
import { Badge, StatusBadge, PageHeader, DataTable, Pagination, Column } from '@/components/ui';
import { Tabs } from './common';
import { useList, useAction } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { apiError } from '@/lib/api';
import { Ban, Plus, Power } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Role, Service, Specialty, User } from '@/lib/types';
import { fmtDateTime, label, money, opts } from '@/lib/format';

// Seul le superuser (createsuperuser) peut créer/promouvoir un ADMIN.
const ALL_ROLES: Role[] = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LABORANT', 'PHARMACIST', 'CASHIER'];
const STAFF_ROLES: Role[] = ALL_ROLES.filter((r) => r !== 'ADMIN');

/** Désactiver / réactiver un compte (bouton par ligne, règles gérées côté backend). */
function UserActions({ u }: { u: User }) {
  const { user, canManage } = useAuth();
  const toast = useToast();
  const act = useAction('auth/users', ['dashboard']);
  const isSelf = u.id === user?.id;
  const active = u.status === 'ACTIVE';
  const toggle = async () => {
    try {
      await act.mutateAsync({ url: `${u.id}/${active ? 'deactivate' : 'activate'}/` });
      toast.ok(active ? 'Compte désactivé' : 'Compte réactivé');
    } catch (e) {
      toast.err(apiError(e).message);
    }
  };
  // Aucune action sur son propre compte, ni sur un compte non gérable
  // (superuser ou autre ADMIN) : le backend refuserait de toute façon.
  if (isSelf || !canManage(u)) return null;
  return active ? (
    <button
      className="rounded-md p-2 text-bad hover:bg-bad/10"
      title="Désactiver le compte"
      aria-label="Désactiver"
      onClick={toggle}
    >
      <Ban className="h-4 w-4" />
    </button>
  ) : (
    <button
      className="rounded-md p-2 text-ok hover:bg-ok/10"
      title="Réactiver le compte"
      aria-label="Réactiver"
      onClick={toggle}
    >
      <Power className="h-4 w-4" />
    </button>
  );
}

const userCfg: ResourceConfig<User> = {
  path: 'auth/users',
  createPath: 'auth/register',
  title: 'Utilisateurs',
  singular: 'Utilisateur',
  writeRoles: [],
  canDelete: true,
  ordering: '-id',
  mobileTitle: (u) => `${u.first_name} ${u.last_name}`,
  rowActions: (u) => <UserActions u={u} />,
  filters: [
    {
      name: 'role',
      label: 'Tous les rôles',
      options: opts(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LABORANT', 'PHARMACIST', 'CASHIER']),
    },
  ],
  columns: [
    {
      key: 'n',
      header: 'Nom',
      render: (u) => (
        <span className="font-semibold">
          {u.first_name} {u.last_name}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: 'e', header: 'Email', render: (u) => u.email },
    { key: 'r', header: 'Rôle', render: (u) => <Badge tone="info">{label(u.role)}</Badge> },
    { key: 's', header: 'Statut', render: (u) => <StatusBadge value={u.status} /> },
  ],
  fields: [
    { name: 'first_name', label: 'Prénom', type: 'text', required: true, formStep: 'Identité' },
    { name: 'last_name', label: 'Nom', type: 'text', required: true, formStep: 'Identité' },
    { name: 'email', label: 'Email (identifiant de connexion)', type: 'email', required: true, formStep: 'Compte' },
    { name: 'username', label: "Nom d'utilisateur", type: 'text', required: true, formStep: 'Compte' },
    {
      name: 'password',
      label: 'Mot de passe provisoire',
      type: 'password',
      required: true,
      createOnly: true,
      hint: '8 caractères minimum',
      formStep: 'Compte',
    },
    {
      name: 'phone',
      label: 'Téléphone',
      type: 'tel',
      placeholder: '+25779987654',
      hint: 'Format international, ex. +25779987654',
      formStep: 'Profil et accès',
    },
    {
      name: 'gender',
      label: 'Genre',
      type: 'select',
      required: true,
      options: opts(['MASCULIN', 'FEMININ']),
      formStep: 'Identité',
    },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      required: true,
      options: opts(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LABORANT', 'PHARMACIST', 'CASHIER']),
      formStep: 'Profil et accès',
    },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      required: true,
      options: opts(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
      editOnly: true,
      formStep: 'Profil et accès',
    },
  ],
  defaults: { role: 'RECEPTIONIST', status: 'ACTIVE', gender: 'MASCULIN' },
  toForm: (u) => ({
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    username: u.username,
    phone: u.phone ?? '',
    gender: u.gender ?? '',
    role: u.role,
    status: u.status,
  }),
};

const serviceCfg: ResourceConfig<Service> = {
  path: 'services',
  title: 'Départements',
  singular: 'Département',
  writeRoles: ['ADMIN'],
  ordering: 'name',
  mobileTitle: (s) => s.name,
  columns: [
    {
      key: 'n',
      header: 'Nom',
      render: (s) => <span className="font-semibold">{s.name}</span>,
      hideOnMobile: true,
    },
    {
      key: 'c',
      header: 'Couleur du cachet',
      render: (s) => (
        <span className="inline-flex items-center gap-2">
          <i
            className="h-3 w-3 rounded-full"
            style={{ background: s.theme_color === 'VERT' ? '#2FA45B' : '#0C3C7A' }}
          />
          {label(s.theme_color)}
        </span>
      ),
    },
    { key: 'p', header: 'Tarif', render: (s) => money(s.price) },
    {
      key: 'a',
      header: 'Actif',
      render: (s) => (
        <Badge tone={s.is_active ? 'ok' : 'mute'}>{s.is_active ? 'Oui' : 'Non'}</Badge>
      ),
    },
  ],
  fields: [
    { name: 'name', label: 'Nom du département', type: 'text', required: true },
    {
      name: 'theme_color',
      label: 'Couleur du cachet',
      type: 'select',
      required: true,
      options: opts(['MARINE', 'VERT']),
    },
    { name: 'price', label: 'Tarif', type: 'number', step: '0.01' },
    { name: 'is_active', label: 'Actif', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  defaults: { theme_color: 'MARINE', is_active: true },
};

const specialtyCfg: ResourceConfig<Specialty> = {
  path: 'specialties',
  title: 'Spécialités',
  singular: 'Spécialité',
  writeRoles: ['ADMIN'],
  ordering: 'name',
  mobileTitle: (s) => s.name,
  columns: [
    {
      key: 'n',
      header: 'Nom',
      render: (s) => <span className="font-semibold">{s.name}</span>,
      hideOnMobile: true,
    },
    { key: 'd', header: 'Description', render: (s) => s.description || '—' },
  ],
  fields: [
    { name: 'name', label: 'Nom', type: 'text', required: true },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
};

interface AuditChange {
  field: string;
  old: string | null;
  new: string | null;
}
interface Audit {
  id: number;
  actor: string;
  action: string;
  action_label: string;
  target_label: string;
  changes: AuditChange[];
  ip_address: string | null;
  created_at: string;
}
const AUDIT_FILTERS = [
  { value: '', label: 'Toutes les actions' },
  { value: 'CREATE', label: 'Création' },
  { value: 'UPDATE', label: 'Modification' },
  { value: 'PROMOTE', label: 'Promotion' },
  { value: 'DEMOTE', label: 'Rétrogradation' },
  { value: 'DEACTIVATE', label: 'Désactivation' },
  { value: 'ACTIVATE', label: 'Réactivation' },
  { value: 'SUSPEND', label: 'Suspension' },
  { value: 'DELETE', label: 'Suppression' },
];
function AuditList() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const q = useList<Audit>('audit', { page, ordering: '-created_at', action });
  const cols: Column<Audit>[] = [
    { key: 'd', header: 'Date', render: (a) => fmtDateTime(a.created_at) },
    {
      key: 'a',
      header: 'Journal',
      render: (a) => (
        <span>
          <span className="font-semibold">{a.actor}</span> {a.action_label} {a.target_label}
        </span>
      ),
    },
    {
      key: 'c',
      header: 'Détails',
      render: (a) =>
        a.changes.length
          ? a.changes.map((c) => `${c.field} : ${label(c.old)} → ${label(c.new)}`).join(' · ')
          : '—',
      hideOnMobile: true,
    },
    { key: 'i', header: 'IP', render: (a) => a.ip_address ?? '—' },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="border-b p-3">
        <select
          className="input w-auto min-w-[180px]"
          aria-label="Filtrer par action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          {AUDIT_FILTERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={cols}
        rows={q.data?.results}
        loading={q.isLoading}
        error={q.isError}
        mobileTitle={(a) => `${a.actor} ${a.action_label}`}
      />
      <Pagination page={page} count={q.data?.count ?? 0} size={20} onPage={setPage} />
    </div>
  );
}

export function AdminPage() {
  const { user, isSuperuser, canManage } = useAuth();
  const [openCreateUser, setOpenCreateUser] = useState<(() => void) | null>(null);
  const registerCreateUser = useCallback(
    (open: (() => void) | null) => setOpenCreateUser(() => open),
    [],
  );
  // Seul le superuser peut attribuer le rôle ADMIN ; un ADMIN classique crée/édite
  // uniquement les profils staff (doctor, réception, labo, pharmacie, caisse).
  const roleOptions = opts(isSuperuser ? ALL_ROLES : STAFF_ROLES);
  const userFields: FieldDef[] = userCfg.fields.map((f) =>
    f.name === 'role' ? { ...f, options: roleOptions } : f,
  );
  return (
    <>
      <PageHeader title="Administration" subtitle="Comptes, départements et journal d'audit" />
      <Tabs
        actions={(activeTabId) =>
          activeTabId === 'users' && openCreateUser ? (
            <button className="btn btn-primary" onClick={openCreateUser}>
              <Plus className="h-4 w-4" />
              Nouvel utilisateur
            </button>
          ) : null
        }
        tabs={[
          {
            id: 'users',
            label: 'Utilisateurs',
            node: (
              <ResourcePage
                cfg={{
                  ...userCfg,
                  writeRoles: ['ADMIN'],
                  embedded: true,
                  fields: userFields,
                  hideCreateButton: true,
                  canEditRow: (u) => canManage(u),
                  canDeleteRow: (u) => canManage(u) && u.id !== user?.id,
                }}
                onCreateActionReady={registerCreateUser}
              />
            ),
          },
          {
            id: 'services',
            label: 'Départements',
            node: <ResourcePage cfg={{ ...serviceCfg, embedded: true }} />,
          },
          {
            id: 'spec',
            label: 'Spécialités',
            node: <ResourcePage cfg={{ ...specialtyCfg, embedded: true }} />,
          },
          { id: 'audit', label: "Journal d'audit", node: <AuditList /> },
        ]}
      />
    </>
  );
}
