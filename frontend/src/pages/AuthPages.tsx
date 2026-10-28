import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, apiError } from '@/lib/api';
import { CENTER, APP_VERSION } from '@/lib/center';
import { Spinner } from '@/components/ui';
import { t, useLanguage } from '@/lib/i18n';

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { language, toggleLanguage } = useLanguage();
  // Pages d'accès toujours en thème sombre (data-theme local), comme la maquette validée.
  return (
    <div
      data-theme="dark"
      className="relative grid min-h-screen overflow-hidden bg-[#08111f] text-ink lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <img
          src="/brand/login.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_10%,rgba(27,109,193,.45),transparent),radial-gradient(700px_500px_at_90%_100%,rgba(47,164,91,.25),transparent),linear-gradient(160deg,#0a2447,#08111f)] opacity-95" />
        <div className="relative flex items-center gap-3">
          <img src="/brand/logo.png" className="h-14 w-14 rounded-full bg-white" alt="" />
          <div className="leading-tight">
            <p className="text-2xl font-extrabold text-white">
              Medicare <span className="text-[#3ddc97]">Hospital</span>
            </p>
            <p className="text-sm text-white/70">“{t(CENTER.slogan)}”</p>
          </div>
        </div>
        <div className="relative max-w-lg">
          <h2 className="text-5xl font-extrabold leading-[1.05] text-white">
            {t('Votre santé,')}
            <br />
            <span className="text-[#3ddc97]">{t('notre priorité')}</span>
          </h2>
          <p className="mt-5 text-lg text-white/75">
            {t('Un accès sécurisé à votre espace de travail pour une meilleure gestion de nos services hospitaliers.')}
          </p>
          <div className="mt-10 grid grid-cols-3 gap-5">
            {[
              [ShieldCheck, t('Accès sécurisé'), t('Vos données sont protégées')],
              [Clock, t('Suivi en temps réel'), t('Une gestion efficace de vos opérations')],
              [Users, t('Une équipe engagée'), t('Pour votre bien-être')],
            ].map(([Icon, t, d]: any) => (
              <div key={t}>
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#3ddc97]/15 text-[#3ddc97]">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-white">{t}</p>
                <p className="mt-0.5 text-xs text-white/60">{d}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/50">
          {CENTER.address} · {CENTER.phone}
        </p>
      </div>
      <div className="relative flex items-center justify-center p-5 sm:p-8">
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#2FA45B]/25 blur-3xl" />
        <div className="relative w-full max-w-md animate-rise rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur sm:p-10">
          <img
            src="/brand/logo.png"
            alt=""
            className="mb-5 h-14 w-14 rounded-full bg-white lg:hidden"
          />
          <button
            type="button"
            className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10"
            onClick={toggleLanguage}
            aria-label={t(language === 'fr' ? 'Passer en anglais' : 'Passer en français')}
            title={t(language === 'fr' ? 'Passer en anglais' : 'Passer en français')}
          >
            {language.toUpperCase()}
          </button>
          <p className="text-sm text-white/70">{t(subtitle)}</p>
          <h1 className="mb-6 mt-1 text-3xl font-extrabold tracking-tight text-white">{t(title)}</h1>
          {children}
          <p className="mt-8 text-center text-xs text-white/40">
            {CENTER.name} · {t('Version')} {APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  'h-12 w-full rounded-xl border border-white/15 bg-[#0b1930]/70 px-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-[#3ddc97] focus:ring-2 focus:ring-[#3ddc97]/25';
const primaryBtn =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2fc58a] text-sm font-bold text-[#04231a] transition hover:brightness-110 active:scale-[.99] disabled:opacity-60';
const FieldD = ({
  icon: Icon,
  label: l,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-sm font-semibold text-white">
      <Icon className="h-4 w-4" />
      {t(l)}
    </label>
    {children}
  </div>
);

export function LoginPage() {
  useLanguage();
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  // Le gestionnaire de mots de passe du navigateur remplit le DOM même si l'état
  // React est vide → on vide les champs au montage et à chaque focus.
  useEffect(() => {
    const clear = () => {
      if (!email && emailRef.current) emailRef.current.value = '';
      if (!password && passRef.current) passRef.current.value = '';
    };
    const raf = requestAnimationFrame(clear);
    const t1 = setTimeout(clear, 150);
    const t2 = setTimeout(clear, 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clearOnFocus = (ref: React.RefObject<HTMLInputElement | null>, val: string) => () => {
    if (!val)
      requestAnimationFrame(() => {
        if (ref.current) ref.current.value = '';
      });
  };
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;
  return (
    <Shell title="Medicare Hospital" subtitle="Bienvenue sur">
      <p className="-mt-4 mb-6 text-sm text-white/70">{t('Connectez-vous à votre espace de travail')}</p>
      <form
        className="space-y-5"
        autoComplete="off"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            // Filet de sécurité : si le navigateur a rempli sans passer par onChange, on lit le DOM.
            const em = (email || emailRef.current?.value || '').trim();
            const pw = password || passRef.current?.value || '';
            await login(em, pw, remember);
            nav(loc.state?.from || '/', { replace: true });
          } catch (err) {
            const r = (err as any).response;
            setError(
              r?.status === 400 || r?.status === 401
                ? 'Email ou mot de passe incorrect.'
                : apiError(err).message,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <FieldD icon={Mail} label="Email">
          <input
            ref={emailRef}
            className={inputCls}
            type="email"
            placeholder={t('exemple@domaine.com')}
            autoComplete="off"
            required
            value={email}
            onFocus={clearOnFocus(emailRef, email)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FieldD>
        <FieldD icon={Lock} label="Mot de passe">
          <div className="relative">
            <input
              ref={passRef}
              className={inputCls + ' pr-12'}
              type={show ? 'text' : 'password'}
              placeholder={t('Votre mot de passe')}
              autoComplete="new-password"
              required
              value={password}
              onFocus={clearOnFocus(passRef, password)}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white"
              onClick={() => setShow(!show)}
              aria-label={t('Afficher le mot de passe')}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </FieldD>
        <div className="flex items-center justify-between gap-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2 text-white/80">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#2fc58a]"
              onChange={(e) => setRemember(e.target.checked)}
            />
            {t('Se souvenir de moi')}
          </label>
          <Link to="/forgot" className="font-semibold text-[#3ddc97] hover:underline">
            {t('Mot de passe oublié ?')}
          </Link>
        </div>
        {error && (
          <p
            className="rounded-xl bg-red-500/15 px-4 py-3 text-sm font-medium text-red-300"
            role="alert"
          >
            {t(error)}
          </p>
        )}
        <button className={primaryBtn} disabled={busy}>
          {busy ? <Spinner /> : <LogIn className="h-5 w-5" />}{t('Se connecter')}
        </button>
      </form>
    </Shell>
  );
}

export function ForgotPage() {
  useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Mot de passe oublié" subtitle="Nous vous envoyons un lien de réinitialisation">
      {sent ? (
        <p className="rounded-lg bg-[#2fc58a]/15 p-3 text-sm text-[#7ff0c0]">
          {t("Si cet email existe, un lien vient d'être envoyé.")}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api.post('/auth/password-reset/', { email });
            } catch {
              /* même réponse */
            }
            setSent(true);
            setBusy(false);
          }}
        >
          <FieldD icon={Mail} label="Email">
            <input
              className={inputCls}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FieldD>
          <button className={primaryBtn} disabled={busy}>
            {busy && <Spinner />}{t('Envoyer le lien')}
          </button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-[#3ddc97] hover:underline">
          {t('Retour à la connexion')}
        </Link>
      </div>
    </Shell>
  );
}

export function ResetPage() {
  useLanguage();
  const [sp] = useSearchParams();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe d'au moins 8 caractères"
    >
      {msg?.ok ? (
        <p className="rounded-lg bg-[#2fc58a]/15 p-3 text-sm text-[#7ff0c0]">{msg.t}</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMsg(null);
            try {
              await api.post('/auth/password-reset-confirm/', {
                uid: sp.get('uid'),
                token: sp.get('token'),
                new_password: pw,
              });
              setMsg({ ok: true, t: t('Mot de passe modifié. Vous pouvez vous connecter.') });
            } catch (err) {
              const f = apiError(err);
              setMsg({ ok: false, t: Object.values(f.fields)[0] || f.message });
            } finally {
              setBusy(false);
            }
          }}
        >
          <FieldD icon={Lock} label="Nouveau mot de passe">
            <input
              className={inputCls}
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </FieldD>
          {msg && !msg.ok && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300" role="alert">
              {msg.t}
            </p>
          )}
          <button className={primaryBtn} disabled={busy}>
            {busy && <Spinner />}{t('Enregistrer')}
          </button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-[#3ddc97] hover:underline">
          {t('Aller à la connexion')}
        </Link>
      </div>
    </Shell>
  );
}
