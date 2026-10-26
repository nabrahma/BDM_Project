/**
 * Players — searchable directory (accepts ?q=) and a player profile with career KPIs,
 * price and Impact Points per season (two aligned charts, never a dual axis), the
 * season table and auction history.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import { C, QUADRANT, axis, defs, tip } from '../lib/chart';
import { API_BASE } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import { PageHeader, CardHead, Kpi, Legend } from '../components/ui';

const ROLES = ['All', 'Batter', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];

function PlayerSearch() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [role, setRole] = useState('All');
  const [sort, setSort] = useState('impact');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (query.trim().length >= 2) q.set('q', query.trim());
        if (role !== 'All') q.set('role', role);
        q.set('sort', sort);
        q.set('limit', '50');
        const res = await fetch(`${API_BASE}/players?${q}`);
        if (res.ok && active) setResults(await res.json());
      } catch (err) {
        console.error('Failed to load players:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    const t = setTimeout(run, query ? 250 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [query, role, sort]);

  const onQuery = v => {
    setQuery(v);
    setParams(v ? { q: v } : {}, { replace: true });
  };

  return (
    <div className="page" id="page-player-search">
      <PageHeader
        title="Players"
        finding="Search any player or browse the leaders; open a row for career charts, value by season and auction history."
        controls={
          <label className="chip-select">
            <Icon name="chevronDown" size={14} style={{ display: 'none' }} />
            <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort players" style={{ paddingLeft: 14 }}>
              <option value="impact">Highest career impact</option>
              <option value="vi">Highest career Value Index</option>
              <option value="runs">Most runs</option>
              <option value="wickets">Most wickets</option>
              <option value="spend">Highest auction spend</option>
            </select>
            <Icon name="chevronDown" size={14} />
          </label>
        }
      />

      <div className="card" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="search-box" id="player-search-box" style={{ flex: '1 1 300px' }}>
          <span className="search-box__icon"><Icon name="search" size={17} /></span>
          <input type="text" placeholder="Search by player name (e.g. Kohli, Pant, Bumrah)" value={query}
            onChange={e => onQuery(e.target.value)} autoFocus aria-label="Search players" />
        </div>
        <div className="chip-group" role="group" aria-label="Role">
          {ROLES.map(r => (
            <button key={r} type="button" className={`chip${role === r ? ' chip--on' : ''}`} onClick={() => setRole(r)} aria-pressed={role === r}>{r}</button>
          ))}
        </div>
      </div>

      {loading && <Loading message="Loading players…" />}

      {!loading && results.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>No players match “{query}”</p>
          <p style={{ fontSize: '0.85rem' }}>Try another spelling, or clear the role filter.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="card">
          <CardHead title={query ? `Results for “${query}”` : 'Leaders'} sub={`${results.length} players · click a row to open the profile`} />
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th><th>Role</th><th>Nationality</th><th>Latest team</th>
                  <th className="num">Matches</th><th className="num">Runs</th><th className="num">Wickets</th>
                  <th className="num">Impact</th><th className="num">Auction spend</th><th className="num">Career VI</th>
                </tr>
              </thead>
              <tbody>
                {results.map(p => (
                  <tr key={p.PlayerID} className="is-link" onClick={() => navigate(`/players/${p.PlayerID}`)}>
                    <td className="cell--strong">{p.PlayerName}</td>
                    <td>{p.Role}</td>
                    <td><span className={`pill ${p.Nationality === 'Overseas' ? 'pill--blue' : p.Nationality === 'Indian' ? 'pill--green' : 'pill--grey'}`}>{p.Nationality}</span></td>
                    <td>{p.LatestTeamKey || '—'}</td>
                    <td className="num">{p.CareerMatches ?? '—'}</td>
                    <td className="num">{formatNum(p.CareerRuns)}</td>
                    <td className="num">{p.CareerWickets ?? 0}</td>
                    <td className="num cell--strong">{formatNum(p.CareerImpactPoints)}</td>
                    <td className="num">{formatMoney(p.TotalAuctionSpendCr || p.CareerSpendCr)}</td>
                    <td className={`num ${p.CareerValueIndex >= 1 ? 'cell--steal' : p.CareerValueIndex != null && p.CareerValueIndex < 0.9 ? 'cell--overpaid' : ''}`}>{formatVI(p.CareerValueIndex)}</td>
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

function SeasonBars({ id, data, dataKey, color, format, title, sub, colorBy, legend }) {
  return (
    <div className="card" id={id}>
      <CardHead title={title} sub={sub} />
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: -10 }} barCategoryGap="30%">
            {defs(id, color)}
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="season" {...axis} tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis {...axis} tickFormatter={format} />
            <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--blue) 6%, transparent)' }}
              content={tip(s => ({ title: `${s.season} · ${s.team}`, rows: [['Price', s.price != null ? formatMoney(s.price) : 'Unpriced'], ['Impact', `${formatNum(s.impact)} pts`], ['Matches', s.matches], ['Quadrant', s.quadrant]] }))} />
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map(s => <Cell key={s.season + s.team} fill={colorBy ? colorBy(s) : `url(#stripe-${id})`} />)}
              <LabelList dataKey={dataKey} position="top" formatter={v => (v == null ? '' : format(v))} style={{ fontSize: 11, fill: C.muted }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {legend && <div style={{ marginTop: 10 }}>{legend}</div>}
    </div>
  );
}

function PlayerProfile() {
  const { id } = useParams();
  const { data, loading } = useApi(`/players/${id}`);
  const navigate = useNavigate();

  if (loading || !data) return <Loading />;
  const { player, seasons, auctions } = data;

  const chartData = seasons.map(s => ({
    season: String(s.Season), team: s.TeamKey, impact: s.ImpactPoints, price: s.PriceCr,
    matches: s.Matches, quadrant: s.ValueQuadrant,
  }));
  const quadrantsSeen = [...new Set(seasons.map(s => s.ValueQuadrant))].filter(Boolean);

  return (
    <div className="page" id="page-player-profile">
      <button type="button" className="chip chip--solo" onClick={() => navigate('/players')} style={{ marginBottom: 14 }}>
        <Icon name="arrowLeft" size={15} /> All players
      </button>
      <PageHeader
        title={player.PlayerName}
        finding={<>{player.Role} · {player.Nationality} · {player.LatestTeamKey} · {player.SeasonsPlayed} seasons ({player.FirstSeason}–{player.LastSeason})</>}
      />

      <div className="kpi-strip" id="player-kpis">
        <Kpi label="Matches" value={player.CareerMatches} />
        <Kpi label="Runs" value={formatNum(player.CareerRuns)} />
        <Kpi label="Wickets" value={player.CareerWickets} />
        <Kpi label="Impact Points" value={formatNum(player.CareerImpactPoints)} />
        <Kpi label="Auction cost (all seasons)" value={formatMoney(player.CareerSpendCr)} />
        <Kpi label="Career Value Index" value={formatVI(player.CareerValueIndex)} />
      </div>

      <div className="grid-2">
        <SeasonBars id="chart-player-price" data={chartData} dataKey="price" color={C.blue} format={v => `₹${v}`}
          title="Price per season" sub="Auction price covering each season (₹ Cr) · blank = retained / unpriced" />
        <SeasonBars id="chart-player-impact" data={chartData} dataKey="impact" color={C.blue} format={v => formatNum(v)}
          title="Impact Points per season" sub="Bar colour = value quadrant that season" colorBy={s => QUADRANT[s.quadrant] || C.neutral}
          legend={quadrantsSeen.length > 0 && <Legend items={quadrantsSeen.map(q => ({ label: q, color: QUADRANT[q] || C.neutral }))} />} />
      </div>

      <div className="card mt" id="table-player-seasons">
        <CardHead title="Season by season" />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th><th>Team</th><th className="num">Matches</th><th className="num">Runs</th><th className="num">Wickets</th>
                <th className="num">Catches</th><th className="num">Impact</th><th className="num">Price</th><th>Quadrant</th><th className="num">Value Index</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map(s => (
                <tr key={s.PlayerSeasonKey}>
                  <td className="cell--strong">{s.Season}</td>
                  <td>{s.TeamKey}</td>
                  <td className="num">{s.Matches}</td>
                  <td className="num">{formatNum(s.Runs)}</td>
                  <td className="num">{s.Wickets}</td>
                  <td className="num">{s.Catches}</td>
                  <td className="num">{formatNum(s.ImpactPoints)}</td>
                  <td className="num">{formatMoney(s.PriceCr)}</td>
                  <td><span className="swatch" style={{ background: QUADRANT[s.ValueQuadrant] || C.neutral }} />{s.ValueQuadrant}</td>
                  <td className="num">{formatVI(s.ValueIndex)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {auctions.length > 0 && (
        <div className="card mt" id="table-auctions">
          <CardHead title="Auction history" />
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Season</th><th>Team</th><th>Role</th><th className="num">Base price</th><th className="num">Sold for</th><th>Bracket</th></tr></thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a.AuctionKey}>
                    <td className="cell--strong">{a.Season}</td>
                    <td>{a.TeamKey}</td>
                    <td>{a.AuctionRole}</td>
                    <td className="num">{formatMoney(a.BasePriceCr)}</td>
                    <td className="num cell--strong">{formatMoney(a.PriceCr)}</td>
                    <td><span className="pill pill--grey">{a.PriceBracket}</span></td>
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

export default function Players() {
  const { id } = useParams();
  return id ? <PlayerProfile /> : <PlayerSearch />;
}
