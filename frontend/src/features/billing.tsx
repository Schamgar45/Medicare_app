import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Plus, Printer, Trash2 } from 'lucide-react';
import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import {
  Badge,
  Column,
  Confirm,
  DataTable,
  InfoGrid,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { useOne, useRemove, useSave } from '@/lib/queries';
import type { BillingItem, Invoice, InvoiceItem, Payment } from '@/lib/types';
import { fmtDate, fmtDateTime, fullName, money, opts } from '@/lib/format';
import { Tabs, patientRel, serviceRel } from './common';

const STAFF = ['RECEPTIONIST', 'CASHIER'] as const;
const PAY_METHODS = ['CASH', 'MOBILE_MONEY', 'BANK', 'CARD', 'INSURANCE'];

const invoiceCfg: ResourceConfig<Invoice> = {
  path: 'invoices',
  title: 'Factures',
  singular: 'Facture',
  writeRoles: [...STAFF],
  canEdit: false,
  canDelete: true,
  ordering: '-invoice_date',
  embedded: true,
  detailPath: (i) => `/billing/invoices/${i.id}`,
  mobileTitle: (i) => `${i.invoice_number} · ${fullName(i.patient_detail)}`,
  filters: [
    {
      name: 'status',
      label: 'Tous les statuts',
      options: opts(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']),
    },
  ],
  createLabel: 'Nouvelle facture',
  columns: [
    {
      key: 'n',
      header: 'Facture',
      render: (i) => <span className="font-mono text-xs">{i.invoice_number}</span>,
    },
    {
      key: 'p',
      header: 'Patient',
      render: (i) => <span className="font-semibold">{fullName(i.patient_detail)}</span>,
      hideOnMobile: true,
    },
    { key: 's', header: 'Département', render: (i) => i.service_detail?.name || '—' },
    { key: 'd', header: 'Date', render: (i) => fmtDate(i.invoice_date) },
    {
      key: 't',
      header: 'Total',
      render: (i) => <span className="tabular-nums">{money(i.total)}</span>,
    },
    {
      key: 'b',
      header: 'Reste',
      render: (i) => <span className="tabular-nums">{money(i.balance)}</span>,
    },
    { key: 'st', header: 'Statut', render: (i) => <StatusBadge value={i.status} /> },
  ],
  fields: [
    {
      name: 'patient',
      label: 'Patient',
      type: 'relation',
      required: true,
      relation: patientRel,
      full: true,
    },
    {
      name: 'service',
      label: "Département (d'où vient le service)",
      type: 'relation',
      relation: serviceRel,
      full: true,
      hint: 'Détermine le cachet et la couleur de la facture imprimée.',
    },
    { name: 'discount', label: 'Remise', type: 'number', step: '0.01' },
  ],
};

const paymentCfg: ResourceConfig<Payment> = {
  path: 'payments',
  title: 'Paiements',
  singular: 'Paiement',
  writeRoles: [],
  noCreate: true,
  canEdit: false,
  canDelete: true,
  ordering: '-payment_date',
  embedded: true,
  mobileTitle: (p) => `${p.payment_number} · ${fullName(p.patient_detail)}`,
  filters: [{ name: 'payment_method', label: 'Tous les modes', options: opts(PAY_METHODS) }],
  columns: [
    {
      key: 'n',
      header: 'Paiement',
      render: (p) => <span className="font-mono text-xs">{p.payment_number}</span>,
    },
    {
      key: 'p',
      header: 'Patient',
      render: (p) => <span className="font-semibold">{fullName(p.patient_detail)}</span>,
      hideOnMobile: true,
    },
    { key: 'f', header: 'Facture', render: (p) => p.invoice_number },
    {
      key: 'a',
      header: 'Montant',
      render: (p) => <span className="tabular-nums">{money(p.amount)}</span>,
    },
    { key: 'm', header: 'Mode', render: (p) => <StatusBadge value={p.payment_method} /> },
    { key: 'd', header: 'Date', render: (p) => fmtDateTime(p.payment_date) },
    {
      key: 'r',
      header: '',
      render: (p) => (
        <Link
          to={`/print/receipt/${p.id}`}
          className="text-brand"
          aria-label="Imprimer le reçu"
          onClick={(e) => e.stopPropagation()}
        >
          <Printer className="h-4 w-4" />
        </Link>
      ),
      className: 'w-10',
    },
  ],
  fields: [],
};

const itemCfg: ResourceConfig<BillingItem> = {
  path: 'billing-items',
  title: 'Actes facturables',
  singular: 'Acte',
  writeRoles: ['ADMIN'],
  ordering: 'name',
  embedded: true,
  mobileTitle: (b) => b.name,
  columns: [
    {
      key: 'n',
      header: 'Acte',
      render: (b) => <span className="font-semibold">{b.name}</span>,
      hideOnMobile: true,
    },
    { key: 'c', header: 'Catégorie', render: (b) => b.category || '—' },
    { key: 'p', header: 'Prix', render: (b) => money(b.price) },
    {
      key: 'a',
      header: 'Actif',
      render: (b) => (
        <Badge tone={b.is_active ? 'ok' : 'mute'}>{b.is_active ? 'Oui' : 'Non'}</Badge>
      ),
    },
  ],
  fields: [
    { name: 'name', label: 'Nom', type: 'text', required: true },
    { name: 'category', label: 'Catégorie', type: 'text' },
    { name: 'price', label: 'Prix', type: 'number', step: '0.01', required: true },
    { name: 'is_active', label: 'Actif', type: 'checkbox' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ],
  defaults: { is_active: true },
};

export function BillingPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="Facturation" subtitle="Factures, paiements et reçus" />
      <Tabs
        tabs={[
          { id: 'inv', label: 'Factures', node: <ResourcePage cfg={invoiceCfg} /> },
          { id: 'pay', label: 'Paiements', node: <ResourcePage cfg={paymentCfg} /> },
          ...(can(...STAFF)
            ? [{ id: 'items', label: 'Actes facturables', node: <ResourcePage cfg={itemCfg} /> }]
            : []),
        ]}
      />
    </>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const q = useOne<Invoice>('invoices', id);
  const [payList, setPayList] = useState<Payment[] | null>(null);
  const [addItem, setAddItem] = useState(false);
  const [pay, setPay] = useState(false);
  const [del, setDel] = useState<InvoiceItem | null>(null);
  const saveItem = useSave('invoice-items');
  const removeItem = useRemove('invoice-items');
  const savePay = useSave('payments');

  const loadPayments = async () => {
    const r = await api.get('/payments/', { params: { invoice: id, ordering: '-payment_date' } });
    setPayList(r.data.results);
  };
  useEffect(() => {
    loadPayments().catch(() => setPayList([])); /* eslint-disable-next-line */
  }, [id]);
  const refresh = async () => {
    await q.refetch();
    await loadPayments();
  };

  if (q.isLoading) return <Skeleton className="h-64" />;
  const inv = q.data;
  if (!inv) return <div className="card p-10 text-center text-sub">Facture introuvable.</div>;
  const canEdit = can(...STAFF) && inv.status !== 'CANCELLED';

  const itemCols: Column<InvoiceItem>[] = [
    { key: 'd', header: 'Désignation', render: (i) => i.description },
    { key: 'q', header: 'Qté', render: (i) => i.quantity },
    { key: 'u', header: 'Prix unitaire', render: (i) => money(i.unit_price) },
    {
      key: 't',
      header: 'Total',
      render: (i) => <span className="font-semibold tabular-nums">{money(i.total)}</span>,
    },
    ...(canEdit
      ? [
          {
            key: 'x',
            header: '',
            className: 'w-10',
            render: (i: InvoiceItem) => (
              <button className="p-1.5 text-bad" aria-label="Retirer" onClick={() => setDel(i)}>
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]
      : []),
  ];
  const payCols: Column<Payment>[] = [
    {
      key: 'n',
      header: 'Paiement',
      render: (p) => <span className="font-mono text-xs">{p.payment_number}</span>,
    },
    { key: 'd', header: 'Date', render: (p) => fmtDateTime(p.payment_date) },
    { key: 'm', header: 'Mode', render: (p) => <StatusBadge value={p.payment_method} /> },
    {
      key: 'a',
      header: 'Montant',
      render: (p) => <span className="font-semibold tabular-nums">{money(p.amount)}</span>,
    },
    {
      key: 'r',
      header: '',
      className: 'w-24 text-right',
      render: (p) => (
        <Link to={`/print/receipt/${p.id}`} className="btn btn-ghost btn-sm">
          <Printer className="h-3.5 w-3.5" />
          Reçu
        </Link>
      ),
    },
  ];

  return (
    <>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink"
        onClick={() => nav('/billing')}
      >
        <ArrowLeft className="h-4 w-4" />
        Factures
      </button>
      <PageHeader
        title={`Facture ${inv.invoice_number}`}
        subtitle={`${fullName(inv.patient_detail)} · ${fmtDate(inv.invoice_date)}`}
        actions={
          <>
            <StatusBadge value={inv.status} />
            <Link className="btn btn-ghost" to={`/print/invoice/${inv.id}`}>
              <Printer className="h-4 w-4" />
              Imprimer
            </Link>
            {canEdit && inv.status !== 'PAID' && (
              <button className="btn btn-accent" onClick={() => setPay(true)}>
                <CreditCard className="h-4 w-4" />
                Encaisser
              </button>
            )}
          </>
        }
      />
      <div className="space-y-5">
        <div className="card p-5">
          <InfoGrid
            items={[
              ['Patient', fullName(inv.patient_detail)],
              ['Département', inv.service_detail?.name],
              ['Sous-total', money(inv.subtotal)],
              ['Remise', money(inv.discount)],
              ['Total', <b key="t">{money(inv.total)}</b>],
              ['Déjà payé', money(inv.amount_paid)],
              [
                'Reste à payer',
                <b key="b" className={Number(inv.balance) > 0 ? 'text-bad' : 'text-ok'}>
                  {money(inv.balance)}
                </b>,
              ],
            ]}
          />
        </div>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">Lignes de la facture</h2>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={() => setAddItem(true)}>
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            )}
          </div>
          <DataTable columns={itemCols} rows={inv.items} />
        </section>
        <section className="card overflow-hidden">
          <div className="border-b p-4">
            <h2 className="font-bold">Paiements</h2>
          </div>
          <DataTable
            columns={payCols}
            rows={payList ?? []}
            loading={payList === null}
            empty={<p className="p-6 text-center text-sm text-mute">Aucun paiement enregistré.</p>}
          />
        </section>
      </div>

      <FormModal
        open={addItem}
        onClose={() => setAddItem(false)}
        title="Ajouter une ligne"
        editing={false}
        wide={false}
        fields={[
          {
            name: 'billing_item',
            label: 'Acte facturable (optionnel)',
            type: 'relation',
            full: true,
            relation: {
              path: 'billing-items',
              label: (b: BillingItem) => `${b.name} · ${money(b.price)}`,
              params: { is_active: true },
            },
            hint: 'Choisir un acte remplit la désignation et le prix.',
          },
          { name: 'description', label: 'Désignation', type: 'text', full: true },
          { name: 'quantity', label: 'Quantité', type: 'number', required: true },
          { name: 'unit_price', label: 'Prix unitaire', type: 'number', step: '0.01' },
        ]}
        initial={{ billing_item: '', description: '', quantity: 1, unit_price: '' }}
        onSubmit={async (p) => {
          let { description, unit_price } = p as { description: string; unit_price: number | null };
          if (p.billing_item && (!description || unit_price === null)) {
            const b = (await api.get<BillingItem>(`/billing-items/${p.billing_item}/`)).data;
            description = description || b.name;
            unit_price = unit_price ?? Number(b.price);
          }
          if (!description)
            throw Object.assign(new Error('x'), {
              response: {
                status: 400,
                data: { description: ['Indiquez une désignation ou un acte.'] },
              },
            });
          await saveItem.mutateAsync({
            data: { ...p, description, unit_price: unit_price ?? 0, invoice: inv.id },
          });
          await refresh();
          toast.ok('Ligne ajoutée');
        }}
      />
      <FormModal
        open={pay}
        onClose={() => setPay(false)}
        title="Encaisser un paiement"
        editing={false}
        wide={false}
        fields={[
          {
            name: 'amount',
            label: `Montant (reste ${money(inv.balance)})`,
            type: 'number',
            step: '0.01',
            required: true,
          },
          {
            name: 'payment_method',
            label: 'Mode de paiement',
            type: 'select',
            required: true,
            options: opts(PAY_METHODS),
          },
          { name: 'reference', label: 'Référence (n° de transaction…)', type: 'text' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ]}
        initial={{
          amount: Number(inv.balance) || '',
          payment_method: 'CASH',
          reference: '',
          notes: '',
        }}
        onSubmit={async (p) => {
          const r = (await savePay.mutateAsync({ data: { ...p, invoice: inv.id } })) as Payment;
          await refresh();
          toast.ok('Paiement enregistré');
          nav(`/print/receipt/${r.id}`);
        }}
      />
      <Confirm
        open={!!del}
        title="Retirer cette ligne ?"
        text={del?.description ?? ''}
        busy={removeItem.isPending}
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          try {
            await removeItem.mutateAsync(del!.id);
            await refresh();
          } catch (e) {
            toast.err(apiError(e).message);
          }
          setDel(null);
        }}
      />
    </>
  );
}
