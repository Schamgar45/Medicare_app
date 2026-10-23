import { ReactNode, useState } from 'react';
import clsx from 'clsx';
import type { Relation } from '@/components/RelationSelect';
import { fullName } from '@/lib/format';

export const patientRel: Relation = {
  path: 'patients',
  label: (p) => `${fullName(p)} · ${p.patient_number}`,
};
export const doctorRel: Relation = {
  path: 'doctors',
  label: (d) => d.name + (d.specialty_name ? ` · ${d.specialty_name}` : ''),
};
export const serviceRel: Relation = {
  path: 'services',
  label: (s) => s.name,
  params: { is_active: true },
};
export const specialtyRel: Relation = { path: 'specialties', label: (s) => s.name };
export const medicationRel: Relation = {
  path: 'medications',
  label: (m) => `${m.name}${m.dosage ? ' ' + m.dosage : ''}`,
  params: { is_active: true },
};

export function Tabs({
  tabs,
  actions,
}: {
  tabs: { id: string; label: string; node: ReactNode }[];
  actions?: (activeTabId: string) => ReactNode;
}) {
  const [id, setId] = useState(tabs[0].id);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl bg-sunken p-1"
          role="tablist"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={id === t.id}
              onClick={() => setId(t.id)}
              className={clsx(
                'whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition',
                id === t.id ? 'bg-surface text-ink shadow-sm' : 'text-sub hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {actions?.(id)}
      </div>
      {tabs.find((t) => t.id === id)?.node}
    </>
  );
}
