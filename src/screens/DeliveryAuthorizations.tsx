import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type DeliveryAuthorization } from '../api/client';
import { useSites } from '../auth/SiteContext';
import Modal from '../components/Modal';

const COMMON_CARRIERS = ['DHL', 'Amazon', 'USPS', 'UPS', 'FedEx'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function DeliveryAuthorizations() {
  const { currentSiteId } = useSites();
  const [items, setItems] = useState<DeliveryAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!currentSiteId) return;
    setLoading(true);
    try {
      setItems(await api.listDeliveryAuthorizations(currentSiteId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentSiteId]);

  async function toggleActive(item: DeliveryAuthorization) {
    await api.updateDeliveryAuthorization(item.id, { active: !item.active });
    await load();
  }

  async function remove(item: DeliveryAuthorization) {
    if (!confirm(`Remove the delivery PIN for ${item.carrierName}?`)) return;
    await api.deleteDeliveryAuthorization(item.id);
    await load();
  }

  function describeWindow(w: DeliveryAuthorization['timeWindow']) {
    if (!w || w.openAllDay) return 'Open all day';
    const days = (w.days ?? []).map((d) => d[0].toUpperCase() + d.slice(1, 3)).join(' ');
    return `${days || 'Every day'} · ${w.from ?? '—'}–${w.to ?? '—'}`;
  }

  if (!currentSiteId) {
    return <div className="empty-state"><span className="eyebrow">No site selected</span>Choose or create a site first.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Access</div>
          <h1>Delivery Authorizations</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New carrier PIN</button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No delivery PINs yet</span>
            Add a PIN for DHL, Amazon, USPS, or any other regular carrier.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Carrier</th>
                <th>Delivery window</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.carrierName}</td>
                  <td className="muted">{describeWindow(d.timeWindow)}</td>
                  <td>
                    {d.active
                      ? <span className="badge badge-active">Active</span>
                      : <span className="badge badge-inactive">Disabled</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(d)}>
                      {d.active ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(d)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateModal siteId={currentSiteId} onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}

function CreateModal({ siteId, onClose, onCreated }: { siteId: string; onClose: () => void; onCreated: () => void }) {
  const [carrierName, setCarrierName] = useState('');
  const [rawPin, setRawPin] = useState('');
  const [openAllDay, setOpenAllDay] = useState(true);
  const [days, setDays] = useState<string[]>([]);
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('17:00');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createDeliveryAuthorization({
        siteId,
        carrierName,
        rawPin,
        timeWindow: openAllDay ? { openAllDay: true } : { openAllDay: false, days, from, to },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create delivery authorization');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New carrier PIN" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Carrier</label>
          <input
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="e.g. FedEx"
            list="common-carriers"
            required
            autoFocus
          />
          <datalist id="common-carriers">
            {COMMON_CARRIERS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="field-group">
          <label className="field-label">PIN</label>
          <input value={rawPin} onChange={(e) => setRawPin(e.target.value)} placeholder="4–8 digits" required />
        </div>

        <div className="field-group">
          <label className="scope-item">
            <input type="checkbox" checked={openAllDay} onChange={(e) => setOpenAllDay(e.target.checked)} />
            Open all day, every day
          </label>
        </div>

        {!openAllDay && (
          <>
            <div className="field-group">
              <label className="field-label">Days</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`btn btn-sm ${days.includes(d) ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">From</label>
                <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">To</label>
                <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add PIN'}</button>
        </div>
      </form>
    </Modal>
  );
}
