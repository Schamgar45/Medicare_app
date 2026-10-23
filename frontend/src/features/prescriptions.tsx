import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Printer, Trash2 } from 'lucide-react';
import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import { Column, DataTable, InfoGrid, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { CreateFromConsultation } from '@/components/CreateFromConsultation';
import { useAction, useOne, useRemove, useSave } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { apiError } from '@/lib/api';
import type { Prescription, PrescriptionItem } from '@/lib/types';
import { fmtDate, fullName, opts } from '@/lib/format';
import { medicationRel } from './common';

const STATUSES = ['DRAFT', 'VALIDATED', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED'];

export function PrescriptionsPage() {
  const [creating, setCreating] = useState(false);
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const create = useSave<Prescription>('prescriptions');
  const cfg: ResourceConfig<Prescription> = {
    path: 'prescriptions',
    title: 'Ordonnances',
    subtitle: 'Prescriptions et délivrance',
    singular: 'Ordonnance',
    writeRoles: [],
    noCreate: true,
    canEdit: false,
    canDelete: true,
    ordering: '-prescription_date',
    detailPath: (p) => `/prescriptions/${p.id}`,
    mobileTitle: (p) => `${p.prescription_number} · ${fullName(p.patient_detail)}`,
    filters: [{ name: 'status', label: 'Tous les statuts', options: opts(STATUSES) }],
    extraHeader: can('DOCTOR') ? (
      <button className="btn btn-primary" onClick={() => setCreating(true)}>
        <Plus className="h-4 w-4" />
        Nouvelle ordonnance
      </button>
    ) : undefined,
    columns: [
      {
        key: 'n',
        header: 'N°',
        render: (p) => <span className="font-mono text-xs">{p.prescription_number}</span>,
      },
      {
        key: 'p',
        header: 'Patient',
        render: (p) => <span className="font-semibold">{fullName(p.patient_detail)}</span>,
        hideOnMobile: true,
      },
      { key: 'm', header: 'Médecin', render: (p) => p.doctor_detail?.name },
      { key: 'd', header: 'Date', render: (p) => fmtDate(p.prescription_date) },
      { key: 'i', header: 'Médicaments', render: (p) => p.items.length },
      { key: 's', header: 'Statut', render: (p) => <StatusBadge value={p.status} /> },
    ],
    fields: [],
  };
  return (
    <>
      <ResourcePage cfg={cfg} />
      <CreateFromConsultation
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouvelle ordonnance"
        extraFields={[
          { name: 'instructions', label: 'Instructions générales', type: 'textarea' },
          {
            name: 'status',
            label: 'Statut',
            type: 'select',
            required: true,
            options: opts(['DRAFT', 'VALIDATED']),
          },
        ]}
        initial={{ status: 'DRAFT' }}
        onCreate={async (p) => {
          const r = await create.mutateAsync({ data: p });
          toast.ok('Ordonnance créée : ajoutez les médicaments');
          nav(`/prescriptions/${r.id}`);
        }}
      />
    </>
  );
}

export function PrescriptionDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const q = useOne<Prescription>('prescriptions', id);
  const [adding, setAdding] = useState(false);
  const saveItem = useSave('prescription-items');
  const removeItem = useRemove('prescription-items');
  const setStatus = useAction('prescriptions');

  if (q.isLoading) return <Skeleton className="h-64" />;
  const rx = q.data;
  if (!rx) return <div className="card p-10 text-center text-sub">Ordonnance introuvable.</div>;
  const editable = can('DOCTOR') && ['DRAFT', 'VALIDATED'].includes(rx.status);

  const change = async (status: string) => {
    try {
      await setStatus.mutateAsync({ url: `${rx.id}/`, method: 'patch', data: { status } });
      await q.refetch();
      toast.ok('Statut mis à jour');
    } catch (e) {
      toast.err(apiError(e).message);
    }
  };
  const cols: Column<PrescriptionItem>[] = [
    {
      key: 'm',
      header: 'Médicament',
      render: (i) => <span className="font-semibold">{i.medication_name}</span>,
    },
    { key: 'd', header: 'Dosage', render: (i) => i.dosage || '—' },
    { key: 'f', header: 'Fréquence', render: (i) => i.frequency || '—' },
    { key: 'du', header: 'Durée', render: (i) => i.duration || '—' },
    { key: 'q', header: 'Qté', render: (i) => i.quantity ?? '—' },
    { key: 'dis', header: 'Délivré', render: (i) => i.dispensed_quantity },
    ...(editable
      ? [
          {
            key: 'x',
            header: '',
            className: 'w-10',
            render: (i: PrescriptionItem) => (
              <button
                className="p-1.5 text-bad"
                aria-label="Retirer"
                onClick={async () => {
                  try {
                    await removeItem.mutateAsync(i.id);
                    await q.refetch();
                  } catch (e) {
                    toast.err(apiError(e).message);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink"
        onClick={() => nav('/prescriptions')}
      >
        <ArrowLeft className="h-4 w-4" />
        Ordonnances
      </button>
      <PageHeader
        title={`Ordonnance ${rx.prescription_number}`}
        subtitle={`${fullName(rx.patient_detail)} · ${fmtDate(rx.prescription_date)}`}
        actions={
          <>
            <StatusBadge value={rx.status} />
            <Link to={`/print/prescription/${rx.id}`} className="btn btn-ghost">
              <Printer className="h-4 w-4" />
              Imprimer
            </Link>
          </>
        }
      />
      <div className="space-y-5">
        <div className="card space-y-4 p-5">
          <InfoGrid
            items={[
              ['Patient', fullName(rx.patient_detail)],
              ['Médecin', rx.doctor_detail?.name],
              ['Département', rx.doctor_detail?.service_detail?.name],
              ['Instructions', rx.instructions],
            ]}
          />
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {can('DOCTOR') && rx.status === 'DRAFT' && (
              <button className="btn btn-primary btn-sm" onClick={() => change('VALIDATED')}>
                Valider l'ordonnance
              </button>
            )}
            {can('DOCTOR') && ['DRAFT', 'VALIDATED'].includes(rx.status) && (
              <button className="btn btn-ghost btn-sm" onClick={() => change('CANCELLED')}>
                Annuler
              </button>
            )}
            {can('PHARMACIST') && ['VALIDATED', 'PARTIALLY_DISPENSED'].includes(rx.status) && (
              <>
                <button className="btn btn-accent btn-sm" onClick={() => change('DISPENSED')}>
                  Marquer comme délivrée
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => change('PARTIALLY_DISPENSED')}
                >
                  Partiellement délivrée
                </button>
              </>
            )}
          </div>
        </div>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-bold">Médicaments prescrits</h2>
            {editable && (
              <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" />
                Ajouter
              </button>
            )}
          </div>
          <DataTable
            columns={cols}
            rows={rx.items}
            empty={
              <p className="p-6 text-center text-sm text-mute">Aucun médicament pour l'instant.</p>
            }
          />
        </section>
      </div>
      <FormModal
        open={adding}
        onClose={() => setAdding(false)}
        title="Ajouter un médicament"
        editing={false}
        wide={false}
        fields={[
          {
            name: 'medication',
            label: 'Médicament',
            type: 'relation',
            required: true,
            relation: medicationRel,
            full: true,
          },
          { name: 'dosage', label: 'Dosage', type: 'text', placeholder: '1 comprimé' },
          { name: 'frequency', label: 'Fréquence', type: 'text', placeholder: '3 fois par jour' },
          { name: 'duration', label: 'Durée', type: 'text', placeholder: '5 jours' },
          { name: 'quantity', label: 'Quantité', type: 'number' },
          { name: 'instructions', label: 'Instructions', type: 'textarea' },
        ]}
        initial={{
          medication: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: '',
          instructions: '',
        }}
        onSubmit={async (p) => {
          await saveItem.mutateAsync({ data: { ...p, prescription: rx.id } });
          await q.refetch();
          toast.ok('Médicament ajouté');
        }}
      />
    </>
  );
}
