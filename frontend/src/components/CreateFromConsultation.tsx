import { FormModal, FieldDef } from "./FormModal";
import { api } from "@/lib/api";
import { fmtDate, fullName } from "@/lib/format";
import type { Consultation } from "@/lib/types";

const consultationField: FieldDef = {
  name: "consultation", label: "Consultation", type: "relation", required: true, full: true,
  relation: { path: "consultations", label: (c: Consultation) => `${fullName(c.patient_detail)} · ${fmtDate(c.consultation_date)} · ${c.consultation_number}`, params: { ordering: "-consultation_date" } },
};

/** Crée un objet lié à une consultation : patient et médecin sont repris de la consultation choisie. */
export function CreateFromConsultation({ open, onClose, title, extraFields, initial, onCreate }: {
  open: boolean; onClose: () => void; title: string; extraFields: FieldDef[]; initial: Record<string, any>;
  onCreate: (payload: Record<string, unknown>) => Promise<unknown>;
}) {
  return (
    <FormModal open={open} onClose={onClose} title={title} editing={false} fields={[consultationField, ...extraFields]}
      initial={{ consultation: "", ...initial }}
      onSubmit={async (payload) => {
        const c = (await api.get<Consultation>(`/consultations/${payload.consultation}/`)).data;
        return onCreate({ ...payload, patient: c.patient, doctor: c.doctor });
      }} />
  );
}
