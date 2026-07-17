import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSites } from '../auth/SiteContext';

const NAV_GROUPS: { label: string; items: { to: string; label: string; platformOnly?: boolean }[] }[] = [
  {
    label: 'Platform',
    items: [{ to: '/owners', label: 'Owners', platformOnly: true }],
  },
  {
    label: 'Building',
    items: [
      { to: '/sites', label: 'Sites' },
      { to: '/units', label: 'Units & Zones' },
      { to: '/devices', label: 'Devices' },
      { to: '/branding-settings', label: 'Branding & Panel Settings' },
    ],
  },
  {
    label: 'Access',
    items: [{ to: '/delivery-authorizations', label: 'Delivery Authorizations' }],
  },
  {
    label: 'Integrations',
    items: [{ to: '/partner-api-keys', label: 'Partner API Keys' }],
  },
  {
    label: 'Activity',
    items: [{ to: '/audit-trail', label: 'Audit Trail' }],
  },
];

export default function AppLayout() {
  const { staff, logout } = useAuth();
  const { sites, currentSiteId, setCurrentSiteId } = useSites();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const currentSite = sites.find((s) => s.id === currentSiteId);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Intercom<span>OS</span>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.platformOnly || staff?.role === 'platform_admin');
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}

        <div className="sidebar-footer">
          <NavLink to="/account" className="sidebar-user" style={{ textDecoration: 'none', display: 'block' }}>
            {staff?.email}
          </NavLink>
          <button className="btn btn-ghost btn-sm btn-full" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-area">
        {staff?.email === 'admin@example.com' && (
          <div style={{
            background: 'rgba(217,123,126,0.12)', borderBottom: '1px solid rgba(217,123,126,0.3)',
            padding: '10px 32px', fontSize: 13.5, color: 'var(--danger)',
          }}>
            You're signed in as the default seed account.{' '}
            <NavLink to="/account" style={{ color: 'var(--danger)', textDecoration: 'underline' }}>
              Change your password
            </NavLink>{' '}
            if you haven't already — this account has access to every owner's data.
          </div>
        )}
        <div className="topbar">
          <div className="site-select-bar">
            <span className="eyebrow" style={{ margin: 0 }}>Site</span>
            <select
              value={currentSiteId ?? ''}
              onChange={(e) => setCurrentSiteId(e.target.value)}
              disabled={sites.length === 0}
            >
              {sites.length === 0 && <option value="">No sites yet</option>}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {currentSite?.address && <div className="muted">{currentSite.address}</div>}
        </div>
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
