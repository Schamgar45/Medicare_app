import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import { Badge, PageHeader, StatusBadge } from '@/components/ui';
import type { Medication, MedicationBatch, StockMovement } from '@/lib/types';
import { fmtDate, fmtDateTime, money, num, opts } from '@/lib/format';
import { t, useLanguage } from '@/lib/i18n';
import { Tabs, medicationRel } from './common';

const medCfg: ResourceConfig<Medication> = {
  path: 'medications',
  title: 'Médicaments',
  singular: 'Médicament',
  writeRoles: ['PHARMACIST'],
  ordering: 'name',
  embedded: true,
  mobileTitle: (m) => m.name,
  filters: [
    {
      name: 'low_stock',
      label: 'Tout le stock',
      options: [{ value: 'true', label: 'Stock bas uniquement' }],
    },
  ],
  columns: [
    {
      key: 'n',
      header: 'Nom',
      render: (m) => <span className="font-semibold">{m.name}</span>,
      hideOnMobile: true,
    },
    {
      key: 'f',
      header: 'Forme / dosage',
      render: (m) => [m.form, m.dosage].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 's',
      header: 'Stock',
      render: (m) => (
        <span className="tabular-nums">
          {num(m.current_stock)} {m.unit}
        </span>
      ),
    },
    {
      key: 'l',
      header: 'Alerte',
      render: (m) =>
        m.is_low_stock ? <Badge tone="warn">{t('Stock bas')}</Badge> : <Badge tone="ok">OK</Badge>,
    },
    { key: 'p', header: 'Prix', render: (m) => money(m.unit_price) },
  ],
  fields: [
    { name: 'name', label: 'Nom', type: 'text', required: true, formStep: 'Identification' },
    { name: 'generic_name', label: 'Nom générique', type: 'text', formStep: 'Identification' },
    { name: 'form', label: 'Forme', type: 'text', placeholder: 'Comprimé, sirop…', formStep: 'Identification' },
    { name: 'dosage', label: 'Dosage', type: 'text', placeholder: '500 mg', formStep: 'Identification' },
    { name: 'manufacturer', label: 'Fabricant', type: 'text', formStep: 'Détails du produit' },
    { name: 'unit', label: 'Unité', type: 'text', placeholder: 'boîte', formStep: 'Détails du produit' },
    { name: 'minimum_stock', label: 'Seuil de stock bas', type: 'number', formStep: 'Stock et prix' },
    { name: 'unit_price', label: 'Prix unitaire', type: 'number', step: '0.01', formStep: 'Stock et prix' },
    { name: 'is_active', label: 'Actif', type: 'checkbox', formStep: 'Stock et prix' },
  ],
  defaults: { is_active: true, minimum_stock: 0 },
};

const batchCfg: ResourceConfig<MedicationBatch> = {
  path: 'medication-batches',
  title: 'Lots',
  singular: 'Lot',
  writeRoles: ['PHARMACIST'],
  ordering: 'expiration_date',
  embedded: true,
  mobileTitle: (b) => b.medication_name,
  columns: [
    {
      key: 'm',
      header: 'Médicament',
      render: (b) => <span className="font-semibold">{b.medication_name}</span>,
      hideOnMobile: true,
    },
    {
      key: 'b',
      header: 'N° de lot',
      render: (b) => <span className="font-mono text-xs">{b.batch_number}</span>,
    },
    {
      key: 'e',
      header: 'Péremption',
      render: (b) => {
        const exp = new Date(b.expiration_date) < new Date();
        return (
          <span className={exp ? 'font-semibold text-bad' : ''}>
            {fmtDate(b.expiration_date)}
            {exp && ' · périmé'}
          </span>
        );
      },
    },
    { key: 'q', header: 'Quantité', render: (b) => num(b.quantity) },
    { key: 'pp', header: "Prix d'achat", render: (b) => money(b.purchase_price) },
  ],
  fields: [
    {
      name: 'medication',
      label: 'Médicament',
      type: 'relation',
      required: true,
      relation: medicationRel,
      full: true,
    },
    { name: 'batch_number', label: 'N° de lot', type: 'text', required: true },
    { name: 'expiration_date', label: 'Date de péremption', type: 'date', required: true },
    { name: 'quantity', label: 'Quantité', type: 'number', required: true },
    { name: 'purchase_price', label: "Prix d'achat", type: 'number', step: '0.01' },
  ],
};

const moveCfg: ResourceConfig<StockMovement> = {
  path: 'stock-movements',
  title: 'Mouvements',
  singular: 'Mouvement',
  writeRoles: ['PHARMACIST'],
  canEdit: false,
  canDelete: false,
  ordering: '-movement_date',
  embedded: true,
  mobileTitle: (m) => m.medication_name,
  filters: [
    {
      name: 'movement_type',
      label: 'Tous les types',
      options: opts(['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'EXPIRED', 'DAMAGED']),
    },
  ],
  columns: [
    { key: 'd', header: 'Date', render: (m) => fmtDateTime(m.movement_date) },
    {
      key: 'm',
      header: 'Médicament',
      render: (m) => <span className="font-semibold">{m.medication_name}</span>,
      hideOnMobile: true,
    },
    { key: 't', header: 'Type', render: (m) => <StatusBadge value={m.movement_type} /> },
    { key: 'q', header: 'Quantité', render: (m) => num(m.quantity) },
    { key: 'r', header: 'Motif', render: (m) => m.reason || m.reference || '—' },
  ],
  fields: [
    {
      name: 'medication',
      label: 'Médicament',
      type: 'relation',
      required: true,
      relation: medicationRel,
      full: true,
    },
    {
      name: 'batch',
      label: 'Lot',
      type: 'relation',
      relation: {
        path: 'medication-batches',
        label: (b) => `${b.batch_number} · ${b.medication_name}`,
      },
    },
    {
      name: 'movement_type',
      label: 'Type',
      type: 'select',
      required: true,
      options: opts(['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'EXPIRED', 'DAMAGED']),
    },
    { name: 'quantity', label: 'Quantité', type: 'number', required: true },
    { name: 'reason', label: 'Motif', type: 'text' },
    { name: 'reference', label: 'Référence', type: 'text' },
  ],
  defaults: { movement_type: 'IN' },
};

export function PharmacyPage() {
  useLanguage();
  return (
    <>
      <PageHeader title="Pharmacie" subtitle="Médicaments, lots et mouvements de stock" />
      <Tabs
        tabs={[
          { id: 'med', label: 'Médicaments', node: <ResourcePage cfg={medCfg} /> },
          { id: 'batch', label: 'Lots', node: <ResourcePage cfg={batchCfg} /> },
          { id: 'move', label: 'Mouvements', node: <ResourcePage cfg={moveCfg} /> },
        ]}
      />
    </>
  );
}
