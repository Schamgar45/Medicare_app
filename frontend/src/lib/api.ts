import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export const api = axios.create({ baseURL: `${BASE}/api`, timeout: 30000 });

const KEY = 'mh-auth';
export interface Tokens {
  access: string;
  refresh: string;
}
export const tokenStore = {
  get(): Tokens | null {
    try {
      const v = sessionStorage.getItem(KEY);
      if (v) return JSON.parse(v);
    } catch {
      /* ignore */
    }
    // Ancienne session persistante (« Se souvenir de moi ») : on la purge pour
    // que la fermeture de l'onglet détruise bien la session.
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return null;
  },
  /** La session vit uniquement dans l'onglet courant (sessionStorage). */
  set(t: Tokens) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(t));
      localStorage.removeItem(KEY);
    } catch {
      /* stockage indisponible */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

const SESSION_CLOSE_URL = `${BASE}/api/auth/session/close/`;

/**
 * Détruit aussi la session côté serveur quand l'onglet est fermé.
 *
 * `pagehide` est également déclenché lors d'un rechargement (F5) : dans ce cas
 * l'onglet reste visible, on ne révoque donc pas le jeton pour laisser la
 * session survivre au rechargement. À la fermeture, `visibilitychange` passe
 * d'abord l'onglet en « hidden ».
 */
export function watchSessionClose(): () => void {
  let hidden = document.visibilityState === 'hidden';

  const onVisibilityChange = () => {
    hidden = document.visibilityState === 'hidden';
  };

  const onPageHide = (event: PageTransitionEvent) => {
    if (event.persisted) return; // onglet gardé en bfcache : pas une fermeture
    if (!hidden) return; // F5 / rechargement : la session doit continuer
    const t = tokenStore.get();
    if (!t?.refresh) return;
    try {
      // text/plain = requête « simple » : pas de préflight CORS pendant l'unload.
      const body = new Blob([JSON.stringify({ refresh: t.refresh })], { type: 'text/plain' });
      navigator.sendBeacon(SESSION_CLOSE_URL, body);
    } catch {
      /* le navigateur refuse le beacon */
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
  };
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = tokenStore.get();
  if (t?.access && !config.url?.includes('/auth/login'))
    config.headers.Authorization = `Bearer ${t.access}`;
  return config;
});

let refreshing: Promise<string> | null = null;
function refreshAccess(): Promise<string> {
  const t = tokenStore.get();
  if (!t?.refresh) return Promise.reject(new Error('no refresh'));
  refreshing ??= axios
    .post(`${BASE}/api/auth/refresh/`, { refresh: t.refresh })
    .then((r) => {
      tokenStore.set({ access: r.data.access, refresh: r.data.refresh ?? t.refresh });
      return r.data.access as string;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export const AUTH_LOST = 'mh-auth-lost';

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const url = original?.url || '';
    // Mauvais identifiants = 400 côté API ; on ne rafraîchit que sur 401 hors login/refresh.
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        const access = await refreshAccess();
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.dispatchEvent(new Event(AUTH_LOST));
      }
    }
    return Promise.reject(error);
  },
);

/** Transforme une erreur DRF en message lisible (+ erreurs par champ). */
export function apiError(err: unknown): { message: string; fields: Record<string, string> } {
  const e = err as AxiosError<any>;
  if (!e.response)
    return { message: 'Impossible de joindre le serveur. Vérifiez la connexion.', fields: {} };
  const d = e.response.data;
  const fields: Record<string, string> = {};
  let message = 'Une erreur est survenue.';
  if (e.response.status === 403)
    message = "Vous n'avez pas l'autorisation d'effectuer cette action.";
  else if (e.response.status === 404) message = 'Élément introuvable.';
  else if (e.response.status >= 500) message = 'Erreur du serveur. Réessayez dans un instant.';
  if (typeof d === 'string') message = d.length < 200 ? d : message;
  else if (Array.isArray(d))
    message = d.join(' ') || message; // ValidationError DRF renvoie une liste
  else if (d && typeof d === 'object') {
    if (typeof d.detail === 'string') message = d.detail;
    else if (Array.isArray(d.detail)) message = d.detail.join(' ') || message;
    for (const [k, v] of Object.entries(d)) {
      if (k === 'detail') continue;
      const txt = Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : JSON.stringify(v);
      if (k === 'non_field_errors') message = txt;
      else fields[k] = txt;
    }
    if (Object.keys(fields).length && message === 'Une erreur est survenue.')
      message = 'Vérifiez les champs signalés.';
  }
  return { message, fields };
}

export async function fetchAll<T>(
  path: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const res = await api.get<{ results: T[] }>(path, { params: { page_size: 100, ...params } });
  return res.data.results;
}
