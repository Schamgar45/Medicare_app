import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore, AUTH_LOST } from './api';
import type { Doctor, Role, User } from './types';

interface AuthState {
  user: User | null;
  doctor: Doctor | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const loadDoctor = useCallback(async (u: User) => {
    if (u.role !== 'DOCTOR') return setDoctor(null);
    try {
      setDoctor((await api.get<Doctor>('/doctors/me/')).data);
    } catch {
      setDoctor(null);
    }
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get<User>('/auth/profile/')
      .then(async (r) => {
        setUser(r.data);
        await loadDoctor(r.data);
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [loadDoctor]);

  useEffect(() => {
    const onLost = () => {
      setUser(null);
      setDoctor(null);
      qc.clear();
    };
    window.addEventListener(AUTH_LOST, onLost);
    return () => window.removeEventListener(AUTH_LOST, onLost);
  }, [qc]);

  const login = useCallback(
    async (email: string, password: string) => {
      const r = await api.post('/auth/login/', { email, password });
      tokenStore.set({ access: r.data.access, refresh: r.data.refresh });
      setUser(r.data.user);
      await loadDoctor(r.data.user);
    },
    [loadDoctor],
  );

  const logout = useCallback(async () => {
    const t = tokenStore.get();
    try {
      if (t) await api.post('/auth/logout/', { refresh: t.refresh });
    } catch {
      /* ignore */
    }
    tokenStore.clear();
    setUser(null);
    setDoctor(null);
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      doctor,
      loading,
      login,
      logout,
      can: (...roles) => !!user && (user.role === 'ADMIN' || roles.includes(user.role)),
    }),
    [user, doctor, loading, login, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
