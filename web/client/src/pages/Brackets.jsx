/**
 * Price Brackets page — Value Index by price bracket.
 * Matches Power BI page 6.
 */
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import SoWhat from '../components/SoWhat';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts';

const BRACKET_COLOURS = {
  'Base price buy': '#3BA55C',
  'Under 2 Cr': '#6FCF97',
  '2 to 5 Cr': '#F2C94C',
  '5 to 10 Cr': '#F2994A',
  '10 Cr and above': '#E5484D',
};

export default function Brackets() {
  const [season, setSeason] = useState('');
  const seasonParam = season ? `&season=${season}` : '';

  const { data, loading } = useApi(`/breakdown?by=PriceBracket${seasonParam}`);

  if (loading) return <Loading />;

  return (
    <div className="page" id="page-brackets">
      <div className="page-header">
        <h1 className="page-header__title">
          Price Brackets — do base-price buys beat marquee signings per crore?
        </h1>
        <p className="page-header__sub">
          Value Index by auction price bracket. VI {'>'} 1 = more output than the money suggests.
        </p>
      </div>

      <SeasonFilter season={season} onChange={setSeason} />

      <div className="grid-2">
        <div className="card" id="chart-brackets">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Value Index by Price Bracket
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis dataKey="group" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 12 }} />
              <ReferenceLine y={1} stroke="#E5484D" strokeDasharray="4 4" label={{ value: 'Fair value', fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [formatVI(v), 'Value Index']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Bar dataKey="valueIndex" radius={[6, 6, 0, 0]}>
                {data?.map((d, i) => (
                  <Cell key={i} fill={BRACKET_COLOURS[d.group] || '#262626'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" id="table-brackets">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Breakdown
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Bracket</th>
                <th className="num">Spend</th>
                <th className="num">Player-seasons</th>
                <th className="num">Value Index</th>
              </tr>
            </thead>
            <tbody>
              {data?.map(r => (
                <tr key={r.group}>
                  <td>
                    <span style={{
                      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                      background: BRACKET_COLOURS[r.group] || '#262626', marginRight: 8
                    }} />
                    {r.group}
                  </td>
                  <td className="num">{formatMoney(r.spendCr)}</td>
                  <td className="num">{r.players}</td>
                  <td className={`num ${r.valueIndex > 1 ? 'cell--steal' : r.valueIndex < 0.9 ? 'cell--overpaid' : ''}`}>
                    {formatVI(r.valueIndex)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SoWhat>
        Base-price buys return 4.11× fair value per crore; ₹10 Cr+ signings return just 0.49×.
        The cheapest players consistently deliver the most value per rupee spent.
      </SoWhat>
    </div>
  );
}
