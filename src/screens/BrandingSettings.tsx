import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Unit } from '../api/client';
import { useSites } from '../auth/SiteContext';

const BUTTON_KEYS: { key: string; defaultLabel: string }[] = [
  { key: 'directory', defaultLabel: 'People Directory' },
  { key: 'virtualKey', defaultLabel: 'Virtual Key' },
  { key: 'doorPin', defaultLabel: 'Door PIN' },
  { key: 'deliveryPin', defaultLabel: 'Delivery PIN' },
];

interface FlatResident { id: string; name: string; unitNumber: string; }

export default function BrandingSettings() {
  const { sites, currentSiteId, refresh } = useSites();
  const site = sites.find((s) => s.id === currentSiteId);

  const [brandingLogoUrl, setBrandingLogoUrl] = useState('');
  const [buildingInfo, setBuildingInfo] = useState('');
  const [frontDeskResidentId, setFrontDeskResidentId] = useState('');
  const [frontDeskLabel, setFrontDeskLabel] = useState('Front Desk');
  const [buttonLabels, setButtonLabels] = useState<Record<string, string>>({});
  const [panelSettingsPin, setPanelSettingsPin] = useState('1234');
  const [securityTileEnabled, setSecurityTileEnabled] = useState(false);
  const [screensaverType, setScreensaverType] = useState<string | null>(null);
  const [screensaverDelay, setScreensaverDelay] = useState(20);
  const [screensaverUrl, setScreensaverUrl] = useState<string | null>(null);
  const [screensaverUploading, setScreensaverUploading] = useState(false);
  const [screensaverError, setScreensaverError] = useState<string | null>(null);

  const [residents, setResidents] = useState<FlatResident[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync form state whenever the selected site changes
  useEffect(() => {
    if (!site) return;
    setBrandingLogoUrl(site.brandingLogoUrl ?? '');
    setBuildingInfo(site.buildingInfo ?? '');
    setFrontDeskResidentId(site.frontDeskResidentId ?? '');
    setFrontDeskLabel(site.frontDeskLabel ?? 'Front Desk');
    setButtonLabels(site.customButtonLabels ?? {});
    setPanelSettingsPin(site.panelSettingsPin ?? '1234');
    setSecurityTileEnabled(site.securityTileEnabled ?? false);
    setScreensaverType(site.screensaverType ?? null);
    setScreensaverDelay(site.screensaverDelaySeconds ?? 20);
    setScreensaverUrl(site.screensaverUrl ?? null);
  }, [site?.id]);

  useEffect(() => {
    if (!currentSiteId) return;
    setResidentsLoading(true);
    api.listUnits(currentSiteId)
      .then((units: Unit[]) => {
        const flat: FlatResident[] = [];
        for (const u of units) {
          for (const r of u.residents ?? []) {
            if (r.status === 'active') flat.push({ id: r.id, name: r.name, unitNumber: u.unitNumber });
          }
        }
        setResidents(flat);
      })
      .finally(() => setResidentsLoading(false));
  }, [currentSiteId]);

  async function handleScreensaverFile(file: File) {
    setScreensaverError(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setScreensaverError('Choose an image or video file.');
      return;
    }
    // 20MB cap - generous for a short looping clip, but a real deployment
    // should move this to real blob storage rather than a data URL in the
    // database (flagged in the schema comment too).
    if (file.size > 20 * 1024 * 1024) {
      setScreensaverError('File is too large - keep it under 20MB.');
      return;
    }
    if (!currentSiteId) return;

    setScreensaverUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(file);
      });
      const type = isVideo ? 'video' : 'image';
      await api.updateSite(currentSiteId, { screensaverType: type, screensaverUrl: dataUrl });
      setScreensaverType(type);
      setScreensaverUrl(dataUrl);
      await refresh();
    } catch {
      setScreensaverError('Upload failed - try again.');
    } finally {
      setScreensaverUploading(false);
    }
  }

  async function handleRemoveScreensaver() {
    if (!currentSiteId) return;
    setScreensaverUploading(true);
    try {
      await api.updateSite(currentSiteId, { screensaverType: '', screensaverUrl: '' });
      setScreensaverType(null);
      setScreensaverUrl(null);
      await refresh();
    } finally {
      setScreensaverUploading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!currentSiteId) return;
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await api.updateSite(currentSiteId, {
        brandingLogoUrl: brandingLogoUrl || undefined,
        buildingInfo: buildingInfo || undefined,
        frontDeskResidentId: frontDeskResidentId || null,
        frontDeskLabel,
        customButtonLabels: buttonLabels,
        panelSettingsPin,
        securityTileEnabled,
        screensaverDelaySeconds: screensaverDelay,
      });
      await refresh();
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  if (!currentSiteId || !site) {
    return <div className="empty-state"><span className="eyebrow">No site selected</span>Choose or create a site first.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Building</div>
          <h1>Branding & Panel Settings</h1>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 24, maxWidth: 640 }}>
        Controls what the physical intercom panel at this site shows and does —
        its idle-screen branding, the Front Desk button's destination, button
        labels, and the PIN staff use to access the panel's own settings menu.
      </p>

      <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
        <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 className="section-title">Branding</h2>
          <div className="field-group">
            <label className="field-label">Logo URL</label>
            <input
              value={brandingLogoUrl}
              onChange={(e) => setBrandingLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
            />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Shown on the panel's idle screen. Paste a hosted image URL — direct
              file upload isn't wired up yet.
            </p>
          </div>
          <div className="field-group">
            <label className="field-label">Building info / announcements</label>
            <textarea
              value={buildingInfo}
              onChange={(e) => setBuildingInfo(e.target.value)}
              rows={4}
              placeholder="e.g. Lobby under construction through August. Package room is now on the 2nd floor."
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 className="section-title">Front Desk Button</h2>
          <div className="field-group">
            <label className="field-label">Button label</label>
            <input value={frontDeskLabel} onChange={(e) => setFrontDeskLabel(e.target.value)} placeholder="Front Desk" />
          </div>
          <div className="field-group">
            <label className="field-label">Calls</label>
            {residentsLoading ? (
              <p className="muted" style={{ fontSize: 13.5 }}>Loading residents…</p>
            ) : (
              <select value={frontDeskResidentId} onChange={(e) => setFrontDeskResidentId(e.target.value)}>
                <option value="">Not configured</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} — Unit {r.unitNumber}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 className="section-title">Button Labels</h2>
          {BUTTON_KEYS.map(({ key, defaultLabel }) => (
            <div className="field-group" key={key}>
              <label className="field-label">{defaultLabel}</label>
              <input
                value={buttonLabels[key] ?? ''}
                onChange={(e) => setButtonLabels((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={defaultLabel}
              />
            </div>
          ))}
        </div>

        <div className="table-card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 className="section-title">Panel Access</h2>
          <div className="field-group">
            <label className="field-label">Settings PIN</label>
            <input
              value={panelSettingsPin}
              onChange={(e) => setPanelSettingsPin(e.target.value)}
              maxLength={8}
              placeholder="1234"
            />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
              Required on the panel itself to open its Settings screen (brightness, volume, network).
            </p>
          </div>
          <label className="pass-row" style={{ marginTop: 12, cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Show Security tile on panel</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Currently a placeholder — no real multi-camera integration yet. Off by default.
              </div>
            </div>
            <input
              type="checkbox"
              checked={securityTileEnabled}
              onChange={(e) => setSecurityTileEnabled(e.target.checked)}
            />
          </label>
        </div>

        <div style={{ marginTop: 16, marginBottom: 20, padding: 16, border: '1px solid var(--line)', borderRadius: 10 }}>
          <h3 style={{ marginTop: 0 }}>Panel Screensaver</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            Shown on the panel when idle, in place of the default logo + clock.
            Upload an image or a short looping video - it fills the screen at
            whatever size the panel's display is, so no need to match a specific resolution.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Show screensaver after</label>
            <select
              value={screensaverDelay}
              onChange={(e) => setScreensaverDelay(Number(e.target.value))}
              style={{ maxWidth: 200 }}
            >
              <option value={10}>10 seconds idle</option>
              <option value={20}>20 seconds idle</option>
              <option value={30}>30 seconds idle</option>
              <option value={60}>1 minute idle</option>
              <option value={120}>2 minutes idle</option>
            </select>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              A tap anywhere on the panel, or detected motion, resets this timer immediately.
            </p>
          </div>

          {screensaverUrl && (
            <div style={{ margin: '12px 0', borderRadius: 10, overflow: 'hidden', maxWidth: 280, border: '1px solid var(--line)' }}>
              {screensaverType === 'video' ? (
                <video src={screensaverUrl} muted loop autoPlay style={{ width: '100%', display: 'block' }} />
              ) : (
                <img src={screensaverUrl} alt="Screensaver preview" style={{ width: '100%', display: 'block' }} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
              {screensaverUploading ? 'Uploading…' : screensaverUrl ? 'Replace' : 'Upload image or video'}
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                disabled={screensaverUploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScreensaverFile(f); e.target.value = ''; }}
              />
            </label>
            {screensaverUrl && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={screensaverUploading}
                onClick={handleRemoveScreensaver}
              >
                Remove
              </button>
            )}
          </div>
          {screensaverError && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8 }}>{screensaverError}</p>}
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success-banner">Settings saved.</div>}

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
