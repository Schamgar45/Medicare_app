import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Printer } from 'lucide-react';
import { ResourcePage, ResourceConfig } from '@/components/ResourcePage';
import {
  Badge,
  Column,
  DataTable,
  InfoGrid,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { useList, useOne } from '@/lib/queries';
import type { Appointment, Consultation, Doctor, Invoice, LabRequest, Patient } from '@/lib/types';
import { ageOf, fmtDate, fmtDateTime, fmtTime, fullName, label, money, opts } from '@/lib/format';
import { t, useLanguage } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { patientRel, doctorRel, serviceRel, specialtyRel, Tabs } from './common';

const APPT_STATUS = [
  'SCHEDULED',
  'CONFIRMED',
  'WAITING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

/* ---------------- Patients ---------------- */
const patientCfg: ResourceConfig<Patient> = {
  path: 'patients',
  title: 'Patients',
  subtitle: 'Dossiers des patients',
  singular: 'Patient',
  writeRoles: ['RECEPTIONIST', 'DOCTOR'],
  createRoles: ['RECEPTIONIST'],
  canDelete: true,
  ordering: '-id',
  detailPath: (p) => `/patients/${p.id}`,
  mobileTitle: (p) => fullName(p),
  filters: [
    {
      name: 'status',
      label: 'Tous les statuts',
      options: opts(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
    },
  ],
  columns: [
    {
      key: 'n',
      header: 'N°',
      render: (p) => <span className="font-mono text-xs">{p.patient_number}</span>,
    },
    {
      key: 'name',
      header: 'Nom',
      render: (p) => <span className="font-semibold">{fullName(p)}</span>,
      hideOnMobile: true,
    },
    {
      key: 'age',
      header: 'Âge',
      render: (p) => (p.date_of_birth ? `${ageOf(p.date_of_birth)} ans` : '—'),
    },
    { key: 'g', header: 'Sexe', render: (p) => label(p.gender) },
    { key: 'tel', header: 'Téléphone', render: (p) => p.phone || '—' },
    { key: 'st', header: 'Statut', render: (p) => <StatusBadge value={p.status} /> },
  ],
  fields: [
    { name: 'first_name', label: 'Prénom', type: 'text', required: true, formStep: 'Identité' },
    { name: 'last_name', label: 'Nom', type: 'text', required: true, formStep: 'Identité' },
    {
      name: 'gender',
      label: 'Sexe',
      type: 'select',
      required: true,
      options: opts(['MALE', 'FEMALE', 'OTHER']),
      formStep: 'Identité',
    },
    {
      name: 'date_of_birth',
      label: 'Date de naissance',
      type: 'date',
      required: true,
      maxToday: true,
      formStep: 'Identité',
    },
    {
      name: 'phone',
      label: 'Téléphone',
      type: 'tel',
      placeholder: '+25779987654',
      hint: 'Format international, ex. +25779987654',
      formStep: 'Coordonnées',
    },
    { name: 'email', label: 'Email', type: 'email', formStep: 'Coordonnées' },
    { name: 'address', label: 'Adresse', type: 'textarea', formStep: 'Coordonnées' },
    {
      name: 'blood_group',
      label: 'Groupe sanguin',
      type: 'select',
      emptyLabel: 'Non spécifié',
      options: opts(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
      formStep: 'Informations médicales',
    },
    { name: 'allergies', label: 'Allergies', type: 'textarea', formStep: 'Informations médicales' },
    { name: 'emergency_contact_name', label: "Contact d'urgence", type: 'text', formStep: 'Contact d’urgence' },
    {
      name: 'emergency_contact_phone',
      label: 'Téléphone du contact',
      type: 'tel',
      placeholder: '+25779987654',
      hint: 'Format international, ex. +25779987654',
      formStep: 'Contact d’urgence',
    },
    { name: 'emergency_contact_relationship', label: 'Lien avec le patient', type: 'text', formStep: 'Contact d’urgence' },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      required: true,
      options: opts(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
      editOnly: true,
      formStep: 'Contact d’urgence',
    },
  ],
  defaults: { status: 'ACTIVE' },
};
export const PatientsPage = () => {
  useLanguage();
  return <ResourcePage cfg={patientCfg} />;
};

export function PatientDetailPage() {
  useLanguage();
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const p = useOne<Patient>('patients', id);
  const appts = useList<Appointment>(
    'appointments',
    { patient: id, ordering: '-appointment_date', page_size: 10 },
    can('RECEPTIONIST', 'DOCTOR'),
  );
  const cons = useList<Consultation>(
    'consultations',
    { patient: id, ordering: '-consultation_date', page_size: 10 },
    can('DOCTOR'),
  );
  const labs = useList<LabRequest>(
    'lab/requests',
    { patient: id, page_size: 10 },
    can('DOCTOR', 'LABORANT'),
  );
  const invs = useList<Invoice>(
    'invoices',
    { patient: id, ordering: '-invoice_date', page_size: 10 },
    can('RECEPTIONIST', 'CASHIER'),
  );
  const hist = useList<{
    id: number;
    title: string;
    description: string;
    diagnosed_date: string | null;
  }>('medical-history', { patient: id }, can('DOCTOR'));

  if (p.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  if (!p.data) return <div className="card p-10 text-center text-sub">{t('Patient introuvable.')}</div>;
  const d = p.data;

  const apptCols: Column<Appointment>[] = [
    {
      key: 'd',
      header: 'Date',
      render: (a) => `${fmtDate(a.appointment_date)} ${fmtTime(a.appointment_time)}`,
    },
    { key: 'm', header: 'Médecin', render: (a) => a.doctor_detail?.name },
    { key: 's', header: 'Statut', render: (a) => <StatusBadge value={a.status} /> },
  ];
  const consCols: Column<Consultation>[] = [
    { key: 'd', header: 'Date', render: (c) => fmtDateTime(c.consultation_date) },
    { key: 'm', header: 'Médecin', render: (c) => c.doctor_detail?.name },
    { key: 'dg', header: 'Diagnostic', render: (c) => c.diagnosis || '—' },
  ];
  const labCols: Column<LabRequest>[] = [
    { key: 'e', header: 'Examen', render: (l) => l.lab_test_detail?.name },
    { key: 'd', header: 'Demandé le', render: (l) => fmtDate(l.requested_at) },
    { key: 's', header: 'Statut', render: (l) => <StatusBadge value={l.status} /> },
  ];
  const invCols: Column<Invoice>[] = [
    {
      key: 'n',
      header: 'Facture',
      render: (i) => (
        <Link
          className="font-mono text-xs text-brand hover:underline"
          to={`/billing/invoices/${i.id}`}
        >
          {i.invoice_number}
        </Link>
      ),
    },
    { key: 't', header: 'Total', render: (i) => money(i.total) },
    { key: 's', header: 'Statut', render: (i) => <StatusBadge value={i.status} /> },
  ];

  const tabs = [
    {
      id: 'info',
      label: 'Informations',
      node: (
        <div className="card space-y-6 p-5">
          <InfoGrid
            items={[
              ['Numéro', d.patient_number],
              ['Sexe', label(d.gender)],
              [
                'Naissance',
                d.date_of_birth
                  ? `${fmtDate(d.date_of_birth)} (${ageOf(d.date_of_birth)} ans)`
                  : '',
              ],
              ['Téléphone', d.phone],
              ['Email', d.email],
              ['Groupe sanguin', d.blood_group],
              ['Adresse', d.address],
              ['Allergies', d.allergies ? <Badge tone="bad">{d.allergies}</Badge> : ''],
              [
                "Contact d'urgence",
                [
                  d.emergency_contact_name,
                  d.emergency_contact_phone,
                  d.emergency_contact_relationship && `(${d.emergency_contact_relationship})`,
                ]
                  .filter(Boolean)
                  .join(' '),
              ],
            ]}
          />
          {can('DOCTOR') && (
            <div>
              <h3 className="mb-2 text-sm font-bold">{t('Antécédents')}</h3>
              {hist.data?.results.length ? (
                <ul className="space-y-2">
                  {hist.data.results.map((h) => (
                    <li key={h.id} className="rounded-lg bg-sunken p-3 text-sm">
                      <p className="font-semibold">
                        {h.title}{' '}
                        <span className="font-normal text-mute">{fmtDate(h.diagnosed_date)}</span>
                      </p>
                      <p className="text-sub">{h.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mute">{t('Aucun antécédent enregistré.')}</p>
              )}
            </div>
          )}
        </div>
      ),
    },
    ...(can('RECEPTIONIST', 'DOCTOR')
      ? [
          {
            id: 'rdv',
            label: 'Rendez-vous',
            node: (
              <div className="card">
                <DataTable
                  columns={apptCols}
                  rows={appts.data?.results}
                  loading={appts.isLoading}
                />
              </div>
            ),
          },
        ]
      : []),
    ...(can('DOCTOR')
      ? [
          {
            id: 'cons',
            label: 'Consultations',
            node: (
              <div className="card">
                <DataTable columns={consCols} rows={cons.data?.results} loading={cons.isLoading} />
              </div>
            ),
          },
        ]
      : []),
    ...(can('DOCTOR', 'LABORANT')
      ? [
          {
            id: 'lab',
            label: 'Examens',
            node: (
              <div className="card">
                <DataTable columns={labCols} rows={labs.data?.results} loading={labs.isLoading} />
              </div>
            ),
          },
        ]
      : []),
    ...(can('RECEPTIONIST', 'CASHIER')
      ? [
          {
            id: 'inv',
            label: 'Factures',
            node: (
              <div className="card">
                <DataTable columns={invCols} rows={invs.data?.results} loading={invs.isLoading} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-sub hover:text-ink"
        onClick={() => nav(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>
      <PageHeader
        title={fullName(d)}
        subtitle={`${d.patient_number}${d.date_of_birth ? ` · ${ageOf(d.date_of_birth)} ans` : ''}`}
        actions={
          <>
            <StatusBadge value={d.status} />
            <Link className="btn btn-ghost btn-sm" to={`/print/patient/${d.id}`}>
              <Printer className="h-4 w-4" />
              Bandeau dossier
            </Link>
          </>
        }
      />
      <Tabs tabs={tabs} />
    </>
  );
}

/* ---------------- Médecins ---------------- */
const doctorCfg: ResourceConfig<Doctor> = {
  path: 'doctors',
  title: 'Médecins',
  subtitle: 'Équipe médicale',
  singular: 'Médecin',
  writeRoles: [],
  ordering: '-id',
  mobileTitle: (d) => d.name,
  columns: [
    {
      key: 'n',
      header: 'Nom',
      render: (d) => <span className="font-semibold">{d.name}</span>,
      hideOnMobile: true,
    },
    { key: 'sp', header: 'Spécialité', render: (d) => d.specialty_name || '—' },
    { key: 'sv', header: 'Département', render: (d) => d.service_detail?.name || '—' },
    { key: 'reg', header: "N° d'ordre", render: (d) => d.registration_number || '—' },
    { key: 'fee', header: 'Consultation', render: (d) => money(d.consultation_fee) },
    {
      key: 'av',
      header: 'Disponible',
      render: (d) => (
        <Badge tone={d.is_available ? 'ok' : 'mute'}>{d.is_available ? 'Oui' : 'Non'}</Badge>
      ),
    },
  ],
  fields: [
    {
      name: 'user',
      label: 'Compte utilisateur (rôle Médecin)',
      type: 'relation',
      required: true,
      createOnly: true,
      full: true,
      relation: {
        path: 'auth/users',
        label: (u) => `${u.first_name} ${u.last_name} · ${u.email}`,
        params: { role: 'DOCTOR' },
      },
      formStep: 'Identité et compte',
    },
    { name: 'specialty', label: 'Spécialité', type: 'relation', relation: specialtyRel, formStep: 'Profil professionnel' },
    { name: 'service', label: 'Département', type: 'relation', relation: serviceRel, formStep: 'Profil professionnel' },
    { name: 'registration_number', label: "N° d'ordre", type: 'text', formStep: 'Profil professionnel' },
    { name: 'consultation_fee', label: 'Tarif de consultation', type: 'number', step: '0.01', formStep: 'Profil professionnel' },
    { name: 'is_available', label: 'Disponible', type: 'checkbox', formStep: 'Profil professionnel' },
  ],
};
export const DoctorsPage = () => {
  useLanguage();
  return <ResourcePage cfg={{ ...doctorCfg, writeRoles: ['ADMIN'] }} />;
};

/* ---------------- Rendez-vous ---------------- */
const apptFields = (role?: string) => {
  const all = [
    {
      name: 'patient',
      label: 'Patient',
      type: 'relation' as const,
      required: true,
      relation: patientRel,
      full: true,
      formStep: 'Patient et équipe',
    },
    {
      name: 'doctor',
      label: 'Médecin',
      type: 'relation' as const,
      required: true,
      relation: doctorRel,
      formStep: 'Patient et équipe',
    },
    { name: 'service', label: 'Département', type: 'relation' as const, relation: serviceRel, formStep: 'Patient et équipe' },
    { name: 'appointment_date', label: 'Date', type: 'date' as const, required: true, formStep: 'Horaire' },
    { name: 'appointment_time', label: 'Heure', type: 'time' as const, required: true, formStep: 'Horaire' },
    { name: 'reason', label: 'Motif', type: 'textarea' as const, formStep: 'Détails du rendez-vous' },
    {
      name: 'status',
      label: 'Statut',
      type: 'select' as const,
      required: true,
      options: opts(APPT_STATUS),
      formStep: 'Détails du rendez-vous',
    },
    { name: 'notes', label: 'Notes', type: 'textarea' as const, formStep: 'Détails du rendez-vous' },
  ];
  // Un médecin ne modifie que le statut et les notes d'un rendez-vous.
  return role === 'DOCTOR' ? all.filter((f) => f.name === 'status' || f.name === 'notes') : all;
};
const apptCfg: ResourceConfig<Appointment> = {
  path: 'appointments',
  title: 'Rendez-vous',
  subtitle: 'Planning des consultations',
  singular: 'Rendez-vous',
  writeRoles: ['RECEPTIONIST', 'DOCTOR'],
  createRoles: ['RECEPTIONIST'],
  canDelete: true,
  ordering: '-appointment_date,-appointment_time',
  mobileTitle: (a) => fullName(a.patient_detail),
  filters: [{ name: 'status', label: 'Tous les statuts', options: opts(APPT_STATUS) }],
  columns: [
    {
      key: 'd',
      header: 'Date',
      render: (a) => (
        <span className="font-semibold">
          {fmtDate(a.appointment_date)} · {fmtTime(a.appointment_time)}
        </span>
      ),
    },
    { key: 'p', header: 'Patient', render: (a) => fullName(a.patient_detail), hideOnMobile: true },
    { key: 'm', header: 'Médecin', render: (a) => a.doctor_detail?.name },
    { key: 's', header: 'Département', render: (a) => a.service_detail?.name || '—' },
    {
      key: 'r',
      header: 'Motif',
      render: (a) => <span className="line-clamp-1">{a.reason || '—'}</span>,
    },
    { key: 'st', header: 'Statut', render: (a) => <StatusBadge value={a.status} /> },
  ],
  fields: apptFields() as any,
  fieldsFor: (role) => apptFields(role) as any,
  defaults: { status: 'SCHEDULED' },
  toForm: (a) => ({
    patient: a.patient,
    doctor: a.doctor,
    service: a.service,
    appointment_date: a.appointment_date,
    appointment_time: a.appointment_time?.slice(0, 5),
    reason: a.reason,
    status: a.status,
    notes: a.notes,
  }),
};
export const AppointmentsPage = () => {
  useLanguage();
  return <ResourcePage cfg={apptCfg} />;
};

/* ---------------- Consultations ---------------- */
const consCfg: ResourceConfig<Consultation> = {
  path: 'consultations',
  title: 'Consultations',
  subtitle: 'Dossiers de consultation',
  singular: 'Consultation',
  writeRoles: ['DOCTOR'],
  canDelete: true,
  ordering: '-consultation_date',
  mobileTitle: (c) => fullName(c.patient_detail),
  filters: [
    {
      name: 'status',
      label: 'Tous les statuts',
      options: opts(['OPEN', 'COMPLETED', 'CANCELLED']),
    },
  ],
  extraPayload: ({ doctorId }, editing) => (!editing && doctorId ? { doctor: doctorId } : {}),
  columns: [
    {
      key: 'd',
      header: 'Date',
      render: (c) => <span className="font-semibold">{fmtDateTime(c.consultation_date)}</span>,
    },
    { key: 'p', header: 'Patient', render: (c) => fullName(c.patient_detail), hideOnMobile: true },
    { key: 'm', header: 'Médecin', render: (c) => c.doctor_detail?.name },
    {
      key: 'dg',
      header: 'Diagnostic',
      render: (c) => <span className="line-clamp-1">{c.diagnosis || '—'}</span>,
    },
    { key: 'st', header: 'Statut', render: (c) => <StatusBadge value={c.status} /> },
    {
      key: 'pr',
      header: '',
      render: (c) => (
        <Link
          to={`/print/consultation/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-brand"
          aria-label={t('Imprimer le compte rendu')}
        >
          <FileText className="h-4 w-4" />
        </Link>
      ),
      className: 'w-10',
    },
  ],
  fieldsFor: (role) => {
    const base = consCfg.fields;
    return role === 'DOCTOR'
      ? base
      : [
          {
            name: 'doctor',
            label: 'Médecin',
            type: 'relation' as const,
            required: true,
            relation: doctorRel,
            createOnly: true,
          },
          ...base,
        ];
  },
  fields: [
    {
      name: 'patient',
      label: 'Patient',
      type: 'relation',
      required: true,
      relation: patientRel,
      full: true,
      formStep: 'Patient et motif',
    },
    {
      name: 'appointment',
      label: 'Rendez-vous lié',
      type: 'relation',
      relation: {
        path: 'appointments',
        label: (a) => `${a.appointment_number} · ${fmtDate(a.appointment_date)}`,
      },
      formStep: 'Patient et motif',
    },
    { name: 'reason', label: 'Motif de consultation', type: 'textarea', formStep: 'Patient et motif' },
    { name: 'symptoms', label: 'Symptômes', type: 'textarea', formStep: 'Évaluation clinique' },
    { name: 'temperature', label: 'Température (°C)', type: 'number', step: '0.1', formStep: 'Évaluation clinique' },
    { name: 'weight', label: 'Poids (kg)', type: 'number', step: '0.1', formStep: 'Évaluation clinique' },
    { name: 'height', label: 'Taille (cm)', type: 'number', step: '0.1', formStep: 'Évaluation clinique' },
    { name: 'blood_pressure', label: 'Tension artérielle', type: 'text', placeholder: '120/80', formStep: 'Évaluation clinique' },
    { name: 'heart_rate', label: 'Pouls (bpm)', type: 'number', formStep: 'Évaluation clinique' },
    { name: 'diagnosis', label: 'Diagnostic', type: 'textarea', formStep: 'Diagnostic et soins' },
    { name: 'observations', label: 'Observations', type: 'textarea', formStep: 'Diagnostic et soins' },
    { name: 'treatment_plan', label: 'Plan de traitement', type: 'textarea', formStep: 'Diagnostic et soins' },
    {
      name: 'status',
      label: 'Statut',
      type: 'select',
      required: true,
      options: opts(['OPEN', 'COMPLETED', 'CANCELLED']),
      formStep: 'Diagnostic et soins',
    },
  ],
  defaults: { status: 'OPEN' },
  toForm: (c) => ({
    patient: c.patient,
    appointment: c.appointment,
    reason: c.reason,
    symptoms: c.symptoms,
    temperature: c.temperature ?? '',
    weight: c.weight ?? '',
    height: c.height ?? '',
    blood_pressure: c.blood_pressure,
    heart_rate: c.heart_rate ?? '',
    diagnosis: c.diagnosis,
    observations: c.observations,
    treatment_plan: c.treatment_plan,
    status: c.status,
  }),
};
export const ConsultationsPage = () => {
  useLanguage();
  return <ResourcePage cfg={consCfg} />;
};
