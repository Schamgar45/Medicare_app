import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, tokenStore, AUTH_LOST } from "./api";
import type { Doctor, Role, User } from "./types";

interface AuthState {
  user: User | null;
  doctor: Doctor | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  can: (...roles: Role[]) => boolean;
  /** True si l'utilisateur connecté est le super-administrateur (createsuperuser). */
  isSuperuser: boolean;
  /** Recharge le profil depuis l'API (ex. après une modification sur « Mon profil »). */
  refreshUser: () => Promise<void>;
  /**
   * Hiérarchie : l'utilisateur connecté peut-il gérer (modifier/supprimer/désactiver)
   * le compte cible ? Miroir des règles backend :
   *  - le superuser gère tout le monde ;
   *  - un ADMIN (non-superuser) ne touche ni le superuser ni un autre ADMIN ;
   *  - tout compte non-admin peut être géré par un ADMIN ;
   *  - chacun peut voir/éditer son propre compte (la suppression de soi reste interdite,
   *    gérée au niveau de la vue).
   */
  canManage: (target?: { id?: number; role?: Role; is_superuser?: boolean } | null) => boolean;
}
const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const loadDoctor = useCallback(async (u: User) => {
    if (u.role !== "DOCTOR") return setDoctor(null);
    try { setDoctor((await api.get<Doctor>("/doctors/me/")).data); } catch { setDoctor(null); }
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get<User>("/auth/profile/")
      .then(async (r) => { setUser(r.data); await loadDoctor(r.data); })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [loadDoctor]);

  useEffect(() => {
    const onLost = () => { setUser(null); setDoctor(null); qc.clear(); };
    window.addEventListener(AUTH_LOST, onLost);
    return () => window.removeEventListener(AUTH_LOST, onLost);
  }, [qc]);

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const r = await api.post("/auth/login/", { email, password });
    tokenStore.set({ access: r.data.access, refresh: r.data.refresh }, remember);
    setUser(r.data.user);
    await loadDoctor(r.data.user);
  }, [loadDoctor]);

  const logout = useCallback(async () => {
    const t = tokenStore.get();
    try { if (t) await api.post("/auth/logout/", { refresh: t.refresh }); } catch { /* ignore */ }
    tokenStore.clear(); setUser(null); setDoctor(null); qc.clear();
  }, [qc]);

  const refreshUser = useCallback(async () => {
    try { const u = (await api.get<User>("/auth/profile/")).data; setUser(u); await loadDoctor(u); } catch { /* ignore */ }
  }, [loadDoctor]);

  const value = useMemo<AuthState>(() => ({
    user, doctor, loading, login, logout, refreshUser,
    can: (...roles) => !!user && (user.role === "ADMIN" || roles.includes(user.role)),
    isSuperuser: !!user?.is_superuser,
    canManage: (target) => {
      if (!user) return false;
      if (user.is_superuser) return true; // le superuser gère tout le monde
      if (!target) return true; // ressources génériques : l'ADMIN les gère
      if (target.id === user.id) return true; // son propre compte (édition autorisée)
      if (target.is_superuser) return false; // jamais toucher le superuser
      if (target.role === "ADMIN") return false; // un ADMIN ne touche pas un autre ADMIN
      return true; // l'ADMIN gère les autres profils
    },
  }), [user, doctor, loading, login, logout, refreshUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
