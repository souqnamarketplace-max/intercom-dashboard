import { useEffect, useState } from 'react';
import { api, type AuditEvent } from '../api/client';
import { useSites } from '../auth/SiteContext';

const EVENT_LABELS: Record<string, string> = {
  call_answered: 'Call answered',
  call_missed: 'Call missed',
  call_declined: 'Call declined',
  unlock_app: 'Unlocked via app',
  unlock_pin: 'Unlocked via PIN',
  unlock_virtual_key: 'Unlocked via virtual key',
  unlock_card_fob: 'Unlocked via card/fob',
  unlock_admin_override: 'Admin override',
  fire_alarm_triggered: 'Fire alarm triggered',
  device_offline: 'Device went offline',
  device_online: 'Device came online',
  failed_pin_attempt: 'Failed PIN attempt',
  failed_fob_attempt: 'Failed fob attempt',
  config_changed: 'Configuration changed',
};

export default function AuditTrail() {
  const { currentSiteId } = useSites();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function load() {
    if (!currentSiteId) return;
    setLoading(true);
    setEvents([]);
    setCursor(null);
    try {
      const res = await api.listAuditEvents(currentSiteId);
      setEvents(res.events);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!currentSiteId || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await api.listAuditEvents(currentSiteId, cursor);
      setEvents((prev) => [...prev, ...res.events]);
      setCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, [currentSiteId]);

  if (!currentSiteId) {
    return <div className="empty-state"><span className="eyebrow">No site selected</span>Choose or create a site first.</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Activity</div>
          <h1>Audit trail</h1>
        </div>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <span className="eyebrow">No events yet</span>
            Calls, unlocks, and device activity for this site will show up here.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Method</th>
                <th>Result</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => {
                const isRecent = Date.now() - new Date(e.createdAt).getTime() < 86_400_000;
                return (
                  <tr key={e.id} className={isRecent && i === 0 ? 'is-new' : ''}>
                    <td>{EVENT_LABELS[e.eventType] ?? e.eventType}</td>
                    <td className="muted">{e.method ?? '—'}</td>
                    <td>
                      <span className={`badge ${e.result === 'success' ? 'badge-active' : 'badge-danger'}`}>
                        {e.result}
                      </span>
                    </td>
                    <td className="muted">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {cursor && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
