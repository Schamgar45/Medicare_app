import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Moon,
  ShieldCheck,
  Sun,
  UsersRound,
} from 'lucide-react';
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
    <div className="auth-shell">
      <section className="auth-visual" aria-label={CENTER.name}>
        <div className="auth-brand">
          <img src="/brand/logo.png" className="h-14 w-14 object-contain" alt="" />
          <div>
            <div className="auth-brand-name">
              Medicare <span>Hospital</span>
            </div>
            <p>“Votre santé, notre priorité”</p>
          </div>
        </div>
        <div className="auth-hero-copy">
          <h2>
            Votre santé,
            <br />
            <span>notre priorité</span>
          </h2>
          <p>
            Un accès sécurisé à votre espace de travail pour une meilleure gestion de nos services
            hospitaliers.
          </p>
          <div className="auth-benefits">
            <div>
              <ShieldCheck />
              <strong>Accès sécurisé</strong>
              <span>
                Vos données
                <br />
                sont protégées
              </span>
            </div>
            <div>
              <Clock3 />
              <strong>Suivi en temps réel</strong>
              <span>
                Une gestion efficace
                <br />
                de vos opérations
              </span>
            </div>
            <div>
              <UsersRound />
              <strong>Une équipe engagée</strong>
              <span>Pour votre bien-être</span>
            </div>
          </div>
        </div>
        <p className="auth-contact">
          {CENTER.address} <span>·</span> {CENTER.phone}
        </p>
      </section>
      <main className="auth-panel">
        <button
          className="auth-theme-toggle"
          onClick={toggle}
          aria-label="Changer de thème"
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
          <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </button>
        <div className="auth-card animate-rise">
          <div className="auth-mobile-brand">
            <img src="/brand/logo.png" alt="" />
            <span>
              Medicare <b>Hospital</b>
            </span>
          </div>
          <div className="auth-secure">
            <LockKeyhole /> Connexion sécurisée
          </div>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-version">
            {CENTER.name} · Version {APP_VERSION}
          </p>
        </div>
      </main>
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
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={loc.state?.from || '/'} replace />;
  return (
    <Shell title="Connexion" subtitle="Accédez à votre espace de travail.">
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await login(email.trim(), password, remember);
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
            className="input auth-input"
            type="email"
            autoComplete="username"
            required
            placeholder="exemple@domaine.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
          />
        </Field>
        <Field label="Mot de passe">
          <div className="relative">
            <input
              className="input auth-input pr-11"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Mot de passe"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-mute"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
        <div className="auth-options">
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />{' '}
            Se souvenir de moi
          </label>
          <Link to="/forgot" className="text-sm font-medium text-brand hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <button className="btn btn-primary auth-submit" disabled={busy}>
          {busy ? <Spinner /> : <LogIn />}Se connecter
        </button>
        <div className="auth-divider">
          <span>Ou</span>
        </div>
        <button
          className="auth-microsoft"
          type="button"
          disabled
          title="Connexion Microsoft non configurée"
        >
          <span className="microsoft-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Connexion avec Microsoft
        </button>
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
