/**
 * Player Value Map — Scatter: price (x) vs Impact Points (y).
 * Dot colour = quadrant, dashed median lines.
 * Matches Power BI page 3.
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import { quadrantHex } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import SoWhat from '../components/SoWhat';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Cell, ReferenceLine,
} from 'recharts';

export default function ValueMap() {
  const [season, setSeason] = useState(2026);
  const navigate = useNavigate();
  const { data, loading } = useApi(`/player-seasons?season=${season}&priced=true`);

  if (loading || !data) return <Loading />;

  // Compute quadrant counts
  const quadrants = {};
  data.forEach(p => {
    const q = p.ValueQuadrant || 'Unknown';
    quadrants[q] = (quadrants[q] || 0) + 1;
  });

  // Scatter data
  const scatterData = data.filter(p => p.PriceCr != null && p.ImpactPoints != null);

  // Medians
  const medianPrice = data[0]?.SeasonMedianPriceCr || 0;
  const medianImpact = data[0]?.SeasonMedianImpact || 0;

  // Top steals
  const topSteals = data
    .filter(p => p.Matches >= 5 && p.ValueIndex != null)
    .sort((a, b) => b.ValueIndex - a.ValueIndex)
    .slice(0, 10);

  // KPIs
  const pricedCount = data.length;
  const stealsCount = quadrants['Steal'] || 0;
  const overpaidCount = quadrants['Overpaid'] || 0;

  const bestPlayer = topSteals[0];

  return (
    <div className="page" id="page-value-map">
      <div className="page-header">
        <h1 className="page-header__title">
          {season}: {stealsCount} steals delivered above-median impact at below-median prices; {overpaidCount} buys were overpaid
        </h1>
        <p className="page-header__sub">
          Price vs Impact Points for every auction buy in the season.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="card kpi">
          <div className="kpi__value">{pricedCount}</div>
          <div className="kpi__label">Auction-priced players</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{stealsCount}</div>
          <div className="kpi__label">Steals</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{overpaidCount}</div>
          <div className="kpi__label">Overpaid</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(medianPrice)}</div>
          <div className="kpi__label">Median price</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatNum(Math.round(medianImpact))}</div>
          <div className="kpi__label">Median Impact Points</div>
        </div>
        {bestPlayer && (
          <div className="card kpi">
            <div className="kpi__value" style={{ fontSize: '1.3rem' }}>
              {bestPlayer.PlayerName} · {formatVI(bestPlayer.ValueIndex)}
            </div>
            <div className="kpi__label">Best Value Index</div>
          </div>
        )}
      </div>

      <div className="grid-sidebar-right">
        {/* Left: Scatter + Filter */}
        <div>
          <SeasonFilter season={season} onChange={setSeason} />

          <div className="card" id="chart-value-scatter">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>
              Price vs Impact Points · dashed lines = season medians
            </h3>
            <div className="dot-legend">
              {['Steal', 'Star', 'Passenger', 'Overpaid', 'Too few matches'].map(q => (
                <div className="dot-legend__item" key={q}>
                  <div className="dot-legend__swatch" style={{ background: quadrantHex(q) }} />
                  {q}
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
                <XAxis
                  type="number" dataKey="PriceCr" name="Price"
                  tick={{ fontSize: 11 }} tickFormatter={v => `₹${v} Cr`}
                  label={{ value: 'Auction price (₹ Cr)', position: 'bottom', fontSize: 12, fill: '#6E6A62' }}
                />
                <YAxis
                  type="number" dataKey="ImpactPoints" name="Impact"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Impact Points', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#6E6A62' }}
                />
                <ZAxis range={[40, 40]} />
                <ReferenceLine x={medianPrice} stroke="#A8A396" strokeDasharray="6 4" label={{ value: 'Median price', fontSize: 10, fill: '#A8A396' }} />
                <ReferenceLine y={medianImpact} stroke="#A8A396" strokeDasharray="6 4" label={{ value: 'Median impact', fontSize: 10, fill: '#A8A396' }} />
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const p = payload[0].payload;
                    return (
                      <div className="card" style={{ padding: '12px', fontSize: '0.8rem' }}>
                        <strong>{p.PlayerName}</strong> ({p.TeamKey})<br />
                        {formatMoney(p.PriceCr)} · {p.ImpactPoints} pts<br />
                        {p.ValueIndex != null && <>VI: {formatVI(p.ValueIndex)}<br /></>}
                        {p.ValueQuadrant}
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData}>
                  {scatterData.map((p, i) => (
                    <Cell key={i} fill={quadrantHex(p.ValueQuadrant)} opacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Quadrant mix + Top steals */}
        <div>
          <div className="card" id="quadrant-mix" style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Quadrant mix</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quadrant</th>
                  <th className="num">Players</th>
                </tr>
              </thead>
              <tbody>
                {['Steal', 'Star', 'Passenger', 'Overpaid', 'Too few matches'].map(q => (
                  <tr key={q}>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: quadrantHex(q), marginRight: 8 }} />
                      {q}
                    </td>
                    <td className="num">
                      <span className="pill" style={{ background: quadrantHex(q), color: q === 'Steal' || q === 'Overpaid' ? '#fff' : '#1A1A1A' }}>
                        {quadrants[q] || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" id="table-best-vi">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
              Best Value Index this season
            </h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="num">Price</th>
                  <th className="num">VI</th>
                </tr>
              </thead>
              <tbody>
                {topSteals.map(p => (
                  <tr
                    key={p.PlayerSeasonKey}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/players/${p.PlayerID}`)}
                  >
                    <td>{p.PlayerName}</td>
                    <td className="num">{formatMoney(p.PriceCr)}</td>
                    <td className="num cell--steal">{formatVI(p.ValueIndex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SoWhat>
        Keep the Steals and Stars; Overpaid and Passenger buys are the release shortlist before the next auction.
      </SoWhat>
    </div>
  );
}
