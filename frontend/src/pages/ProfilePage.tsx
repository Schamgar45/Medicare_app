import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { api, apiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fullName, fmtDate, initials, label, PHONE_MESSAGE, isValidPhone } from '@/lib/format';
import { t, useLanguage } from '@/lib/i18n';
import { Badge, Field, PageHeader, Spinner } from '@/components/ui';
import type { User } from '@/lib/types';

const GENDER_OPTIONS = [
  { value: 'MASCULIN', label: 'Masculin' },
  { value: 'FEMININ', label: 'Féminin' },
];

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

/** Champ mot de passe avec bouton œil (afficher / masquer). */
function PasswordInput({
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className="input pr-11"
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        aria-label={t(show ? 'Masquer le mot de passe' : 'Afficher le mot de passe')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-mute transition hover:bg-sunken hover:text-ink disabled:opacity-50"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const STRENGTH_LABELS = ['à saisir', 'faible', 'moyenne', 'bonne', 'excellente'];
const STRENGTH_TONES = ['bg-sunken', 'bg-bad', 'bg-warn', 'bg-brand', 'bg-accent'];

function strengthOf(pw: string) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.max(1, Math.min(4, Math.round((s / 5) * 4)));
}

/** Jauge segmentée façon maquette : 4 barres + libellé « Robustesse : … ». */
function StrengthMeter({ value }: { value: string }) {
  const score = strengthOf(value);
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clsx(
              'h-1.5 flex-1 rounded-full transition-colors',
              i <= score ? STRENGTH_TONES[score] : 'bg-sunken',
            )}
          />
        ))}
      </div>
      <span className="text-xs text-mute">
        {t('Robustesse')} : <span className="font-semibold text-sub">{t(STRENGTH_LABELS[score])}</span>
      </span>
    </div>
  );
}

