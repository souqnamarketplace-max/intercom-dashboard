import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type EntryPoint, type DeviceRow } from '../api/client';
import { useSites } from '../auth/SiteContext';
import Modal from '../components/Modal';

export default function Devices() {
  const { currentSiteId } = useSites();
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEntryPoint, setShowAddEntryPoint] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState<string | null>(null); // entryPointId
  const [editEntryPoint, setEditEntryPoint] = useState<EntryPoint | null>(null);
  const [revealedCode, setRevealedCode] = useState<{ serial: string; code: string } | null>(null);

  async function load() {
    if (!currentSiteId) return;
    setLoading(true);
    try {
      const [eps, devs] = await Promise.all([
        api.listEntryPoints(currentSiteId),
        api.listDevices(currentSiteId),
      ]);
      setEntryPoints(eps);
      setDevices(devs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentSiteId]);

  async function handleRegenerate(deviceId: string, serial: string) {
    if (!confirm('Regenerate this device\u2019s setup code? The old code stops working immediately \u2014 use this if the panel was reset or the code was shared somewhere it shouldn\u2019t be.')) return;
    const updated = await api.regenerateSetupCode(deviceId);
    if (updated.setupCode) setRevealedCode({ serial, code: updated.setupCode });
    load();
  }

  async function handleDeleteEntryPoint(ep: EntryPoint) {
    if (!confirm(`Delete entry point "${ep.name}"? This removes any panels/Pi controllers linked to it and their audit history. This can't be undone.`)) return;
    await api.deleteEntryPoint(ep.id);
    load();
  }

  async function handleDeleteDevice(device: DeviceRow) {
    if (!confirm(`Remove this device (${device.serialNumber})? It will need to be re-paired to work again.`)) return;
    await api.deleteDevice(device.id);
    load();
  }

  if (!currentSiteId) {
    return <div className="empty-state">Select a site to manage its devices.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Building</div>
          <h1>Devices</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddEntryPoint(true)}>+ Entry Point</button>
      </div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20 }}>
        Entry points and the panels/Pi controllers linked to each door.
      </p>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : entryPoints.length === 0 ? (
        <div className="empty-state">
          <span className="eyebrow">No entry points yet</span>
          A site can have multiple doors (lobby, garage, side gate…), each with its own panel.
        </div>
      ) : (
        entryPoints.map((ep) => {
          const epDevices = devices.filter((d) => d.entryPointId === ep.id);
          return (
            <div key={ep.id} className="table-card" style={{ marginBottom: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{ep.name}</h3>
                <div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDevice(ep.id)}>+ Device</button>
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => setEditEntryPoint(ep)}>Edit</button>
                  <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => handleDeleteEntryPoint(ep)}>Delete</button>
                </div>
              </div>

              {epDevices.length === 0 ? (
                <p className="muted" style={{ fontSize: 13.5 }}>No panel or Pi controller linked yet.</p>
              ) : (
                <table >
                  <thead>
                    <tr><th>Type</th><th>Serial</th><th>Status</th><th>Last seen</th><th>Setup</th><th /></tr>
                  </thead>
                  <tbody>
                    {epDevices.map((d) => (
                      <tr key={d.id}>
                        <td>{d.deviceType === 'panel' ? 'Panel' : 'Pi Controller'}</td>
                        <td className="muted">{d.serialNumber}</td>
                        <td>
                          <span className={`badge badge-${d.online ? 'active' : 'inactive'}`}>
                            {d.online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td className="muted">
                          {d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="muted">
                          {d.provisionedAt ? 'Provisioned' : 'Awaiting setup'}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRegenerate(d.id, d.serialNumber)}
                          >
                            {d.provisionedAt ? 'Re-pair' : 'Show code'}
                          </button>
                          <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => handleDeleteDevice(d)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })
      )}

      {showAddEntryPoint && (
        <AddEntryPointModal
          siteId={currentSiteId}
          onClose={() => setShowAddEntryPoint(false)}
          onCreated={load}
        />
      )}

      {showAddDevice && (
        <AddDeviceModal
          entryPointId={showAddDevice}
          onClose={() => setShowAddDevice(null)}
          onCreated={(created) => {
            if (created.setupCode) setRevealedCode({ serial: created.serialNumber, code: created.setupCode });
            load();
          }}
        />
      )}

      {editEntryPoint && (
        <EditEntryPointModal
          entryPoint={editEntryPoint}
          onClose={() => setEditEntryPoint(null)}
          onSaved={load}
        />
      )}

      {revealedCode && (
        <Modal
          title="Setup code"
          subtitle="Enter this once on the physical (or web) panel to link it to this entry point. It won't be shown again after the panel uses it."
          onClose={() => setRevealedCode(null)}
        >
          <div className="field-label">{revealedCode.serial}</div>
          <div className="key-reveal">{revealedCode.code}</div>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => { navigator.clipboard.writeText(revealedCode.code); }}
            >
              Copy code
            </button>
            <button className="btn btn-primary" onClick={() => setRevealedCode(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddEntryPointModal({
  siteId, onClose, onCreated,
}: { siteId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [openToAllZones, setOpenToAllZones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createEntryPoint({ siteId, name: name.trim(), openToAllZones });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create entry point');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Entry Point" subtitle="A physical door — lobby, garage, side gate, etc." onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="field-label">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Lobby" autoFocus />

        <label className="pass-row" style={{ marginTop: 12, cursor: 'pointer' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Open to all zones</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Every resident can access this door, regardless of zone — use for shared spaces like common parking.
            </div>
          </div>
          <input type="checkbox" checked={openToAllZones} onChange={(e) => setOpenToAllZones(e.target.checked)} />
        </label>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating\u2026' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditEntryPointModal({
  entryPoint, onClose, onSaved,
}: { entryPoint: EntryPoint; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(entryPoint.name);
  const [openToAllZones, setOpenToAllZones] = useState(entryPoint.openToAllZones ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateEntryPoint(entryPoint.id, { name: name.trim(), openToAllZones });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update entry point');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Entry Point" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="field-label">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <label className="pass-row" style={{ marginTop: 12, cursor: 'pointer' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Open to all zones</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Every resident can access this door, regardless of zone.
            </div>
          </div>
          <input type="checkbox" checked={openToAllZones} onChange={(e) => setOpenToAllZones(e.target.checked)} />
        </label>

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddDeviceModal({
  entryPointId, onClose, onCreated,
}: { entryPointId: string; onClose: () => void; onCreated: (d: DeviceRow) => void }) {
  const [deviceType, setDeviceType] = useState<'panel' | 'pi_controller'>('panel');
  const [serialNumber, setSerialNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createDevice({ entryPointId, deviceType, serialNumber: serialNumber.trim() });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create device');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New Device"
      subtitle="A setup code is generated immediately \u2014 you'll enter it once on the physical/web panel to pair it."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label className="field-label">Device type</label>
        <select value={deviceType} onChange={(e) => setDeviceType(e.target.value as 'panel' | 'pi_controller')}>
          <option value="panel">Panel (touchscreen)</option>
          <option value="pi_controller">Pi Controller (access board)</option>
        </select>

        <label className="field-label" style={{ marginTop: 12 }}>Serial number</label>
        <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. PANEL-0001" autoFocus />

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating\u2026' : 'Create & generate code'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
