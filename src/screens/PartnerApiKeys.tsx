import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, PARTNER_API_SCOPES, type PartnerApiKey } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import Modal from '../components/Modal';

export default function PartnerApiKeys() {
  const { staff } = useAuth();
  const ownerId = staff?.ownerId ?? '';
  const [keys, setKeys] = useState<PartnerApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ name: string; apiKey: string } | null>(null);

  async function load() {
    if (!ownerId) return;
    setLoading(true);
    try {
      setKeys(await api.listPartnerApiKeys(ownerId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [ownerId]);

  async function handleRevoke(key: PartnerApiKey) {
    if (!confirm(`Revoke "${key.name}"? Any integration using this key will stop working immediately.`)) return;
    await api.revokePartnerApiKey(key.id);
    await load();
  }

  if (!ownerId) {
    return (
      <div className="empty-state">
        <span className="eyebrow">Platform admin</span>
        Partner API keys belong to a specific owner — select an owner account first.
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Integrations</div>
          <h1>Partner API Keys</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New key</button>
      </div>

      <p className="muted" style={{ marginBottom: 20, maxWidth: 640 }}>
        Issue scoped credentials so external systems — Yardi, a CCTV/VMS vendor, another access-control
        platform — can call into this data on your behalf. This is the reverse of a normal integration:
        they call us, not the other way around. Each key only sees the scopes you grant it.
      </p>

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No partner keys yet</span>
            Issue one when a third party needs to read or sync data with this platform.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td className="muted" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
                    {k.keyPrefix}…
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {k.scopes.map((s) => (
                        <span key={s} className="badge badge-brass" style={{ fontSize: 10 }}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                  <td>
                    {k.revokedAt
                      ? <span className="badge badge-danger">Revoked</span>
                      : <span className="badge badge-active">Active</span>}
                  </td>
                  <td>
                    {!k.revokedAt && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleRevoke(k)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateKeyModal
          ownerId={ownerId}
          onClose={() => setShowCreate(false)}
          onCreated={(created) => {
            setRevealedKey({ name: created.name, apiKey: created.apiKey });
            load();
          }}
        />
      )}

      {revealedKey && (
        <Modal title="Key created" subtitle="Copy this now — it will never be shown again." onClose={() => setRevealedKey(null)}>
          <div className="field-label">{revealedKey.name}</div>
          <div className="key-reveal">{revealedKey.apiKey}</div>
          <p className="muted" style={{ fontSize: 13 }}>
            Give this to the integrator to use in the <code>X-API-Key</code> header when calling{' '}
            <code>/partner-api/v1/*</code>.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => { navigator.clipboard.writeText(revealedKey.apiKey); }}
            >
              Copy key
            </button>
            <button className="btn btn-primary" onClick={() => setRevealedKey(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateKeyModal({
  ownerId, onClose, onCreated,
}: { ownerId: string; onClose: () => void; onCreated: (k: { name: string; apiKey: string }) => void }) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (scopes.length === 0) { setError('Select at least one scope.'); return; }
    setSaving(true);
    try {
      const created = await api.createPartnerApiKey({ ownerId, name, scopes });
      onCreated({ name: created.name, apiKey: created.apiKey });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create key');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New partner API key" subtitle="Grant only what the integrator actually needs." onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Label</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yardi PMS sync" required autoFocus />
        </div>
        <div className="field-group">
          <label className="field-label">Scopes</label>
          <div className="scope-list">
            {PARTNER_API_SCOPES.map((s) => (
              <label key={s} className="scope-item">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>{s}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create key'}</button>
        </div>
      </form>
    </Modal>
  );
}