export function ProfilePage() {
  useLanguage();
  const { user, refreshUser, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const name = fullName(user) || user?.username || '';

  // ---- Photo ----
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // ---- Formulaire infos ----
  const [form, setForm] = useState(() => ({
    username: user?.username ?? '',
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    gender: user?.gender ?? '',
  }));
  const [currentPassword, setCurrentPassword] = useState('');
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ---- Formulaire mot de passe ----
  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Disponibilité du changement de mot de passe (limite 1×/semaine côté serveur).
  const pwReady = useMemo(() => {
    if (!user?.password_changed_at) return { allowed: true, nextDate: null as Date | null };
    const next = new Date(user.password_changed_at).getTime() + COOLDOWN_MS;
    return { allowed: Date.now() >= next, nextDate: new Date(next) };
  }, [user?.password_changed_at]);

  const emailChanged = form.email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();

  // ---- Mutations ----
  const infoMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (form.username !== (user?.username ?? '')) fd.append('username', form.username);
      if (form.first_name !== (user?.first_name ?? '')) fd.append('first_name', form.first_name);
      if (form.last_name !== (user?.last_name ?? '')) fd.append('last_name', form.last_name);
      if (form.email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase())
        fd.append('email', form.email.trim().toLowerCase());
      if (form.phone !== (user?.phone ?? '')) fd.append('phone', form.phone);
      if (form.gender !== (user?.gender ?? '')) fd.append('gender', form.gender);
      if (emailChanged) fd.append('current_password', currentPassword);
      if (photoFile) fd.append('avatar', photoFile);
      const { data } = await api.patch<User>('/auth/profile/update/', fd);
      return data;
    },
    onSuccess: async () => {
      await refreshUser();
      setCurrentPassword('');
      setPhotoFile(null);
      setPreview(null);
      setInfoMsg({ ok: true, text: 'Profil mis à jour avec succès.' });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => setInfoMsg({ ok: false, text: apiError(e).message }),
  });

  const clearAvatarMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('clear_avatar', 'true');
      const { data } = await api.patch<User>('/auth/profile/update/', fd);
      return data;
    },
    onSuccess: async () => {
      await refreshUser();
      setInfoMsg({ ok: true, text: 'Photo supprimée.' });
    },
    onError: (e) => setInfoMsg({ ok: false, text: apiError(e).message }),
  });

  const pwMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ detail: string }>('/auth/change-password/', pw);
      return data;
    },
    onSuccess: (data) => {
      setPwMsg({ ok: true, text: data.detail || 'Mot de passe modifié.' });
      setPw({ old_password: '', new_password: '', confirm_password: '' });
      refreshUser();
    },
    onError: (e) => setPwMsg({ ok: false, text: apiError(e).message }),
  });

  // ---- Validation locale avant envoi ----
  const infoErrors: Record<string, string> = {};
  if (emailChanged && !currentPassword)
    infoErrors.current_password = "Requis pour changer l'e-mail.";
  if (form.phone && !isValidPhone(form.phone)) infoErrors.phone = PHONE_MESSAGE;

  const pwErrors: Record<string, string> = {};
  if (pw.confirm_password && pw.new_password !== pw.confirm_password)
    pwErrors.confirm_password = 'Les mots de passe ne correspondent pas.';
  if (pw.new_password && pw.new_password.length < 8)
    pwErrors.new_password = '8 caractères minimum.';

  const avatarSrc = preview ?? user?.avatar ?? null;

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setInfoMsg({ ok: false, text: 'Image trop volumineuse (5 Mo max).' });
      return;
    }
    setPhotoFile(f);
    setPreview(URL.createObjectURL(f));
    setInfoMsg(null);
  }

  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mon profil"
        subtitle="Gérez vos informations personnelles, votre photo et votre mot de passe."
      />

      {/* ---- Carte d'en-tête ---- */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
          <div className="relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-20 w-20 rounded-full object-cover ring-4 ring-brand/15"
              />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full bg-navy text-2xl font-bold text-white ring-4 ring-brand/15">
                {initials(name) || '?'}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border bg-surface text-brand shadow hover:bg-sunken"
              aria-label={t('Modifier la photo')}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickPhoto}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tracking-tight">{name || '—'}</p>
            <p className="text-sm text-sub">@{user.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="info">{label(user.role)}</Badge>
              {user.is_superuser && <Badge tone="bad">{t('Super-admin')}</Badge>}
              <Badge tone={user.status === 'ACTIVE' ? 'ok' : 'mute'}>{label(user.status)}</Badge>
            </div>
            <p className="mt-2 text-xs text-mute">{t('Membre depuis le')} {fmtDate(user.created_at)}</p>
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0 sm:ml-auto">
            <button
              type="button"
              className="btn btn-ghost border-brand text-brand hover:bg-brand/5"
              onClick={() => fileRef.current?.click()}
              aria-label={t('Modifier la photo')}
            >
              <Camera className="h-4 w-4" /> {t('Modifier la photo')}
            </button>
            {user.avatar && !preview && (
              <button
                type="button"
                className="btn btn-ghost border-bad text-bad hover:bg-bad/5"
                onClick={() => clearAvatarMut.mutate()}
                disabled={clearAvatarMut.isPending}
                aria-label={t('Supprimer la photo')}
              >
                <Trash2 className="h-4 w-4" /> {t('Supprimer la photo')}
              </button>
            )}
          </div>
          {preview && (
            <p className="text-xs text-mute mt-4 sm:mt-0">{t('Aperçu — enregistrez pour appliquer.')}</p>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- Informations personnelles ---- */}
        <form
          className="card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (Object.keys(infoErrors).length) return;
            infoMut.mutate();
          }}
        >
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
            <UserIcon className="h-5 w-5 text-brand" />
            {t('Informations personnelles')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom d'utilisateur">
              <input
                className="input"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </Field>
            <Field label="Rôle" hint="Modifiable uniquement par un administrateur.">
              <input className="input bg-sunken" value={label(user.role)} disabled />
            </Field>
            <Field label="Prénom">
              <input
                className="input"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
            </Field>
            <Field label="Nom">
              <input
                className="input"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </Field>
            <Field label="E-mail" required error={infoErrors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input
                  type="email"
                  className="input pl-9"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </Field>
            <Field
              label="Téléphone"
              error={infoErrors.phone}
              hint="Format international, ex. +25779987654."
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
                <input
                  className="input pl-9"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </Field>
            <Field label="Genre" required>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            </Field>
            {emailChanged && (
              <Field
                label="Mot de passe actuel"
                required
                error={infoErrors.current_password}
                hint="Exigé pour confirmer le changement d'e-mail."
                className="sm:col-span-2"
              >
                <PasswordInput
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
              </Field>
            )}
          </div>

          {infoMsg && (
            <p
              className={clsx(
                'mt-4 rounded-lg px-3 py-2 text-sm',
                infoMsg.ok ? 'bg-ok/12 text-ok' : 'bg-bad/12 text-bad',
              )}
              role="status"
            >
              {t(infoMsg.text)}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={infoMut.isPending || Object.keys(infoErrors).length > 0}
            >
              {infoMut.isPending ? <Spinner /> : t('Enregistrer les modifications')}
            </button>
          </div>
        </form>

        {/* ---- Sécurité / mot de passe ---- */}
        <form
          className="card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (Object.keys(pwErrors).length || !pwReady.allowed) return;
            pwMut.mutate();
          }}
        >
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
            <KeyRound className="h-5 w-5 text-brand" />
            {t('Sécurité')}
          </h2>

          <div
            className={clsx(
              'mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs',
              pwReady.allowed ? 'bg-brand/8 text-sub' : 'bg-warn/15 text-warn',
            )}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {pwReady.allowed
                ? t("Choisissez un mot de passe sûr d'au moins 8 caractères. Vous pourrez le modifier à nouveau au plus tôt dans 7 jours.")
                : `${t('Pour des raisons de sécurité, un seul changement de mot de passe est autorisé par semaine. Nouveau changement possible à partir du')} ${fmtDate(pwReady.nextDate?.toISOString())}.`}
            </p>
          </div>

          <div className="space-y-4">
            <Field label="Mot de passe actuel" required>
              <PasswordInput
                value={pw.old_password}
                onChange={(v) => setPw({ ...pw, old_password: v })}
                autoComplete="current-password"
                disabled={!pwReady.allowed}
              />
            </Field>
            <Field label="Nouveau mot de passe" required error={pwErrors.new_password}>
              <PasswordInput
                value={pw.new_password}
                onChange={(v) => setPw({ ...pw, new_password: v })}
                autoComplete="new-password"
                disabled={!pwReady.allowed}
              />
            </Field>
            <StrengthMeter value={pw.new_password} />
            <Field
              label="Confirmer le nouveau mot de passe"
              required
              error={pwErrors.confirm_password}
            >
              <PasswordInput
                value={pw.confirm_password}
                onChange={(v) => setPw({ ...pw, confirm_password: v })}
                autoComplete="new-password"
                disabled={!pwReady.allowed}
              />
            </Field>
          </div>

          {pwMsg && (
            <p
              className={clsx(
                'mt-4 rounded-lg px-3 py-2 text-sm',
                pwMsg.ok ? 'bg-ok/12 text-ok' : 'bg-bad/12 text-bad',
              )}
              role="status"
            >
              {t(pwMsg.text)}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pwMut.isPending || !pwReady.allowed || Object.keys(pwErrors).length > 0}
            >
              {pwMut.isPending ? <Spinner /> : t('Changer le mot de passe')}
            </button>
          </div>
        </form>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-semibold">{t('Session')}</p>
          <p className="text-sm text-sub">{t('Déconnectez-vous de cet appareil en toute sécurité.')}</p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await logout();
            nav('/login');
          }}
        >
          <LogOut className="h-4 w-4" /> {t('Se déconnecter')}
        </button>
      </div>
    </div>
  );
}
