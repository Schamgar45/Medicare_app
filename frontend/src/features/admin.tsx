import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import { Badge, StatusBadge, PageHeader, DataTable, Pagination, Column } from '@/components/ui';
import { Tabs } from './common';
import { useList } from '@/lib/queries';
import { useState } from 'react';
import type { Service, Specialty, User } from '@/lib/types';
import { fmtDateTime, label, money, opts } from '@/lib/format';

const userCfg: ResourceConfig<User> = {
  path: 'auth/users',
  createPath: 'auth/register',
  title: 'Utilisateurs',
  singular: 'Utilisateur',
  writeRoles: [],
  canDelete: false,
  ordering: '-id',
  mobileTitle: (u) => `${u.first_name} ${u.last_name}`,
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
    { name: 'first_name', label: 'Prénom', type: 'text', required: true },
    { name: 'last_name', label: 'Nom', type: 'text', required: true },
    { name: 'email', label: 'Email (identifiant de connexion)', type: 'email', required: true },
    { name: 'username', label: "Nom d'utilisateur", type: 'text', required: true },
    {
      name: 'password',
      label: 'Mot de passe provisoire',
      type: 'password',
      required: true,
      createOnly: true,
      hint: '8 caractères minimum',
    },
    { name: 'phone', label: 'Téléphone', type: 'tel' },
    { name: 'gender', label: 'Genre', type: 'select', options: opts(['MASCULIN', 'FEMININ']) },
    {
      name: 'role',
      label: 'Rôle',
      type: 'select',
      required: true,
      options: opts(['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'LABORANT', 'PHARMACIST', 'CASHIER']),
    },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      required: true,
      options: opts(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
      editOnly: true,
    },
  ],
  defaults: { role: 'RECEPTIONIST', status: 'ACTIVE' },
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

interface Audit {
  id: number;
  user: number | null;
  action: string;
  table_name: string;
  record_id: number | null;
  ip_address: string | null;
  created_at: string;
}
function AuditList() {
  const [page, setPage] = useState(1);
  const q = useList<Audit>('audit', { page, ordering: '-created_at' });
  const cols: Column<Audit>[] = [
    { key: 'd', header: 'Date', render: (a) => fmtDateTime(a.created_at) },
    { key: 'a', header: 'Action', render: (a) => a.action },
    { key: 't', header: 'Table', render: (a) => a.table_name },
    { key: 'r', header: 'Élément', render: (a) => a.record_id ?? '—' },
    { key: 'i', header: 'IP', render: (a) => a.ip_address ?? '—' },
  ];
  return (
    <div className="card overflow-hidden">
      <DataTable
        columns={cols}
        rows={q.data?.results}
        loading={q.isLoading}
        error={q.isError}
        mobileTitle={(a) => a.action}
      />
      <Pagination page={page} count={q.data?.count ?? 0} size={20} onPage={setPage} />
    </div>
  );
}

export function AdminPage() {
  return (
    <>
      <PageHeader title="Administration" subtitle="Comptes, départements et journal d'audit" />
      <Tabs
        tabs={[
          {
            id: 'users',
            label: 'Utilisateurs',
            node: <ResourcePage cfg={{ ...userCfg, writeRoles: ['ADMIN'], embedded: true }} />,
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
