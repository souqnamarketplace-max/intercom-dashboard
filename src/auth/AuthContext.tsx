import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api, setToken, getToken, clearToken, type StaffUser } from '../api/client';

interface AuthContextValue {
  staff: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Staff identity is decoded from the JWT payload stored at login time —
// there's no GET /auth/me endpoint yet, so we keep the last-known staff
// object in localStorage alongside the token rather than re-fetching it.
const STAFF_KEY = 'staff_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffUser | null>(() => {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setToken(res.accessToken);
      localStorage.setItem(STAFF_KEY, JSON.stringify(res.staff));
      setStaff(res.staff);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(STAFF_KEY);
    setStaff(null);
  }, []);

  return (
    <AuthContext.Provider value={{ staff, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isAuthenticated() {
  return Boolean(getToken());
}
