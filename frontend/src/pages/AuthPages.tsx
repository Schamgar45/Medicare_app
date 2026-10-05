import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { api, apiError } from '@/lib/api';
import { CENTER, APP_VERSION } from '@/lib/center';
import { Field, Spinner } from '@/components/ui';

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0C3C7A] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#2FA45B]/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#1B6DC1]/50 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <img src="/brand/logo.png" className="h-12 w-12 rounded-full bg-white" alt="" />
          <span className="text-lg font-extrabold">{CENTER.name}</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">{CENTER.slogan}</h2>
          <p className="mt-4 max-w-md text-white/75">
            Dossiers patients, rendez-vous, laboratoire, pharmacie et facturation réunis dans un
            même outil.
          </p>
        </div>
        <p className="relative text-xs text-white/60">
          {CENTER.address} · {CENTER.phone}
        </p>
      </div>
      <div className="relative flex items-center justify-center p-6">
        <button
          className="absolute right-4 top-4 rounded-lg p-2 text-sub hover:bg-sunken"
          onClick={toggle}
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="w-full max-w-sm animate-rise">
          <img src="/brand/logo.png" alt="" className="mb-6 h-16 w-16 rounded-full lg:hidden" />
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-sub">{subtitle}</p>
          {children}
          <p className="mt-10 text-center text-xs text-mute">
            {CENTER.name} · Version {APP_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;
  return (
    <Shell title="Connexion" subtitle="Accédez à votre espace de travail.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await login(email.trim(), password);
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
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Mot de passe">
          <div className="relative">
            <input
              className="input pr-10"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-mute"
              onClick={() => setShow(!show)}
              aria-label="Afficher le mot de passe"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        {error && (
          <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Spinner />}Se connecter
        </button>
        <div className="text-center">
          <Link to="/forgot" className="text-sm font-medium text-brand hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
      </form>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Shell title="Mot de passe oublié" subtitle="Nous vous envoyons un lien de réinitialisation.">
      {sent ? (
        <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">
          Si cet email existe, un lien vient d'être envoyé.
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
          <Field label="Email">
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Spinner />}Envoyer le lien
          </button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-brand hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </Shell>
  );
}

export function ResetPage() {
  const [sp] = useSearchParams();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Shell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe d'au moins 8 caractères."
    >
      {msg?.ok ? (
        <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">{msg.t}</p>
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
              setMsg({ ok: true, t: 'Mot de passe modifié. Vous pouvez vous connecter.' });
            } catch (err) {
              const f = apiError(err);
              setMsg({ ok: false, t: Object.values(f.fields)[0] || f.message });
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Nouveau mot de passe">
            <input
              className="input"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </Field>
          {msg && !msg.ok && (
            <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
              {msg.t}
            </p>
          )}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Spinner />}Enregistrer
          </button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-brand hover:underline">
          Aller à la connexion
        </Link>
      </div>
    </Shell>
  );
}
