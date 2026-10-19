/**
 * Franchise Efficiency page — Value Index by team, spend vs win% scatter.
 * Matches Power BI page 2.
 */
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatPct } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import SoWhat from '../components/SoWhat';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, ZAxis, Cell, Legend,
} from 'recharts';

export default function Franchises() {
  const [season, setSeason] = useState(2026);
  const path = season ? `/team-seasons?season=${season}` : '/team-seasons';
  const { data, loading } = useApi(path);
  const { data: matrix } = useApi('/team-seasons/matrix');

  if (loading || !data) return <Loading />;

  // For the bar chart, use either precomputed (single season) or aggregated (all)
  const barData = data.map(r => ({
    team: r.TeamKey || r.group,
    teamName: r.TeamSeasonLabel || r.teamName || r.group,
    vi: r.ValueIndex ?? r.valueIndex,
    spend: r.SpendCr ?? r.spendCr,
    colour: r.TeamColour || r.teamColour || '#262626',
    winPct: r.WinPct ?? r.winPct,
  })).sort((a, b) => (b.vi || 0) - (a.vi || 0));

  return (
    <div className="page" id="page-franchises">
      <div className="page-header">
        <h1 className="page-header__title">
          {season ? `${season}: ` : ''}Franchise Efficiency — who gets the most impact per crore?
        </h1>
        <p className="page-header__sub">
          Value Index by franchise. VI {'>'} 1 = more output than the money suggests.
        </p>
      </div>

      <SeasonFilter season={season} onChange={setSeason} />

      <div className="grid-2">
        {/* VI Bar Chart */}
        <div className="card" id="chart-franchise-vi">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Value Index by franchise
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="team" tick={{ fontSize: 12 }} width={50} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'vi' ? formatVI(v) : formatMoney(v),
                  name === 'vi' ? 'Value Index' : 'Spend',
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <ReferenceLine x={1} stroke="#E5484D" strokeDasharray="4 4" label={{ value: 'Fair value', fontSize: 11 }} />
              <Bar dataKey="vi" radius={[0, 6, 6, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.colour} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Spend vs Win % Scatter */}
        <div className="card" id="chart-spend-win">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Spend vs Win % — does spending more win more?
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis type="number" dataKey="spend" name="Spend" tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
              <YAxis type="number" dataKey="winPct" name="Win %" tick={{ fontSize: 12 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <ZAxis range={[80, 80]} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'Spend' ? formatMoney(v) : formatPct(v),
                  name,
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Scatter data={barData}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.colour} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '8px' }}>
            r = −0.03 (all seasons): spending more does not win more.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ marginTop: '20px' }} id="table-franchise">
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th className="num">Spend</th>
              <th className="num">Win %</th>
              <th className="num">Value Index</th>
            </tr>
          </thead>
          <tbody>
            {barData.map(r => (
              <tr key={r.team}>
                <td>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: r.colour, marginRight: 8 }} />
                  {r.teamName}
                </td>
                <td className="num">{formatMoney(r.spend)}</td>
                <td className="num">{formatPct(r.winPct)}</td>
                <td className={`num ${(r.vi || 0) > 1 ? 'cell--steal' : (r.vi || 0) < 0.9 ? 'cell--overpaid' : ''}`}>
                  {formatVI(r.vi)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SoWhat>
        Spending more does not win more (r = −0.03), but spending efficiently does:
        Value Index vs Win % has r = +0.35. CSK leads all-time efficiency at 1.19×.
      </SoWhat>
    </div>
  );
}

// Needed for the import
import { ReferenceLine } from 'recharts';
