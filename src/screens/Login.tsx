import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/sites');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Try again.');
    }
  }

  return (
    <div className="login-shell">
      <div className="keyplate">
        <div className="center">
          <div className="divider" />
          <p className="eyebrow">Staff Access</p>
          <h1 style={{ marginBottom: 6 }}>Sign in to the dashboard</h1>
          <p className="muted" style={{ marginBottom: 24 }}>
            Manage buildings, residents, and access from one place.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
