import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { Field, Modal, Spinner } from './ui';
import { RelationSelect, Relation } from './RelationSelect';
import { apiError } from '@/lib/api';
import { isValidPhone, normalizePhone, PHONE_MESSAGE, todayISO } from '@/lib/format';
import { useToast } from '@/lib/toast';

export interface FieldDef {
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'tel'
    | 'password'
    | 'number'
    | 'date'
    | 'time'
    | 'datetime-local'
    | 'textarea'
    | 'select'
    | 'relation'
    | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  relation?: Relation;
  hint?: string;
  full?: boolean;
  step?: string;
  createOnly?: boolean;
  editOnly?: boolean;
  placeholder?: string;
  /** Champ date : borne maximale (YYYY-MM-DD), au format ISO. */
  max?: string;
  /** Champ date : refuse toute valeur postérieure à aujourd'hui (ex. date de naissance). */
  maxToday?: boolean;
}

function schemaFor(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') shape[f.name] = z.boolean().optional();
    else if (f.type === 'tel') {
      const base = z.string().optional().or(z.literal(''));
      const withPhone = base.refine((v) => !v || isValidPhone(v), PHONE_MESSAGE);
      shape[f.name] = f.required
        ? z
            .string()
            .min(1, 'Champ obligatoire')
            .refine((v) => isValidPhone(v), PHONE_MESSAGE)
        : withPhone;
    } else if (f.type === 'date' && (f.maxToday || f.max)) {
      const limit = f.maxToday ? todayISO() : f.max!;
      const futureMsg = 'La date ne peut pas être dans le futur.';
      // Vide ("" / null / undefined) autorisé pour un champ non requis, sinon comparaison ISO.
      const notFuture = (v: unknown) => v == null || v === '' || String(v) <= limit;
      shape[f.name] = f.required
        ? z
            .any()
            .refine((v) => v != null && v !== '', 'Champ obligatoire')
            .refine(notFuture, futureMsg)
        : z.any().refine(notFuture, futureMsg);
    } else if (f.required)
      shape[f.name] = z
        .any()
        .refine((v) => v !== '' && v !== null && v !== undefined, 'Champ obligatoire');
    else shape[f.name] = z.any().optional();
  }
  return z.object(shape).passthrough();
}

/** Valeurs vides -> null (dates, nombres, relations) ou "" (textes), comme l'attend l'API. */
export function toPayload(fields: FieldDef[], values: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') out[f.name] = !!v;
    else if (v === '' || v === undefined || v === null) {
      if (['text', 'email', 'tel', 'textarea', 'password'].includes(f.type)) {
        if (f.type !== 'password') out[f.name] = '';
      } else if (f.type === 'select' && !f.required) out[f.name] = '';
      else out[f.name] = null;
    } else if (f.type === 'number') out[f.name] = Number(v);
    else if (f.type === 'tel') out[f.name] = normalizePhone(String(v));
    else out[f.name] = v;
  }
  return out;
}

export function FormModal({
  open,
  onClose,
  title,
  fields,
  initial,
  editing,
  onSubmit,
  submitLabel = 'Enregistrer',
  wide = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fields: FieldDef[];
  initial: Record<string, any>;
  editing: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
  submitLabel?: string;
  wide?: boolean;
}) {
  const toast = useToast();
  const visible = useMemo(
    () => fields.filter((f) => (editing ? !f.createOnly : !f.editOnly)),
    [fields, editing],
  );

  // Un select obligatoire (sexe, rôle, statut…) n'a jamais de valeur vide par
  // défaut : on présélectionne sa première option réelle au lieu d'afficher
  // « Sélectionner… » / « — ». Indispensable pour les études de cas où le sexe
  // et l'âge doivent toujours être renseignés.
  const baseDefaults = useMemo(() => {
    const d: Record<string, any> = { ...initial };
    for (const f of fields) {
      if (f.type === 'select' && f.required && f.options?.length) {
        const cur = d[f.name];
        if (cur === undefined || cur === null || cur === '') d[f.name] = f.options[0].value;
      }
    }
    return d;
  }, [initial, fields]);

  const form = useForm<Record<string, any>>({
    resolver: zodResolver(schemaFor(visible)),
    defaultValues: baseDefaults,
  });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (open) reset(baseDefaults);
  }, [open, baseDefaults, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toPayload(visible, values));
      onClose();
    } catch (e) {
      const { message, fields: fe } = apiError(e);
      Object.entries(fe).forEach(([k, m]) => setError(k, { message: m }));
      toast.err(message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button
            type="submit"
            form="resource-form"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting && <Spinner />}
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="resource-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {visible.map((f) => {
          const err = errors[f.name]?.message as string | undefined;
          const span = f.full || f.type === 'textarea' ? 'sm:col-span-2' : '';
          return (
            <Field
              key={f.name}
              label={f.label}
              required={f.required}
              error={err}
              hint={f.hint}
              className={span}
            >
              {f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  className="input"
                  placeholder={f.placeholder}
                  {...register(f.name)}
                />
              ) : f.type === 'select' ? (
                <select className="input" {...register(f.name)}>
                  {/* Pas de placeholder vide sur un select obligatoire : la
                        première option réelle est déjà présélectionnée. */}
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'relation' ? (
                <Controller
                  control={control}
                  name={f.name}
                  render={({ field }) => (
                    <RelationSelect
                      value={field.value}
                      onChange={field.onChange}
                      relation={f.relation!}
                    />
                  )}
                />
              ) : f.type === 'checkbox' ? (
                <label className={clsx('flex h-10 items-center gap-2 text-sm')}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(var(--brand))]"
                    {...register(f.name)}
                  />{' '}
                  Oui
                </label>
              ) : (
                <input
                  className="input"
                  type={f.type}
                  step={f.step}
                  placeholder={f.placeholder}
                  max={
                    f.type === 'date' && (f.maxToday || f.max)
                      ? f.maxToday
                        ? todayISO()
                        : f.max
                      : undefined
                  }
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  {...register(f.name)}
                />
              )}
            </Field>
          );
        })}
      </form>
    </Modal>
  );
}
