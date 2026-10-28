import { Line, Sheet, SheetSize } from './Sheet';
import { CENTER } from '@/lib/center';
import {
  ageOf,
  fmtDate,
  fmtDateTime,
  fmtTime,
  fullName,
  inWords,
  label,
  money,
  num,
} from '@/lib/format';
import type {
  Consultation,
  Invoice,
  LabResult,
  Patient,
  Payment,
  PatientBrief,
  Prescription,
  ServiceBrief,
} from '@/lib/types';
import { t } from '@/lib/i18n';

export interface DocDef {
  size: SheetSize;
  node: (opts: { sheetSize?: SheetSize }) => JSX.Element;
}
const col = (s?: ServiceBrief | null) => s?.theme_color ?? 'MARINE';
const sex = (p?: PatientBrief | null) => (p?.gender ? label(p.gender) : '');
const ageTxt = (p?: PatientBrief | null) =>
  p?.date_of_birth ? `${ageOf(p.date_of_birth)} ${t('ans')}` : '';

/* ----- Facture : A5 paysage, A4 portrait si beaucoup de lignes ----- */
export function invoiceDoc(inv: Invoice): DocDef {
  const size: SheetSize = inv.items.length > 6 ? 'A4P' : 'A5L';
  return {
    size,
    node: () => (
      <Sheet
        size={size}
        color={col(inv.service_detail)}
        title="Facture"
        number={inv.invoice_number}
        date={fmtDate(inv.invoice_date)}
        stampName={inv.service_detail?.name}
        signature={t('Cachet et signature')}
      >
        <div className="grid grid-cols-2 gap-x-[6mm]">
          <Line k="Patient">{fullName(inv.patient_detail)}</Line>
          <Line k="N° dossier">{inv.patient_detail?.patient_number}</Line>
          {inv.service_detail && <Line k="Département">{inv.service_detail.name}</Line>}
          {inv.patient_detail?.phone && <Line k="Téléphone">{inv.patient_detail.phone}</Line>}
        </div>
        <table className="mt-[3mm] w-full border-collapse" style={{ fontSize: 'inherit' }}>
          <thead>
            <tr className="border-b-[0.4mm] border-[#0C3C7A] text-left text-[#51647A]">
              <th className="py-[1mm]">{t('Désignation')}</th>
              <th className="w-[12mm] text-right">{t('Qté')}</th>
              <th className="w-[28mm] text-right">{t('Prix unitaire')}</th>
              <th className="w-[30mm] text-right">{t('Total')}</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((i) => (
              <tr key={i.id} className="border-b border-[#dfe7f1]">
                <td className="py-[0.9mm]">{i.description}</td>
                <td className="text-right">{i.quantity}</td>
                <td className="text-right">{num(i.unit_price)}</td>
                <td className="text-right font-semibold">{num(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-[2mm] w-[70mm]">
          {Number(inv.discount) > 0 && (
            <div className="flex justify-between text-[#51647A]">
              <span>{t('Remise')}</span>
              <span>- {money(inv.discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t-[0.4mm] border-[#0C3C7A] pt-[1mm] text-[1.1em] font-extrabold">
            <span>{t('TOTAL')}</span>
            <span>{money(inv.total)}</span>
          </div>
          <div className="flex justify-between text-[#51647A]">
            <span>{t('Payé')}</span>
            <span>{money(inv.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>{t('Reste à payer')}</span>
            <span>{money(inv.balance)}</span>
          </div>
        </div>
      </Sheet>
    ),
  };
}

/* ----- Reçu : A6 paysage ----- */
export function receiptDoc(p: Payment): DocDef {
  return {
    size: 'A6L',
    node: () => (
      <Sheet
        size="A6L"
        color={col(p.service_detail)}
        title="Reçu"
        number={p.payment_number}
        date={fmtDateTime(p.payment_date)}
        stampName={p.service_detail?.name}
        signature={`${t('Encaissé par')} ${p.received_by_name ?? '—'}`}
      >
        <Line k="Reçu de">{fullName(p.patient_detail)}</Line>
        <Line k="La somme de">
          <b>{money(p.amount)}</b>{' '}
          <span className="font-normal italic">
            ({inWords(Number(p.amount))} {CENTER.currency})
          </span>
        </Line>
        <Line k="Motif">Règlement de la facture {p.invoice_number}</Line>
        <Line k="Mode">
          {label(p.payment_method)}
          {p.reference ? ` · réf. ${p.reference}` : ''}
        </Line>
        <Line k="Solde actuel de la facture">
          {money(p.invoice_balance)} sur {money(p.invoice_total)}
        </Line>
      </Sheet>
    ),
  };
}

/* ----- Ordonnance : A5 paysage, A4 portrait si longue ----- */
export function prescriptionDoc(rx: Prescription): DocDef {
  const size: SheetSize = rx.items.length > 4 ? 'A4P' : 'A5L';
  const p = rx.patient_detail;
  return {
    size,
    node: () => (
      <Sheet
        size={size}
        color={col(rx.doctor_detail?.service_detail)}
        title="Ordonnance"
        number={rx.prescription_number}
        date={fmtDate(rx.prescription_date)}
        stampName={rx.doctor_detail?.service_detail?.name}
        signature={`Dr ${rx.doctor_detail?.name ?? ''}`}
      >
        <div className="grid grid-cols-2 gap-x-[6mm]">
          <Line k="Nom du patient">{fullName(p)}</Line>
          <Line k="Âge / sexe">{[ageTxt(p), sex(p)].filter(Boolean).join(' · ') || '—'}</Line>
        </div>
        <ol className="mt-[3mm] space-y-[1.4mm]">
          {rx.items.map((i, n) => (
            <li key={i.id} className="flex gap-[2mm]">
              <span className="font-bold text-[#0C3C7A]">{n + 1}.</span>
              <span>
                <b>{i.medication_name}</b>
                {i.dosage && ` — ${i.dosage}`}
                {i.frequency && `, ${i.frequency}`}
                {i.duration && `, ${t('pendant')} ${i.duration}`}
                {i.quantity ? ` (${t('Qté')} : ${i.quantity})` : ''}
                {i.instructions && <span className="block text-[#51647A]">{i.instructions}</span>}
              </span>
            </li>
          ))}
        </ol>
        {rx.instructions && (
          <p className="mt-[3mm] text-[#33475f]">
            <b>{t('Conseils :')}</b> {rx.instructions}
          </p>
        )}
      </Sheet>
    ),
  };
}

/* ----- Compte rendu de consultation ----- */
export function consultationDoc(c: Consultation): DocDef {
  const long =
    [c.reason, c.symptoms, c.diagnosis, c.observations, c.treatment_plan].join('').length > 650;
  const size: SheetSize = long ? 'A4P' : 'A5L';
  const vit = [
    c.temperature && `T° ${c.temperature} °C`,
    c.blood_pressure && `TA ${c.blood_pressure}`,
    c.heart_rate && `Pouls ${c.heart_rate}`,
    c.weight && `${c.weight} kg`,
    c.height && `${c.height} cm`,
  ]
    .filter(Boolean)
    .join(' · ');
  const p = c.patient_detail;
  return {
    size,
    node: () => (
      <Sheet
        size={size}
        color={col(c.doctor_detail?.service_detail)}
        title="Compte rendu médical"
        number={c.consultation_number}
        date={fmtDate(c.consultation_date)}
        stampName={c.doctor_detail?.service_detail?.name}
        signature={`Dr ${c.doctor_detail?.name ?? ''}`}
        compact
      >
        <div className="grid grid-cols-2 gap-x-[6mm]">
          <Line k="Nom du patient">{fullName(p)}</Line>
          <Line k="Âge / sexe">{[ageTxt(p), sex(p)].filter(Boolean).join(' · ') || '—'}</Line>
        </div>
        {c.reason && <Line k="Motif de consultation">{c.reason}</Line>}
        {c.symptoms && <Line k="Symptômes">{c.symptoms}</Line>}
        {vit && <Line k="Constantes">{vit}</Line>}
        {c.diagnosis && <Line k="Diagnostic">{c.diagnosis}</Line>}
        {c.observations && <Line k="Observations">{c.observations}</Line>}
        {c.treatment_plan && <Line k="Conduite à tenir">{c.treatment_plan}</Line>}
      </Sheet>
    ),
  };
}

/* ----- Résultats de laboratoire : A4 portrait, document séparé de la facture ----- */
export function labDoc(r: LabResult, dept?: ServiceBrief | null): DocDef {
  const q = r.request_detail;
  const p = q.patient_detail;
  return {
    size: 'A4P',
    node: () => (
      <Sheet
        size="A4P"
        color={col(dept)}
        title="Résultats d'analyse"
        number={q.request_number}
        date={fmtDate(r.validated_at)}
        stampName={dept?.name}
        signature={`${t('Validé par')} ${r.validated_by_name ?? '—'}`}
      >
        <div className="grid grid-cols-2 gap-x-[8mm]">
          <Line k="Patient">{fullName(p)}</Line>
          <Line k="N° dossier">{p?.patient_number}</Line>
          <Line k="Âge / sexe">{[ageTxt(p), sex(p)].filter(Boolean).join(' · ') || '—'}</Line>
          <Line k="Médecin demandeur">{q.doctor_name}</Line>
          <Line k="Demande faite le">{fmtDate(q.requested_at)}</Line>
          <Line k="Prélèvement le">
            {q.sample_collected_at ? fmtDate(q.sample_collected_at) : '—'}
          </Line>
          <Line k="Résultat validé le">{fmtDateTime(r.validated_at)}</Line>
          <Line k="Priorité">{label(q.priority)}</Line>
        </div>
        <table className="mt-[8mm] w-full border-collapse">
          <thead>
            <tr className="border-b-[0.4mm] border-[#0C3C7A] text-left text-[#51647A]">
              <th className="py-[1.5mm]">{t('Examen')}</th>
              <th>{t('Résultat')}</th>
              <th>{t('Valeurs normales')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#dfe7f1] align-top">
              <td className="w-[55mm] py-[2mm] font-bold">{q.lab_test_detail?.name}</td>
              <td className="whitespace-pre-wrap py-[2mm] font-semibold">{r.result}</td>
              <td className="w-[50mm] whitespace-pre-wrap py-[2mm] text-[#51647A]">
                {q.lab_test_detail?.normal_range || '—'}
              </td>
            </tr>
          </tbody>
        </table>
        {r.comment && (
          <p className="mt-[6mm]">
            <b>{t('Commentaire :')}</b> {r.comment}
          </p>
        )}
        {q.clinical_information && (
          <p className="mt-[4mm] text-[#51647A]">
            <b>{t('Renseignements cliniques :')}</b> {q.clinical_information}
          </p>
        )}
      </Sheet>
    ),
  };
}

/* ----- Dossier patient : bandeau de chemise ----- */
export function patientDoc(p: Patient): DocDef {
  return {
    size: 'STRIP',
    node: () => (
      <Sheet
        size="STRIP"
        color="MARINE"
        title="Dossier patient"
        number={p.patient_number}
        hideStamp
      >
        <div className="grid grid-cols-2 gap-x-[6mm]">
          <Line k="Nom">{fullName(p)}</Line>
          <Line k="Né(e) le">{p.date_of_birth ? fmtDate(p.date_of_birth) : '—'}</Line>
        </div>
      </Sheet>
    ),
  };
}
export { fmtTime };
