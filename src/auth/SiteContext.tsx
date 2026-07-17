import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type Site } from '../api/client';
import { useAuth } from './AuthContext';

interface SiteContextValue {
  sites: Site[];
  currentSiteId: string | null;
  setCurrentSiteId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);
const LAST_SITE_KEY = 'last_site_id';

export function SiteProvider({ children }: { children: ReactNode }) {
  const { staff } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [currentSiteId, setCurrentSiteIdState] = useState<string | null>(
    () => localStorage.getItem(LAST_SITE_KEY),
  );
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const result = await api.listSites();
      setSites(result);
      // If nothing selected yet (or the saved one no longer exists), default to the first site
      if (!currentSiteId || !result.find((s) => s.id === currentSiteId)) {
        if (result[0]) {
          setCurrentSiteIdState(result[0].id);
          localStorage.setItem(LAST_SITE_KEY, result[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (staff) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff]);

  function setCurrentSiteId(id: string) {
    setCurrentSiteIdState(id);
    localStorage.setItem(LAST_SITE_KEY, id);
  }

  return (
    <SiteContext.Provider value={{ sites, currentSiteId, setCurrentSiteId, loading, refresh }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSites() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSites must be used within SiteProvider');
  return ctx;
}
