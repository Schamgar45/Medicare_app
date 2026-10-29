import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import clsx from 'clsx';
import { Field, Modal, Spinner } from './ui';
import { RelationSelect, Relation } from './RelationSelect';
import { apiError } from '@/lib/api';
import { isValidPhone, normalizePhone, PHONE_MESSAGE, todayISO } from '@/lib/format';
import { useToast } from '@/lib/toast';
import { t, useLanguage } from '@/lib/i18n';

const STEP_CHANGE_GUARD_MS = 500;

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
  formStep?: string;
  createOnly?: boolean;
  editOnly?: boolean;
  placeholder?: string;
  /** Libellé affiché pour l'option vide d'un select non requis (ex. "Non spécifié"). */
  emptyLabel?: string;
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
            .min(1, t('Champ obligatoire'))
            .refine((v) => isValidPhone(v), PHONE_MESSAGE)
        : withPhone;
    } else if (f.type === 'date' && (f.maxToday || f.max)) {
      const limit = f.maxToday ? todayISO() : f.max!;
      const futureMsg = t('La date ne peut pas être dans le futur.');
      // Vide ("" / null / undefined) autorisé pour un champ non requis, sinon comparaison ISO.
      const notFuture = (v: unknown) => v == null || v === '' || String(v) <= limit;
      shape[f.name] = f.required
        ? z
            .any()
            .refine((v) => v != null && v !== '', t('Champ obligatoire'))
            .refine(notFuture, futureMsg)
        : z.any().refine(notFuture, futureMsg);
    } else if (f.required)
      shape[f.name] = z
        .any()
        .refine((v) => v !== '' && v !== null && v !== undefined, t('Champ obligatoire'));
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
  const { language } = useLanguage();
  const toast = useToast();
  const visible = useMemo(
    () =>
      fields.filter((f) => (editing ? !f.createOnly : !f.editOnly)),
    [fields, editing],
  );
  const formSteps = useMemo(() => {
    const steps = new Map<string, FieldDef[]>();
    visible.forEach((field) => {
      const title = t(field.formStep ?? 'Informations');
      const stepFields = steps.get(title) ?? [];
      stepFields.push(field);
      steps.set(title, stepFields);
    });
    return Array.from(steps, ([title, stepFields]) => ({ title, fields: stepFields }));
  }, [visible, language]);
  const useWizard = visible.length > 7 && formSteps.length > 1;
  const [activeStep, setActiveStep] = useState(0);
  const lastStepChangeAt = useRef<number | null>(null);
  const isAdvancingStep = useRef(false);

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
    trigger,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (open) {
      reset(baseDefaults);
      setActiveStep(0);
      lastStepChangeAt.current = null;
    }
  }, [open, baseDefaults, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toPayload(visible, values));
      onClose();
    } catch (e) {
      const { message, fields: fe } = apiError(e);
      Object.entries(fe).forEach(([k, m]) => setError(k, { message: m }));
      const firstInvalidField = visible.find((field) => fe[field.name]);
      if (firstInvalidField && useWizard) {
        const invalidStep = formSteps.findIndex((step) =>
          step.fields.some((field) => field.name === firstInvalidField.name),
        );
        if (invalidStep >= 0) setActiveStep(invalidStep);
      }
      toast.err(message);
    }
  });
  const currentStep = formSteps[activeStep];
  const advanceStep = async () => {
    if (
      isAdvancingStep.current ||
      (lastStepChangeAt.current !== null &&
        Date.now() - lastStepChangeAt.current < STEP_CHANGE_GUARD_MS)
    ) {
      return;
    }
    isAdvancingStep.current = true;
    try {
      if (await trigger(currentStep.fields.map((field) => field.name))) {
        lastStepChangeAt.current = Date.now();
        setActiveStep((step) => Math.min(step + 1, formSteps.length - 1));
      }
    } finally {
      isAdvancingStep.current = false;
    }
  };
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (useWizard && activeStep < formSteps.length - 1) {
      event.preventDefault();
      void advanceStep();
      return;
    }
    if (
      useWizard &&
      lastStepChangeAt.current !== null &&
      Date.now() - lastStepChangeAt.current < STEP_CHANGE_GUARD_MS
    ) {
      event.preventDefault();
      return;
    }
    void submit(event);
  };
  const currentFields = useWizard ? currentStep.fields : visible;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(title)}
      wide={wide}
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-xs font-medium text-sub">
            {useWizard ? (
              <>
                {activeStep > 0 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveStep((step) => step - 1)}>
                    {t('Retour')}
                  </button>
                )}
                <span>
                  {t('Étape {current} sur {total}')
                    .replace('{current}', String(activeStep + 1))
                    .replace('{total}', String(formSteps.length))}
                </span>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t('Annuler')}
              </button>
            )}
          </div>
          {useWizard && activeStep === 0 && (
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t('Annuler')}</button>
          )}
          {useWizard && activeStep < formSteps.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => void advanceStep()}>
              {t('Suivant')}
            </button>
          ) : (
            <button
              type="submit"
              form="resource-form"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && <Spinner />}
              {t(submitLabel)}
            </button>
          )}
        </>
      }
    >
      <form id="resource-form" onSubmit={handleFormSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {useWizard && (
          <div className="col-span-full mb-2" aria-label={t('Progression du formulaire')}>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={1} aria-valuemax={formSteps.length} aria-valuenow={activeStep + 1}>
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((activeStep + 1) / formSteps.length) * 100}%` }} />
            </div>
            <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${formSteps.length}, minmax(0, 1fr))` }}>
              {formSteps.map((step, index) => (
                <li key={step.title} className={clsx('min-w-0 text-center text-[10px] font-semibold sm:text-xs', index === activeStep ? 'text-brand' : index < activeStep ? 'text-ink' : 'text-mute')}>
                  <span className={clsx('mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full text-xs', index <= activeStep ? 'bg-brand text-brand-ink' : 'bg-sunken text-sub')}>{index + 1}</span>
                  <span className="block truncate">{step.title}</span>
                </li>
              ))}
            </ol>
            <h3 className="mt-5 text-sm font-bold">{currentStep.title}</h3>
          </div>
        )}
        {currentFields.map((f) => {
          const err = errors[f.name]?.message as string | undefined;
          const span = f.full || f.type === 'textarea' ? 'sm:col-span-2' : '';
          return (
            <Field
              key={f.name}
              label={t(f.label)}
              required={f.required}
              error={err}
              hint={f.hint ? t(f.hint) : undefined}
              className={span}
            >
              {f.type === 'textarea' ? (
                <textarea
                  rows={3}
                  className="input"
                  placeholder={f.placeholder ? t(f.placeholder) : undefined}
                  {...register(f.name)}
                />
              ) : f.type === 'select' ? (
                <select className="input" {...register(f.name)}>
                  {/* Pas de placeholder vide sur un select obligatoire : la
                        première option réelle est déjà présélectionnée. */}
                  {!f.required && (
                    <option value="">
                      {f.emptyLabel ? t(f.emptyLabel) : 'Non spécifié'}
                    </option>
                  )}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
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
                  placeholder={f.placeholder ? t(f.placeholder) : undefined}
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
