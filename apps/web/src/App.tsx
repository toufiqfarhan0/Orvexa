import { useState, useEffect } from 'react';
import type { HealthCheckResponse } from '@orvexa/shared';

export function App() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data: HealthCheckResponse = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <main className="container">
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
          }}
        >
          <span className="gradient-text">Orvexa</span> Platform
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
          Full-Stack TypeScript Application
        </p>
      </header>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Backend Connectivity Status</h2>
          <button onClick={fetchHealth} className="btn btn-secondary" disabled={loading}>
            {loading ? 'Checking...' : 'Refresh Health'}
          </button>
        </div>

        {loading && (
          <div style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
            Checking backend service status...
          </div>
        )}

        {error && (
          <div style={{ marginTop: '0.5rem' }}>
            <span className="badge badge-error" style={{ marginBottom: '0.75rem' }}>
              <span className="dot" /> Connection Error
            </span>
            <p style={{ color: 'var(--status-error)', fontSize: '0.9rem' }}>{error}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              Ensure the backend server is running on port 4000 (`npm run dev:server`).
            </p>
          </div>
        )}

        {health && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="badge badge-success">
                <span className="dot" /> Service {health.status.toUpperCase()}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Service: <strong>{health.service}</strong> (v{health.version})
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                color: 'var(--text-secondary)',
                overflowX: 'auto',
              }}
            >
              <div>
                <strong>Environment:</strong> {health.environment}
              </div>
              <div>
                <strong>Uptime:</strong> {health.uptime}s
              </div>
              <div>
                <strong>Timestamp:</strong> {health.timestamp}
              </div>
            </div>
          </div>
        )}
      </section>

      <footer
        style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          marginTop: '2rem',
        }}
      >
        Orvexa Full-Stack Monorepo
      </footer>
    </main>
  );
}

export default App;
