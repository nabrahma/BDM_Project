/**
 * Role and Nationality page — Value Index by role × nationality.
 * Matches Power BI page 5.
 */
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import SoWhat from '../components/SoWhat';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';

export default function Roles() {
  const [season, setSeason] = useState(2026);
  const seasonParam = season ? `&season=${season}` : '';

  const { data: roleData, loading: l1 } = useApi(`/breakdown?by=Role${seasonParam}`);
  const { data: natData, loading: l2 } = useApi(`/breakdown?by=Nationality${seasonParam}`);

  if (l1 || l2) return <Loading />;

  return (
    <div className="page" id="page-roles">
      <div className="page-header">
        <h1 className="page-header__title">
          {season ? `${season}: ` : ''}Role and Nationality — are overseas stars and all-rounders worth the premium?
        </h1>
        <p className="page-header__sub">
          Value Index by player role and Indian vs Overseas classification.
        </p>
      </div>

      <SeasonFilter season={season} onChange={setSeason} />

      <div className="grid-2">
        {/* By Role */}
        <div className="card" id="chart-role-vi">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Value Index by Role
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={roleData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis dataKey="group" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'valueIndex' ? formatVI(v) : formatMoney(v),
                  name === 'valueIndex' ? 'Value Index' : 'Spend',
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Bar dataKey="valueIndex" fill="#F2C94C" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: '16px' }}>
            <thead>
              <tr><th>Role</th><th className="num">Spend</th><th className="num">Players</th><th className="num">Value Index</th></tr>
            </thead>
            <tbody>
              {roleData?.map(r => (
                <tr key={r.group}>
                  <td>{r.group}</td>
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

        {/* By Nationality */}
        <div className="card" id="chart-nationality-vi">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Value Index by Nationality
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={natData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis dataKey="group" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v, name) => [
                  name === 'valueIndex' ? formatVI(v) : formatMoney(v),
                  name === 'valueIndex' ? 'Value Index' : 'Spend',
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Bar dataKey="valueIndex" fill="#262626" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table" style={{ marginTop: '16px' }}>
            <thead>
              <tr><th>Nationality</th><th className="num">Spend</th><th className="num">Players</th><th className="num">Value Index</th></tr>
            </thead>
            <tbody>
              {natData?.map(r => (
                <tr key={r.group}>
                  <td>{r.group}</td>
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
        Overseas buys cost more but return less per crore than Indian buys: Value Index 0.90 vs 1.10 (all seasons).
        The overseas premium is paying for scarcity, not output.
      </SoWhat>
    </div>
  );
}
