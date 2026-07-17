import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Account() {
  const { staff } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const usingDefaultPassword = staff?.email === 'admin@example.com';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Your account</h1>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <span className="field-label" style={{ display: 'inline' }}>Signed in as</span>{' '}
        <span style={{ color: 'var(--bone)' }}>{staff?.email}</span>
      </div>

      {usingDefaultPassword && (
        <div className="error" style={{ maxWidth: 480 }}>
          You're signed in as the default seed account. If you haven't changed this
          password yet, do it now — this account has platform-admin access to every
          owner's data.
        </div>
      )}

      <div className="table-card" style={{ maxWidth: 420, padding: 24 }}>
        <h2 className="section-title">Change password</h2>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field-group">
            <label className="field-label">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field-group">
            <label className="field-label">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success-banner">Password updated.</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={saving} style={{ marginTop: 6 }}>
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
