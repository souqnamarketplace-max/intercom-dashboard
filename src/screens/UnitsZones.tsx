import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { api, ApiError, type Unit, type Zone, type Resident, type VirtualKey, type PassPreset, type EntryPoint } from '../api/client';
import { useSites } from '../auth/SiteContext';
import Modal from '../components/Modal';

// Formats a Date for a <input type="datetime-local"> value in local time —
// used to default Starts/Ends to "now" instead of a blank field.
function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function UnitsZones() {
  const { currentSiteId } = useSites();
  const [units, setUnits] = useState<Unit[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [showAddZone, setShowAddZone] = useState(false);
  const [showZoneAccess, setShowZoneAccess] = useState<Zone | null>(null);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneSaving, setZoneSaving] = useState(false);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [showAddResident, setShowAddResident] = useState<string | null>(null); // unitId
  const [showPasses, setShowPasses] = useState<Unit | null>(null);

  async function load() {
    if (!currentSiteId) return;
    setLoading(true);
    try {
      const [u, z] = await Promise.all([api.listUnits(currentSiteId), api.listZones(currentSiteId)]);
      setUnits(u);
      setZones(z);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [currentSiteId]);

  async function handleZoneAssign(unitId: string, zoneId: string) {
    await api.updateUnit(unitId, { zoneId: zoneId || null });
    await load();
  }

  async function handleZoneRename(e: FormEvent) {
    e.preventDefault();
    if (!editZone) return;
    setZoneError(null);
    setZoneSaving(true);
    try {
      await api.updateZone(editZone.id, { name: zoneName });
      setEditZone(null);
      await load();
    } catch (err) {
      setZoneError(err instanceof ApiError ? err.message : 'Could not rename zone');
    } finally {
      setZoneSaving(false);
    }
  }

  async function handleZoneDelete(zone: Zone) {
    if (!confirm(`Delete zone "${zone.name}"? Units in this zone will become unassigned. This can't be undone.`)) return;
    await api.deleteZone(zone.id);
    await load();
  }

  if (!currentSiteId) {
    return <div className="empty-state"><span className="eyebrow">No site selected</span>Choose or create a site first.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Building</div>
          <h1>Units & Zones</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setShowAddZone(true)}>+ Zone</button>
          <button className="btn btn-primary" onClick={() => setShowAddUnit(true)}>+ Unit</button>
        </div>
      </div>

      {zones.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 className="section-title">Zones</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {zones.map((z) => (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="badge badge-brass"
                  style={{ fontSize: 12, padding: '6px 12px', cursor: 'pointer', border: 'none' }}
                  onClick={() => setShowZoneAccess(z)}
                >
                  {z.name} · {units.filter((u) => u.zoneId === z.id).length} units · {(z.entryPoints ?? []).length} doors
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px 8px' }}
                  onClick={() => { setEditZone(z); setZoneName(z.name); }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  style={{ padding: '4px 8px' }}
                  onClick={() => handleZoneDelete(z)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="section-title">Units</h2>
      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : units.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No units yet</span>
            Add your first unit to start linking residents.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Zone</th>
                <th>Residents</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <UnitRow
                  key={u.id}
                  unit={u}
                  zones={zones}
                  expanded={expandedUnit === u.id}
                  onToggle={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}
                  onZoneChange={(zoneId) => handleZoneAssign(u.id, zoneId)}
                  onAddResident={() => setShowAddResident(u.id)}
                  onResidentChanged={load}
                  onManagePasses={() => setShowPasses(u)}
                  onDelete={async () => {
                    if (!confirm(`Delete unit ${u.unitNumber}? This removes it and all linked residents. This can't be undone.`)) return;
                    await api.deleteUnit(u.id);
                    await load();
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddUnit && (
        <AddUnitModal siteId={currentSiteId} onClose={() => setShowAddUnit(false)} onCreated={load} />
      )}
      {showAddZone && (
        <AddZoneModal siteId={currentSiteId} onClose={() => setShowAddZone(false)} onCreated={load} />
      )}
      {showZoneAccess && (
        <ZoneAccessModal zone={showZoneAccess} siteId={currentSiteId} onClose={() => setShowZoneAccess(null)} onSaved={load} />
      )}
      {editZone && (
        <Modal title={`Rename ${editZone.name}`} onClose={() => setEditZone(null)}>
          <form onSubmit={handleZoneRename}>
            <div className="field-group">
              <label className="field-label">Zone name</label>
              <input value={zoneName} onChange={(e) => setZoneName(e.target.value)} required autoFocus />
            </div>
            {zoneError && <div className="error">{zoneError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditZone(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={zoneSaving}>{zoneSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
      {showAddResident && (
        <AddResidentModal unitId={showAddResident} onClose={() => setShowAddResident(null)} onCreated={load} />
      )}
      {showPasses && (
        <PassesModal unit={showPasses} onClose={() => setShowPasses(null)} />
      )}
    </div>
  );
}

function UnitRow({
  unit, zones, expanded, onToggle, onZoneChange, onAddResident, onResidentChanged, onManagePasses, onDelete,
}: {
  unit: Unit; zones: Zone[]; expanded: boolean; onToggle: () => void;
  onZoneChange: (zoneId: string) => void; onAddResident: () => void; onResidentChanged: () => void;
  onManagePasses: () => void; onDelete: () => void;
}) {
  const residentCount = unit.residents?.filter((r) => r.status !== 'deleted').length ?? 0;

  return (
    <>
      <tr>
        <td>
          <button className="btn btn-ghost btn-sm" onClick={onToggle} style={{ marginRight: 8 }}>
            {expanded ? '▾' : '▸'}
          </button>
          {unit.unitNumber}
        </td>
        <td>
          <select value={unit.zoneId ?? ''} onChange={(e) => onZoneChange(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="">No zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </td>
        <td className="muted">{residentCount} resident{residentCount === 1 ? '' : 's'}</td>
        <td>
          <button className="btn btn-ghost btn-sm" onClick={onAddResident}>+ Resident</button>
          <button className="btn btn-ghost btn-sm" onClick={onManagePasses} style={{ marginLeft: 6 }}>Passes</button>
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={onDelete}>Delete</button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ background: 'var(--ink)', padding: 0 }}>
            <ResidentsList unit={unit} onChanged={onResidentChanged} />
          </td>
        </tr>
      )}
    </>
  );
}

function QRViewModal({
  recipientName, token, onClose,
}: { recipientName: string; token: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, token, { width: 320, margin: 3, errorCorrectionLevel: 'M' });
    }
  }, [token]);

  function getBlob(): Promise<Blob | null> {
    return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), 'image/png'));
  }

  async function handleDownload() {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-pass-${recipientName}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal title={`Visitor Pass \u2014 ${recipientName}`} onClose={onClose}>
      <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />
      <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 12 }}>
        Send this to {recipientName} to scan at the panel, or download it below.
      </p>
      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn btn-ghost" onClick={handleDownload}>Download</button>
        <button className="btn btn-primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}

function PassesModal({ unit, onClose }: { unit: Unit; onClose: () => void }) {
  const [keys, setKeys] = useState<VirtualKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState<'qr' | 'pin' | null>(null);
  const [revealedPin, setRevealedPin] = useState<{ recipientName: string; code: string } | null>(null);
  const [viewingQr, setViewingQr] = useState<{ recipientName: string; token: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setKeys(await api.listVirtualKeys(unit.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [unit.id]);

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this pass? It stops working immediately.')) return;
    await api.revokeVirtualKey(id);
    load();
  }

  return (
    <Modal
      title={`Passes — Unit ${unit.unitNumber}`}
      subtitle="Visitor Passes are scanned as a QR at the panel camera. Delivery Passes are typed as a PIN on the panel keypad."
      onClose={onClose}
    >
      <div className="modal-actions" style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate('qr')}>+ Visitor Pass (QR)</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate('pin')}>+ Delivery Pass (PIN)</button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="muted">No passes issued yet for this unit.</p>
      ) : (
        <table >
          <thead>
            <tr><th>Recipient</th><th>Type</th><th>Status</th><th>Expires</th><th /></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr
                key={k.id}
                style={{ cursor: k.accessMethod === 'qr' && k.status === 'active' ? 'pointer' : 'default' }}
                onClick={() => {
                  if (k.accessMethod === 'qr' && k.status === 'active') {
                    setViewingQr({ recipientName: k.recipientName, token: k.signedToken });
                  }
                }}
              >
                <td>{k.recipientName}</td>
                <td className="muted">{k.accessMethod === 'qr' ? 'Visitor (QR)' : 'Delivery (PIN)'}</td>
                <td>
                  <span className={`badge badge-${k.status === 'active' ? 'active' : 'inactive'}`}>{k.status}</span>
                </td>
                <td className="muted">{k.expiresAt ? new Date(k.expiresAt).toLocaleString() : 'No expiry'}</td>
                <td>
                  {k.status === 'active' && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleRevoke(k.id); }}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreatePassModal
          unit={unit}
          accessMethod={showCreate}
          onClose={() => setShowCreate(null)}
          onCreated={(created) => {
            if (created.accessMethod === 'pin' && created.rawShortCode) {
              setRevealedPin({ recipientName: created.recipientName, code: created.rawShortCode });
            } else if (created.accessMethod === 'qr') {
              setViewingQr({ recipientName: created.recipientName, token: created.signedToken });
            }
            load();
          }}
        />
      )}

      {viewingQr && (
        <QRViewModal
          recipientName={viewingQr.recipientName}
          token={viewingQr.token}
          onClose={() => setViewingQr(null)}
        />
      )}

      {revealedPin && (
        <Modal
          title="Delivery Pass created"
          subtitle="Copy this now — the code is never shown again after this."
          onClose={() => setRevealedPin(null)}
        >
          <div className="field-label">{revealedPin.recipientName}</div>
          <div className="key-reveal">{revealedPin.code}</div>
          <p className="muted" style={{ fontSize: 13 }}>
            Share this PIN with the carrier — they'll enter it on the panel's keypad.
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-ghost"
              onClick={() => { navigator.clipboard.writeText(revealedPin.code); }}
            >
              Copy code
            </button>
            <button className="btn btn-primary" onClick={() => setRevealedPin(null)}>Done</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

const PRESETS: { value: PassPreset; label: string; blurb: string }[] = [
  { value: 'custom', label: 'Custom Duration', blurb: 'Exact start and end time' },
  { value: 'recurring', label: 'Recurring Access', blurb: 'Repeats on chosen days/times' },
  { value: 'business_hours', label: 'Business Hours', blurb: 'Mon\u2013Fri, 9am\u20135pm' },
  { value: 'full_day', label: 'Full-Day Use', blurb: 'Active any time, until revoked' },
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CreatePassModal({
  unit, accessMethod, onClose, onCreated,
}: {
  unit: Unit; accessMethod: 'qr' | 'pin'; onClose: () => void; onCreated: (k: VirtualKey) => void;
}) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [preset, setPreset] = useState<PassPreset>('custom');
  const [activatesAt, setActivatesAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [expiresAt, setExpiresAt] = useState(() => toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!recipientName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createVirtualKey({
        unitId: unit.id,
        siteId: unit.siteId,
        recipientName: recipientName.trim(),
        recipientContact: recipientContact.trim() || undefined,
        keyType: accessMethod === 'qr' ? (preset === 'recurring' ? 'recurring' : 'single_use') : 'delivery',
        accessMethod,
        preset,
        activatesAt: (preset === 'custom' || preset === 'recurring') && activatesAt ? new Date(activatesAt).toISOString() : undefined,
        expiresAt: preset !== 'full_day' && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        schedule: preset === 'recurring' ? { daysOfWeek, timeStart, timeEnd } : undefined,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create pass');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={accessMethod === 'qr' ? 'New Visitor Pass (QR)' : 'New Delivery Pass (PIN)'}
      subtitle={accessMethod === 'qr'
        ? 'Generates a scannable QR code, sent to the recipient.'
        : 'Generates a one-time numeric code for the panel keypad.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label className="field-label">Choose a preset</label>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.value}
              className={`preset-tile${preset === p.value ? ' selected' : ''}`}
              onClick={() => setPreset(p.value)}
            >
              <span className="preset-label">{p.label}</span>
              <span className="preset-blurb">{p.blurb}</span>
            </button>
          ))}
        </div>

        <label className="field-label" style={{ marginTop: 16 }}>Recipient name</label>
        <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. Dog walker, DHL" />

        {accessMethod === 'qr' && (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>Send to (phone or email)</label>
            <input value={recipientContact} onChange={(e) => setRecipientContact(e.target.value)} placeholder="Optional" />
          </>
        )}

        {(preset === 'custom' || preset === 'recurring') && (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>Starts</label>
            <input type="datetime-local" value={activatesAt} onChange={(e) => setActivatesAt(e.target.value)} />
          </>
        )}

        {preset !== 'full_day' && (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>
              {preset === 'recurring' ? 'Ends (optional)' : 'Ends'}
            </label>
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </>
        )}

        {preset === 'recurring' && (
          <>
            <label className="field-label" style={{ marginTop: 12 }}>Days</label>
            <div className="day-picker">
              {DAY_LABELS.map((label, i) => (
                <button
                  type="button"
                  key={label}
                  className={`day-chip${daysOfWeek.includes(i) ? ' selected' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">From</label>
                <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Until</label>
                <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
              </div>
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Generate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ZoneAccessModal({
  zone, siteId, onClose, onSaved,
}: { zone: Zone; siteId: string; onClose: () => void; onSaved: () => void }) {
  const [entryPoints, setEntryPoints] = useState<EntryPoint[]>([]);
  const [selected, setSelected] = useState<string[]>((zone.entryPoints ?? []).map((za) => za.entryPoint.id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listEntryPoints(siteId).then(setEntryPoints).finally(() => setLoading(false));
  }, [siteId]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.setZoneEntryPointAccess(zone.id, selected);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save door access');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Door access — ${zone.name}`}
      subtitle="Residents in this zone can also reach any door marked \u201copen to all zones\u201d automatically."
      onClose={onClose}
    >
      {loading ? (
        <p className="muted">Loading\u2026</p>
      ) : entryPoints.length === 0 ? (
        <p className="muted">No entry points on this site yet \u2014 create one on the Devices screen first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entryPoints.map((ep) => (
            <label key={ep.id} className="pass-row" style={{ cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ep.name}</div>
                {ep.openToAllZones && (
                  <div className="muted" style={{ fontSize: 12 }}>Already open to all zones</div>
                )}
              </div>
              <input
                type="checkbox"
                checked={ep.openToAllZones || selected.includes(ep.id)}
                disabled={ep.openToAllZones}
                onChange={() => toggle(ep.id)}
              />
            </label>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving\u2026' : 'Save access'}
        </button>
      </div>
    </Modal>
  );
}

function ResidentsList({ unit, onChanged }: { unit: Unit; onChanged: () => void }) {
  const residents = unit.residents ?? [];

  async function handleAction(id: string, action: 'suspend' | 'reactivate' | 'move-out') {
    if (action === 'move-out' && !confirm('Move out this resident? This permanently revokes their access and any virtual keys they issued.')) return;
    if (action === 'suspend') await api.suspendResident(id);
    if (action === 'reactivate') await api.reactivateResident(id);
    if (action === 'move-out') await api.moveOutResident(id);
    onChanged();
  }

  if (residents.length === 0) {
    return <div className="empty-state" style={{ padding: 20 }}>No residents linked to this unit yet.</div>;
  }

  return (
    <div style={{ padding: '4px 16px 16px' }}>
      {residents.map((r) => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{r.email || r.phone || '—'}</div>
            {r.inviteCode && !r.appAccountCreated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Invite code: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{r.inviteCode}</span>
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { navigator.clipboard.writeText(r.inviteCode!); }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ResidentStatusBadge status={r.status} />
            {r.status === 'active' && (
              <button className="btn btn-ghost btn-sm" onClick={() => handleAction(r.id, 'suspend')}>Suspend</button>
            )}
            {r.status === 'suspended' && (
              <button className="btn btn-ghost btn-sm" onClick={() => handleAction(r.id, 'reactivate')}>Reactivate</button>
            )}
            {r.status !== 'deleted' && (
              <button className="btn btn-danger btn-sm" onClick={() => handleAction(r.id, 'move-out')}>Move out</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResidentStatusBadge({ status }: { status: Resident['status'] }) {
  if (status === 'active') return <span className="badge badge-active">Active</span>;
  if (status === 'suspended') return <span className="badge badge-inactive">Suspended</span>;
  return <span className="badge badge-danger">Moved out</span>;
}

function AddUnitModal({ siteId, onClose, onCreated }: { siteId: string; onClose: () => void; onCreated: () => void }) {
  const [unitNumber, setUnitNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createUnit({ siteId, unitNumber });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create unit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New unit" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Unit number</label>
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="4B" required autoFocus />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add unit'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddZoneModal({ siteId, onClose, onCreated }: { siteId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createZone({ siteId, name });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create zone');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New zone" subtitle="Groups units for delivery and access scoping — separate from physical entry points." onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Zone name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="North Tower" required autoFocus />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add zone'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddResidentModal({ unitId, onClose, onCreated }: { unitId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createResident({ unitId, name, email: email || undefined, phone: phone || undefined });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add resident');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add resident" subtitle="They'll get an invite code to log into the resident app." onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label className="field-label">Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" required autoFocus />
        </div>
        <div className="field-group">
          <label className="field-label">Email (optional)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jordan@email.com" />
        </div>
        <div className="field-group">
          <label className="field-label">Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 010 1234" />
        </div>
        {error && <div className="error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add resident'}</button>
        </div>
      </form>
    </Modal>
  );
}
