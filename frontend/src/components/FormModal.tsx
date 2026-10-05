import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { Field, Modal, Spinner } from './ui';
import { RelationSelect, Relation } from './RelationSelect';
import { apiError } from '@/lib/api';
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
}

function schemaFor(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') shape[f.name] = z.boolean().optional();
    else if (f.required)
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
  const form = useForm<Record<string, any>>({
    resolver: zodResolver(schemaFor(visible)),
    defaultValues: initial,
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
    if (open) reset(initial);
  }, [open, initial, reset]);

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
                  {!f.required && <option value="">—</option>}
                  {f.required && <option value="">Sélectionner…</option>}
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
