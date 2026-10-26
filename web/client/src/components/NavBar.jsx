/**
 * NavBar — top bar: brand, pill navigation, light/dark toggle, search, live MongoDB status
 * (opens the database inspector) and the project team.
 */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import Icon from './Icon';

const LINKS = [
  { to: '/',              label: 'Home' },
  { to: '/market',        label: 'Market' },
  { to: '/franchises',    label: 'Franchises' },
  { to: '/value-map',     label: 'Value Map' },
  { to: '/steals',        label: 'Steals' },
  { to: '/roles',         label: 'Roles' },
  { to: '/brackets',      label: 'Brackets' },
  { to: '/players',       label: 'Players' },
  { to: '/squad-builder', label: 'Squad Builder' },
  { to: '/methodology',   label: 'Method' },
];

const TEAM = [
  ['AK', 'Abhishek Kokadwar'],
  ['PB', 'Pratik Baviskar'],
  ['RL', 'Rajveer Lomate'],
  ['NB', 'Nabaskar Brahma'],
];

function BrandMark() {
  return <img className="brand__logo" src="/ipl-logo.png" alt="" width="58" height="40" />;
}

export default function NavBar() {
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbStats, setDbStats] = useState(null);
  const navigate = useNavigate();
  // index.html sets data-theme before first paint (saved choice, else the OS preference)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* storage blocked: theme lasts for this visit */ }
    setTheme(next);
  };

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(setDbStats)
      .catch(() => setDbStats(null));
  }, []);

  const connected = dbStats?.db === 'connected';
  const isAtlas = dbStats?.uri?.startsWith('mongodb+srv');

  return (
    <>
      <header className="topbar" id="main-nav">
        <NavLink to="/" className="brand" aria-label="IPL Value home">
          <BrandMark />
          <span className="brand__name">ipl value</span>
        </NavLink>

        <nav className="nav" aria-label="Pages">
          {LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar__actions">
          <button type="button" className="icon-btn" onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => navigate('/players')}
            title="Search players" aria-label="Search players">
            <Icon name="search" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowDbModal(true)}
            title={connected ? `MongoDB connected · ${dbStats.totalDocs?.toLocaleString()} documents` : 'MongoDB status'}
            aria-label="Database status">
            <Icon name="database" size={18} />
            <span className="icon-btn__dot" style={{ background: connected ? 'var(--green)' : dbStats ? 'var(--pink)' : 'var(--neutral-2)' }} />
          </button>
          <div style={{ display: 'flex' }} title={`Project team: ${TEAM.map(t => t[1]).join(', ')}`}>
            {TEAM.map(([ini, name], i) => (
              <span key={ini} className="avatar" aria-label={name}
                style={{ marginLeft: i ? -12 : 0, zIndex: TEAM.length - i, width: 38, height: 38 }}>
                <span>{ini}</span>
              </span>
            ))}
          </div>
        </div>
      </header>

      {showDbModal && (
        <div className="modal-backdrop" onClick={() => setShowDbModal(false)}>
          <div className="card modal" role="dialog" aria-modal="true" aria-label="MongoDB database inspector"
            onClick={e => e.stopPropagation()}>
            <div className="card-head">
              <div>
                <div className="card-head__title">Database</div>
                <div className="card-head__sub">Live connection and collections behind every page</div>
              </div>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShowDbModal(false)} aria-label="Close">
                <Icon name="close" size={15} />
              </button>
            </div>

            <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="card card--alt kpi">
                <div className="kpi__label">Status</div>
                <div className="kpi__value kpi__value--sm" style={{ color: connected ? 'var(--green-ink)' : 'var(--pink-ink)' }}>
                  {connected ? 'Connected' : 'Offline'}
                </div>
              </div>
              <div className="card card--alt kpi">
                <div className="kpi__label">Documents</div>
                <div className="kpi__value kpi__value--sm">{dbStats?.totalDocs?.toLocaleString() ?? '—'}</div>
              </div>
              <div className="card card--alt kpi">
                <div className="kpi__label">Query latency</div>
                <div className="kpi__value kpi__value--sm">{dbStats?.latencyMs ?? '—'} ms</div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 14 }}>
              {isAtlas ? 'MongoDB Atlas' : 'MongoDB'} · <code style={{ fontSize: '0.76rem', background: 'var(--card-alt)', padding: '2px 6px', borderRadius: 6 }}>
                {dbStats?.uri?.split('?')[0] || 'not connected'}</code>
            </div>

            <table className="data-table">
              <thead><tr><th>Collection</th><th className="num">Documents</th></tr></thead>
              <tbody>
                {(dbStats?.collections || []).map(c => (
                  <tr key={c.name}>
                    <td className="cell--strong" style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.8rem' }}>{c.name}</td>
                    <td className="num">{c.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
