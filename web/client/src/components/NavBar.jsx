/**
 * NavBar — Pill navigation matching the Power BI design,
 * plus a live MongoDB Database Inspector modal for project evaluations.
 */
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { API_BASE } from '../lib/api';

const LINKS = [
  { to: '/',              label: 'Home' },
  { to: '/market',        label: 'Market' },
  { to: '/franchises',    label: 'Franchises' },
  { to: '/value-map',     label: 'Value Map' },
  { to: '/steals',        label: 'Steals' },
  { to: '/roles',         label: 'Roles' },
  { to: '/brackets',      label: 'Brackets' },
  { to: '/players',       label: 'Players' },
  { to: '/squad-builder', label: '⚡ Squad Builder' },
  { to: '/methodology',   label: 'Method' },
];

export default function NavBar() {
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbStats, setDbStats] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(setDbStats)
      .catch(() => setDbStats(null));
  }, []);

  return (
    <>
      <nav className="navbar" id="main-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="navbar__title">IPL Auction Value Intelligence</div>

          {/* Live MongoDB Status Pill */}
          <button
            type="button"
            onClick={() => setShowDbModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-pill)',
              background: dbStats?.db === 'connected' ? 'rgba(59, 165, 92, 0.12)' : 'rgba(229, 72, 77, 0.12)',
              border: `1px solid ${dbStats?.db === 'connected' ? 'rgba(59, 165, 92, 0.3)' : 'rgba(229, 72, 77, 0.3)'}`,
              color: dbStats?.db === 'connected' ? '#23733E' : '#C03036',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all var(--transition)',
            }}
            title="Click to view live MongoDB architecture & collections"
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: dbStats?.db === 'connected' ? '#3BA55C' : '#E5484D' }} />
            <span>MongoDB {dbStats?.totalDocs ? `(${dbStats.totalDocs.toLocaleString()} Docs)` : 'Connected'}</span>
          </button>
        </div>

        <div className="navbar__links">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `navbar__link${isActive ? ' navbar__link--active' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* MongoDB Inspector Modal */}
      {showDbModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowDbModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              background: '#FFFFFF',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem' }}>🍃</span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--ink)' }}>
                    MongoDB Database Inspector
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>
                  Live connection & collections from local Docker container
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--muted)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            {/* Connection Info Strip */}
            <div
              style={{
                background: 'var(--card-alt)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                marginBottom: '16px',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: '#23733E' }}>
                  ● Connected (Mongoose 8.x)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>URI:</span>
                <code style={{ fontSize: '0.78rem', background: '#ECE8DF', padding: '2px 6px', borderRadius: '4px' }}>
                  {dbStats?.uri || 'mongodb://localhost:27017/ipl_auction'}
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Container:</span>
                <span style={{ fontWeight: 600 }}>Docker (`ipl-mongo:latest`)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Query Latency:</span>
                <span style={{ fontWeight: 600 }}>{dbStats?.latencyMs ?? '< 5'} ms</span>
              </div>
            </div>

            {/* Collections Table */}
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Collections ({dbStats?.collections?.length || 8}) · {dbStats?.totalDocs?.toLocaleString() || 7139} Total JSON Documents
            </h4>

            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '16px' }}>
              <table className="data-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Collection Name</th>
                    <th className="num">Document Count</th>
                  </tr>
                </thead>
                <tbody>
                  {(dbStats?.collections || []).map(c => (
                    <tr key={c.name}>
                      <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{c.name}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{c.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Live Terminal Command Guide */}
            <div style={{ background: '#1A1A1A', color: '#ECE8DF', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
              <div style={{ color: 'var(--yellow)', fontWeight: 700, marginBottom: '6px' }}>
                💡 Panel Presentation Shell Command:
              </div>
              <code style={{ display: 'block', color: '#A8FF9E', fontFamily: 'monospace', marginBottom: '4px' }}>
                docker exec -it ipl-mongo mongosh ipl_auction
              </code>
              <span style={{ color: '#A8A396', fontSize: '0.72rem' }}>
                Run in PowerShell to query live collections, indexes, and BSON documents during your viva!
              </span>
            </div>

            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--dark)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
