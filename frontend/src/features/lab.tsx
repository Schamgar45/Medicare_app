import { useState } from 'react';
import { Check, FlaskConical, Play, Printer, TestTube, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import { Badge, Column, DataTable, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { FormModal } from '@/components/FormModal';
import { CreateFromConsultation } from '@/components/CreateFromConsultation';
import { Tabs } from './common';
import { useAction, useList, useSave } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { apiError } from '@/lib/api';
import type { LabRequest, LabResult, LabTest } from '@/lib/types';
import { fmtDate, fmtDateTime, fullName, money, opts } from '@/lib/format';

const testCfg: ResourceConfig<LabTest> = {
  path: 'lab/tests',
  title: "Types d'examens",
  singular: 'Examen',
  writeRoles: ['LABORANT'],
  ordering: 'name',
  embedded: true,
  mobileTitle: (t) => t.name,
  columns: [
    {
      key: 'n',
      header: 'Examen',
      render: (t) => <span className="font-semibold">{t.name}</span>,
      hideOnMobile: true,
    },
    { key: 'r', header: 'Valeurs normales', render: (t) => t.normal_range || '—' },
    { key: 'p', header: 'Prix', render: (t) => money(t.price) },
    {
      key: 'a',
      header: 'Actif',
      render: (t) => (
        <Badge tone={t.is_active ? 'ok' : 'mute'}>{t.is_active ? 'Oui' : 'Non'}</Badge>
      ),
    },
  ],
  fields: [
    { name: 'name', label: "Nom de l'examen", type: 'text', required: true },
    { name: 'price', label: 'Prix', type: 'number', step: '0.01' },
    { name: 'normal_range', label: 'Valeurs normales', type: 'textarea' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'is_active', label: 'Actif', type: 'checkbox' },
  ],
  defaults: { is_active: true },
};

function RequestActions({ r, onResult }: { r: LabRequest; onResult: (r: LabRequest) => void }) {
  const { can, user } = useAuth();
  const act = useAction('lab/requests', ['lab/results', 'dashboard']);
  const toast = useToast();
  const step = async (status: string) => {
    try {
      await act.mutateAsync({ url: `${r.id}/`, method: 'patch', data: { status } });
      toast.ok('Statut mis à jour');
    } catch (e) {
      toast.err(apiError(e).message);
    }
  };
  const open = ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'].includes(r.status);
  const lab = can('LABORANT');
  return (
    <div className="flex justify-end gap-1">
      {lab && r.status === 'REQUESTED' && (
        <button className="btn btn-ghost btn-sm" onClick={() => step('SAMPLE_COLLECTED')}>
          <TestTube className="h-3.5 w-3.5" />
          Prélevé
        </button>
      )}
      {lab && r.status === 'SAMPLE_COLLECTED' && (
        <button className="btn btn-ghost btn-sm" onClick={() => step('IN_PROGRESS')}>
          <Play className="h-3.5 w-3.5" />
          Démarrer
        </button>
      )}
      {lab && open && (
        <button className="btn btn-primary btn-sm" onClick={() => onResult(r)}>
          <FlaskConical className="h-3.5 w-3.5" />
          Résultat
        </button>
      )}
      {(lab || user?.role === 'DOCTOR') && open && (
        <button
          className="rounded-md p-1.5 text-bad hover:bg-bad/10"
          aria-label="Annuler la demande"
          onClick={() => step('CANCELLED')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Requests() {
  const [target, setTarget] = useState<LabRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const { can } = useAuth();
  const toast = useToast();
  const create = useSave<LabRequest>('lab/requests');
  const addResult = useSave<LabResult>('lab/results');
  const qc = useQueryClient();
  const cfg: ResourceConfig<LabRequest> = {
    path: 'lab/requests',
    title: 'Demandes',
    singular: 'Demande',
    writeRoles: [],
    canEdit: false,
    canDelete: false,
    noCreate: true,
    ordering: '-requested_at',
    embedded: true,
    mobileTitle: (r) => `${r.lab_test_detail?.name} · ${fullName(r.patient_detail)}`,
    filters: [
      {
        name: 'status',
        label: 'Tous les statuts',
        options: opts([
          'REQUESTED',
          'SAMPLE_COLLECTED',
          'IN_PROGRESS',
          'RESULT_AVAILABLE',
          'VALIDATED',
          'CANCELLED',
        ]),
      },
      {
        name: 'priority',
        label: 'Toutes priorités',
        options: opts(['NORMAL', 'URGENT', 'CRITICAL']),
      },
    ],
    extraHeader: can('DOCTOR') ? (
      <button className="btn btn-primary" onClick={() => setCreating(true)}>
        Nouvelle demande
      </button>
    ) : undefined,
    columns: [
      {
        key: 'n',
        header: 'Demande',
        render: (r) => <span className="font-mono text-xs">{r.request_number}</span>,
      },
      {
        key: 'p',
        header: 'Patient',
        render: (r) => <span className="font-semibold">{fullName(r.patient_detail)}</span>,
        hideOnMobile: true,
      },
      { key: 'e', header: 'Examen', render: (r) => r.lab_test_detail?.name },
      { key: 'pr', header: 'Priorité', render: (r) => <StatusBadge value={r.priority} /> },
      {
        key: 'd',
        header: 'Dates',
        render: (r) => (
          <span className="text-xs text-sub">
            Demandé {fmtDate(r.requested_at)}
            {r.sample_collected_at && (
              <>
                <br />
                Prélevé {fmtDate(r.sample_collected_at)}
              </>
            )}
            {r.completed_at && (
              <>
                <br />
                Validé {fmtDate(r.completed_at)}
              </>
            )}
          </span>
        ),
      },
      { key: 's', header: 'Statut', render: (r) => <StatusBadge value={r.status} /> },
    ],
    fields: [],
    rowActions: (r) => <RequestActions r={r} onResult={setTarget} />,
  };
  return (
    <>
      <ResourcePage cfg={cfg} />
      <FormModal
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Saisir le résultat · ${target?.lab_test_detail?.name ?? ''}`}
        editing={false}
        wide={false}
        fields={[
          {
            name: 'result',
            label: 'Résultat',
            type: 'textarea',
            required: true,
            hint: target?.lab_test_detail?.normal_range
              ? `Valeurs normales : ${target.lab_test_detail.normal_range}`
              : undefined,
          },
          { name: 'comment', label: 'Commentaire', type: 'textarea' },
        ]}
        initial={{ result: '', comment: '' }}
        onSubmit={async (p) => {
          await addResult.mutateAsync({ data: { ...p, lab_request: target!.id } });
          qc.invalidateQueries({ queryKey: ['lab/requests'] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
          toast.ok('Résultat enregistré. Pensez à le valider.');
        }}
      />
      <CreateFromConsultation
        open={creating}
        onClose={() => setCreating(false)}
        title="Nouvelle demande d'examen"
        extraFields={[
          {
            name: 'lab_test',
            label: 'Examen',
            type: 'relation',
            required: true,
            relation: {
              path: 'lab/tests',
              label: (t: LabTest) => t.name,
              params: { is_active: true },
            },
          },
          {
            name: 'priority',
            label: 'Priorité',
            type: 'select',
            required: true,
            options: opts(['NORMAL', 'URGENT', 'CRITICAL']),
          },
          { name: 'clinical_information', label: 'Renseignements cliniques', type: 'textarea' },
        ]}
        initial={{ priority: 'NORMAL' }}
        onCreate={async (p) => {
          await create.mutateAsync({ data: p });
          toast.ok('Demande envoyée au laboratoire');
        }}
      />
    </>
  );
}

function Results() {
  const { can } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const q = useList<LabResult>('lab/results', {
    page,
    ordering: '-result_date',
    lab_request__status: status,
  });
  const validate = useAction('lab/results', ['lab/requests', 'notifications']);
  const cols: Column<LabResult>[] = [
    {
      key: 'n',
      header: 'Demande',
      render: (r) => <span className="font-mono text-xs">{r.request_detail?.request_number}</span>,
    },
    {
      key: 'p',
      header: 'Patient',
      render: (r) => (
        <span className="font-semibold">{fullName(r.request_detail?.patient_detail)}</span>
      ),
      hideOnMobile: true,
    },
    { key: 'e', header: 'Examen', render: (r) => r.request_detail?.lab_test_detail?.name },
    {
      key: 'r',
      header: 'Résultat',
      render: (r) => <span className="line-clamp-1 max-w-xs">{r.result}</span>,
    },
    { key: 'd', header: 'Saisi le', render: (r) => fmtDateTime(r.result_date) },
    {
      key: 'v',
      header: 'Validation',
      render: (r) =>
        r.validated_at ? (
          <span className="text-xs text-sub">
            {fmtDateTime(r.validated_at)}
            <br />
            par {r.validated_by_name}
          </span>
        ) : (
          <Badge tone="warn">À valider</Badge>
        ),
    },
    {
      key: 'a',
      header: '',
      className: 'text-right',
      render: (r) =>
        r.validated_at ? (
          <Link to={`/print/lab/${r.id}`} className="btn btn-ghost btn-sm">
            <Printer className="h-3.5 w-3.5" />
            Imprimer
          </Link>
        ) : can('LABORANT') ? (
          <button
            className="btn btn-accent btn-sm"
            disabled={validate.isPending}
            onClick={async () => {
              try {
                await validate.mutateAsync({ url: `${r.id}/validate/` });
                toast.ok('Résultat validé. Le médecin est prévenu.');
              } catch (e) {
                toast.err(apiError(e).message);
              }
            }}
          >
            <Check className="h-3.5 w-3.5" />
            Valider
          </button>
        ) : null,
    },
  ];
  return (
    <div className="card overflow-hidden">
      <div className="border-b p-3">
        <select
          className="input w-auto min-w-[180px]"
          aria-label="Statut"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les résultats</option>
          <option value="RESULT_AVAILABLE">À valider</option>
          <option value="VALIDATED">Validés</option>
        </select>
      </div>
      <DataTable
        columns={cols}
        rows={q.data?.results}
        loading={q.isLoading}
        error={q.isError}
        onRetry={() => q.refetch()}
        mobileTitle={(r) => r.request_detail?.lab_test_detail?.name}
      />
      <Pagination page={page} count={q.data?.count ?? 0} size={20} onPage={setPage} />
    </div>
  );
}

export function LabPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Laboratoire"
        subtitle="Les résultats peuvent arriver des jours après la demande : suivez chaque étape."
      />
      <Tabs
        tabs={[
          { id: 'req', label: 'Demandes', node: <Requests /> },
          { id: 'res', label: 'Résultats', node: <Results /> },
          ...(can('LABORANT', 'DOCTOR')
            ? [{ id: 'tests', label: "Types d'examens", node: <ResourcePage cfg={testCfg} /> }]
            : []),
        ]}
      />
    </>
  );
}
