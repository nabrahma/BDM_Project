/**
 * Player Value Map — price (x) vs Impact Points (y) for every priced buy, coloured by
 * quadrant, with the season's medians as dashed lines; quadrant mix and best Value Index.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Cell, ReferenceLine } from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import { C, QUADRANT, axis, tip } from '../lib/chart';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import { PageHeader, CardHead, Kpi, Meter, SoWhat, Legend } from '../components/ui';

const ORDER = ['Steal', 'Star', 'Passenger', 'Overpaid', 'Too few matches'];
const TONE = { Steal: 'green', Star: 'blue', Passenger: 'grey', Overpaid: 'red', 'Too few matches': 'grey' };

export default function ValueMap() {
  const [season, setSeason] = useState(2026);
  const navigate = useNavigate();
  const { data, loading } = useApi(`/player-seasons?season=${season || 2026}&priced=true`);

  if (loading || !data) return <Loading />;

  const quadrants = {};
  data.forEach(p => { const q = p.ValueQuadrant || 'Unknown'; quadrants[q] = (quadrants[q] || 0) + 1; });
  const points = data.filter(p => p.PriceCr != null && p.ImpactPoints != null);
  const medianPrice = data[0]?.SeasonMedianPriceCr || 0;
  const medianImpact = data[0]?.SeasonMedianImpact || 0;
  const topSteals = data.filter(p => p.Matches >= 5 && p.ValueIndex != null).sort((a, b) => b.ValueIndex - a.ValueIndex).slice(0, 8);
  const best = topSteals[0];
  const yr = season || 2026;

  return (
    <div className="page" id="page-value-map">
      <PageHeader
        title="Player Value Map"
        finding={<>{yr}: <strong>{quadrants.Steal || 0} steals</strong> delivered above-median impact at below-median prices; <strong>{quadrants.Overpaid || 0} buys</strong> were overpaid.</>}
        controls={<SeasonFilter season={season || 2026} onChange={v => setSeason(v || 2026)} allowAll={false} />}
      />

      <div className="kpi-strip">
        <Kpi label="Auction-priced players" value={data.length} />
        <Kpi label="Steals" value={quadrants.Steal || 0} />
        <Kpi label="Overpaid" value={quadrants.Overpaid || 0} />
        <Kpi label="Median price" value={formatMoney(medianPrice)} />
        <Kpi label="Median Impact Points" value={formatNum(Math.round(medianImpact))} />
        {best && <Kpi label="Best Value Index" value={`${formatVI(best.ValueIndex)}`} hint={best.PlayerName} />}
      </div>

      <div className="grid-sidebar-right">
        <div className="card" id="chart-value-scatter" style={{ display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Price vs Impact Points" sub="Every priced buy · dashed lines are the season medians"
            right={<Legend items={ORDER.map(q => ({ label: q, color: QUADRANT[q], style: { borderRadius: '50%' } }))} />} />
          <div style={{ flex: 1, minHeight: 470 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 20, left: 0 }}>
                <CartesianGrid stroke={C.grid} />
                <XAxis type="number" dataKey="PriceCr" name="Price" {...axis} tickFormatter={v => `₹${v} Cr`}
                  label={{ value: 'Auction price (₹ Cr)', position: 'insideBottom', offset: -12, fontSize: 11, fill: C.faint }} />
                <YAxis type="number" dataKey="ImpactPoints" name="Impact" {...axis}
                  label={{ value: 'Impact Points', angle: -90, position: 'insideLeft', offset: 18, fontSize: 11, fill: C.faint }} />
                <ZAxis range={[46, 46]} />
                <ReferenceLine x={medianPrice} stroke={C.ink} strokeOpacity={0.35} strokeDasharray="5 4"
                  label={{ value: `median ${formatMoney(medianPrice)}`, position: 'insideTopRight', fontSize: 10, fill: C.faint }} />
                <ReferenceLine y={medianImpact} stroke={C.ink} strokeOpacity={0.35} strokeDasharray="5 4"
                  label={{ value: `median ${Math.round(medianImpact)} pts`, position: 'insideTopRight', fontSize: 10, fill: C.faint }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  content={tip(p => ({ title: `${p.PlayerName} · ${p.TeamKey}`, rows: [
                    ['Price', formatMoney(p.PriceCr)], ['Impact', `${formatNum(p.ImpactPoints)} pts`],
                    ...(p.ValueIndex != null ? [['Value Index', formatVI(p.ValueIndex)]] : []), ['Quadrant', p.ValueQuadrant]] }))} />
                <Scatter data={points} isAnimationActive={false} onClick={p => p?.PlayerID && navigate(`/players/${p.PlayerID}`)} style={{ cursor: 'pointer' }}>
                  {points.map(p => <Cell key={p.PlayerSeasonKey} fill={QUADRANT[p.ValueQuadrant] || C.neutral} stroke="#fff" strokeWidth={1.5} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stack">
          <div className="card" id="quadrant-mix">
            <CardHead title="Quadrant mix" sub={`${data.length} priced players`} />
            {ORDER.map(q => (
              <Meter key={q} label={q} value={quadrants[q] || 0} pct={100 * (quadrants[q] || 0) / data.length} tone={TONE[q]} />
            ))}
          </div>
          <div className="card" id="table-best-vi">
            <CardHead title="Best Value Index" sub="Minimum 5 matches" />
            <table className="data-table">
              <thead><tr><th>Player</th><th className="num">Price</th><th className="num">VI</th></tr></thead>
              <tbody>
                {topSteals.map(p => (
                  <tr key={p.PlayerSeasonKey} className="is-link" onClick={() => navigate(`/players/${p.PlayerID}`)}>
                    <td className="cell--strong">{p.PlayerName}</td>
                    <td className="num">{formatMoney(p.PriceCr)}</td>
                    <td className="num cell--steal">{formatVI(p.ValueIndex)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SoWhat>Keep the Steals and Stars; Overpaid and Passenger buys are the release shortlist before the next auction.</SoWhat>
    </div>
  );
}
