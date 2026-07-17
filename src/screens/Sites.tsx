import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Owner, type Site } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useSites } from '../auth/SiteContext';
import Modal from '../components/Modal';

export default function Sites() {
  const { staff } = useAuth();
  const { sites, loading, refresh, setCurrentSiteId } = useSites();
  const [showCreate, setShowCreate] = useState(false);
  const [editSite, setEditSite] = useState<Site | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [ownerId, setOwnerId] = useState(staff?.ownerId ?? '');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isPlatformAdmin = staff?.role === 'platform_admin';

  useEffect(() => {
    if (!showCreate || !isPlatformAdmin) return;
    setOwnersLoading(true);
    api.listOwners()
      .then((result) => {
        setOwners(result);
        // Default to the first owner so the dropdown never opens on a blank/invalid selection
        if (result[0] && !ownerId) setOwnerId(result[0].id);
      })
      .finally(() => setOwnersLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, isPlatformAdmin]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const resolvedOwnerId = isPlatformAdmin ? ownerId : staff?.ownerId;
    if (!resolvedOwnerId) {
      setError(isPlatformAdmin ? 'Choose an owner first.' : 'Your account has no owner assigned.');
      return;
    }

    setSaving(true);
    try {
      const site = await api.createSite({ ownerId: resolvedOwnerId, name, address: address || undefined });
      setName('');
      setAddress('');
      setShowCreate(false);
      await refresh();
      setCurrentSiteId(site.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create site');
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault();
    if (!editSite) return;
    setError(null);
    setSaving(true);
    try {
      await api.updateSite(editSite.id, { name, address: address || undefined });
      setEditSite(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update site');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(site: Site) {
    if (!confirm(`Delete "${site.name}"? This removes the site and everything under it — units, residents, devices, audit history. This can't be undone.`)) return;
    await api.deleteSite(site.id);
    await refresh();
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Building</div>
          <h1>Sites</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New site</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : sites.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No sites yet</span>
            Add your first building to start managing units and residents.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Directory privacy</th>
                <th>Panel setup code</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="muted">{s.address || '—'}</td>
                  <td>
                    {s.directoryPrivacyMode
                      ? <span className="badge badge-brass">Unit numbers only</span>
                      : <span className="badge badge-inactive">Full names</span>}
                  </td>
                  <td>
                    <SiteSetupCodeCell site={s} onChanged={refresh} />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setEditSite(s); setName(s.name); setAddress(s.address ?? ''); }}
                    >
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => handleDelete(s)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editSite && (
        <Modal title={`Edit ${editSite.name}`} onClose={() => setEditSite(null)}>
          <form onSubmit={handleEditSave}>
            <div className="field-group">
              <label className="field-label">Site name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="field-group">
              <label className="field-label">Address</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditSite(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showCreate && (
        <Modal title="New site" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            {isPlatformAdmin && (
              <div className="field-group">
                <label className="field-label">Owner</label>
                {ownersLoading ? (
                  <div className="muted" style={{ fontSize: 13.5 }}>Loading owners…</div>
                ) : owners.length === 0 ? (
                  <div className="error" style={{ fontSize: 13 }}>
                    No owners yet — create one on the Owners screen first.
                  </div>
                ) : (
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="field-group">
              <label className="field-label">Site name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Downtown Lofts" required autoFocus />
            </div>
            <div className="field-group">
              <label className="field-label">Address (optional)</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || (isPlatformAdmin && owners.length === 0)}>
                {saving ? 'Creating…' : 'Create site'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SiteSetupCodeCell({ site, onChanged }: { site: Site; onChanged: () => void }) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    if (site.panelSetupCode && !confirm('Regenerate this site\u2019s panel setup code? The old code stops working for any panel not yet paired.')) return;
    setRegenerating(true);
    try {
      await api.regenerateSiteSetupCode(site.id);
      onChanged();
    } finally {
      setRegenerating(false);
    }
  }

  if (!site.panelSetupCode) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={handleRegenerate} disabled={regenerating}>
        {regenerating ? '\u2026' : 'Generate code'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{site.panelSetupCode}</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => { navigator.clipboard.writeText(site.panelSetupCode!); }}
      >
        Copy
      </button>
      <button className="btn btn-ghost btn-sm" onClick={handleRegenerate} disabled={regenerating}>
        {regenerating ? '\u2026' : 'Regenerate'}
      </button>
    </div>
  );
}
