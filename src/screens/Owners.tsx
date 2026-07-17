import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Owner } from '../api/client';
import Modal from '../components/Modal';

export default function Owners() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editOwner, setEditOwner] = useState<Owner | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      setOwners(await api.listOwners());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load owners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createOwner({ name });
      setName('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create owner');
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!editOwner) return;
    setError(null);
    setSaving(true);
    try {
      await api.updateOwner(editOwner.id, { name });
      setEditOwner(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update owner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(owner: Owner) {
    if (!confirm(`Delete "${owner.name}"? This removes the owner account and everything under it — sites, units, residents. This can't be undone.`)) return;
    await api.deleteOwner(owner.id);
    await load();
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Platform</div>
          <h1>Building owners</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New owner</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : loadError ? (
          <div className="empty-state">
            <span className="eyebrow" style={{ color: 'var(--danger)' }}>Couldn't load owners</span>
            {loadError}
          </div>
        ) : owners.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No owners yet</span>
            Create your first building-owner account to get started.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subscription</th>
                <th>Mode</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>
                    <span className={`badge ${o.subscriptionStatus === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                      {o.subscriptionStatus}
                    </span>
                  </td>
                  <td>{o.demoMode ? <span className="badge badge-brass">Demo</span> : '—'}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditOwner(o); setName(o.name); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => handleDelete(o)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editOwner && (
        <Modal title={`Rename ${editOwner.name}`} onClose={() => setEditOwner(null)}>
          <form onSubmit={handleRename}>
            <div className="field-group">
              <label className="field-label">Company name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditOwner(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showCreate && (
        <Modal title="New building owner" subtitle="Billing rates default to $0 — set them up after creation." onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate}>
            <div className="field-group">
              <label className="field-label">Company name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Property Group" required autoFocus />
            </div>
            {error && <div className="error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create owner'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
