/**
 * Player Profile page — search + individual player profile.
 * Price bars vs Impact Points line per season.
 * Matches Power BI page 7 (Player Profile drill-through).
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import { quadrantHex } from '../lib/format';
import { API_BASE } from '../lib/api';
import Loading from '../components/Loading';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

/** Search view */
/** Search and Directory view */
function PlayerSearch() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All');
  const [sort, setSort] = useState('impact');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const ROLES = ['All', 'Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];

  useEffect(() => {
    let active = true;
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        let url = `${API_BASE}/players`;
        const params = new URLSearchParams();
        if (query && query.trim().length >= 2) {
          params.set('q', query.trim());
        }
        if (role !== 'All') params.set('role', role);
        params.set('sort', sort);
        params.set('limit', '50');

        const fullUrl = `${url}?${params.toString()}`;
        const res = await fetch(fullUrl);
        if (res.ok) {
          const data = await res.json();
          if (active) setResults(data);
        }
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(fetchPlayers, query ? 250 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, role, sort]);

  return (
    <div className="page" id="page-player-search">
      <div className="page-header">
        <h1 className="page-header__title">Player Directory & Profile</h1>
        <p className="page-header__sub">
          Search for any player or browse the top performers below. Click any row to view career charts, impact trends, and auction history.
        </p>
      </div>

      {/* Search & Filter Controls */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="search-box" id="player-search-box" style={{ flex: '1 1 280px', maxWidth: '450px' }}>
            <span className="search-box__icon">🔍</span>
            <input
              type="text"
              placeholder="Search by player name (e.g. Kohli, Pant, Bumrah)…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {/* Role Pills */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--card-alt)', padding: '4px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--line)' }}>
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: role === r ? 'var(--dark)' : 'transparent',
                    color: role === r ? '#fff' : 'var(--muted)',
                    transition: 'all var(--transition)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Sort by:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <option value="impact">Highest Career Impact</option>
                <option value="vi">Highest Career Value Index</option>
                <option value="runs">Most Runs</option>
                <option value="wickets">Most Wickets</option>
                <option value="spend">Total Auction Spend</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {loading && <Loading message="Loading players…" />}

      {!loading && results.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>No players found matching your search</p>
          <p style={{ fontSize: '0.85rem' }}>Try clearing your filters or searching for another name.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>
              Showing {results.length} {query ? `search results for "${query}"` : 'featured players'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              Click any player row to view full profile & auction history
            </span>
          </div>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Role</th>
                  <th>Nationality</th>
                  <th>Latest Team</th>
                  <th className="num">Matches</th>
                  <th className="num">Runs</th>
                  <th className="num">Wickets</th>
                  <th className="num">Impact Points</th>
                  <th className="num">Auction Spend</th>
                  <th className="num">Career VI</th>
                </tr>
              </thead>
              <tbody>
                {results.map(p => (
                  <tr
                    key={p.PlayerID}
                    onClick={() => navigate(`/players/${p.PlayerID}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: 700, color: 'var(--ink)' }}>{p.PlayerName}</td>
                    <td>{p.Role}</td>
                    <td>
                      <span className="pill" style={{ fontSize: '0.7rem', background: p.Nationality === 'Overseas' ? 'rgba(74, 144, 226, 0.12)' : 'rgba(59, 165, 92, 0.12)', color: p.Nationality === 'Overseas' ? '#2A68B0' : '#23733E' }}>
                        {p.Nationality}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.LatestTeamKey || '—'}</td>
                    <td className="num">{p.CareerMatches ?? '—'}</td>
                    <td className="num">{formatNum(p.CareerRuns)}</td>
                    <td className="num">{p.CareerWickets ?? 0}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{formatNum(p.CareerImpactPoints)}</td>
                    <td className="num">{formatMoney(p.TotalAuctionSpendCr || p.CareerSpendCr)}</td>
                    <td className="num cell--steal" style={{ fontWeight: 700 }}>{formatVI(p.CareerValueIndex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Profile view */
function PlayerProfile() {
  const { id } = useParams();
  const { data, loading } = useApi(`/players/${id}`);
  const navigate = useNavigate();

  if (loading || !data) return <Loading />;
  const { player, seasons, auctions } = data;

  // Chart data: per season
  const chartData = seasons.map(s => ({
    season: s.Season,
    impact: s.ImpactPoints,
    price: s.PriceCr,
    matches: s.Matches,
    quadrant: s.ValueQuadrant,
  }));

  return (
    <div className="page" id="page-player-profile">
      <button
        onClick={() => navigate('/players')}
        style={{
          fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}
      >
        ← Back to search
      </button>

      <div className="page-header">
        <h1 className="page-header__title">{player.PlayerName}</h1>
        <p className="page-header__sub">
          {player.Role} · {player.Nationality} · {player.LatestTeamKey} · {player.SeasonsPlayed} seasons ({player.FirstSeason}–{player.LastSeason})
        </p>
      </div>

      {/* Career KPIs */}
      <div className="kpi-strip" id="player-kpis">
        <div className="card kpi">
          <div className="kpi__value">{player.CareerMatches}</div>
          <div className="kpi__label">Matches</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatNum(player.CareerRuns)}</div>
          <div className="kpi__label">Runs</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{player.CareerWickets}</div>
          <div className="kpi__label">Wickets</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatNum(player.CareerImpactPoints)}</div>
          <div className="kpi__label">Impact Points</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(player.CareerSpendCr)}</div>
          <div className="kpi__label">Total auction cost</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatVI(player.CareerValueIndex)}</div>
          <div className="kpi__label">Career Value Index</div>
        </div>
      </div>

      {/* Price vs Impact Chart */}
      <div className="card" id="chart-player-seasons" style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
          Price vs Impact by Season
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
            <XAxis dataKey="season" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(v, name) => [
                name === 'price' ? formatMoney(v) : formatNum(v),
                name === 'price' ? 'Auction Price' : 'Impact Points',
              ]}
              contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="price" fill="#F2C94C" radius={[6, 6, 0, 0]} name="Auction Price (Cr)" />
            <Line yAxisId="right" type="monotone" dataKey="impact" stroke="#262626" strokeWidth={2} dot={{ r: 4 }} name="Impact Points" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Season-by-season table */}
      <div className="card" id="table-player-seasons">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
          Season-by-season breakdown
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                <th className="num">Matches</th>
                <th className="num">Runs</th>
                <th className="num">Wickets</th>
                <th className="num">Catches</th>
                <th className="num">Impact</th>
                <th className="num">Price</th>
                <th>Quadrant</th>
                <th className="num">Value Index</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(s => (
                <tr key={s.PlayerSeasonKey}>
                  <td style={{ fontWeight: 600 }}>{s.Season}</td>
                  <td>{s.TeamKey}</td>
                  <td className="num">{s.Matches}</td>
                  <td className="num">{formatNum(s.Runs)}</td>
                  <td className="num">{s.Wickets}</td>
                  <td className="num">{s.Catches}</td>
                  <td className="num">{formatNum(s.ImpactPoints)}</td>
                  <td className="num">{formatMoney(s.PriceCr)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: quadrantHex(s.ValueQuadrant), marginRight: 6
                    }} />
                    {s.ValueQuadrant}
                  </td>
                  <td className="num">{formatVI(s.ValueIndex)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auction History */}
      {auctions.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }} id="table-auctions">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
            Auction History
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th>
                <th>Team</th>
                <th>Role</th>
                <th className="num">Base Price</th>
                <th className="num">Sold Price</th>
                <th>Bracket</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map(a => (
                <tr key={a.AuctionKey}>
                  <td style={{ fontWeight: 600 }}>{a.Season}</td>
                  <td>{a.TeamKey}</td>
                  <td>{a.AuctionRole}</td>
                  <td className="num">{formatMoney(a.BasePriceCr)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{formatMoney(a.PriceCr)}</td>
                  <td>{a.PriceBracket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Route wrapper — show search or profile */
export default function Players() {
  const { id } = useParams();
  return id ? <PlayerProfile /> : <PlayerSearch />;
}
