/**
 * Role and Nationality — Value Index by role and by Indian/Overseas (single-hue bars,
 * the best group solid, others striped; 1.0× fair-value line) with breakdown tables.
 */
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, LabelList } from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI } from '../lib/format';
import { C, axis, defs, tip } from '../lib/chart';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import { PageHeader, CardHead, Kpi, SoWhat } from '../components/ui';

function GroupChart({ id, title, sub, rows, height = 280, groupLabel }) {
  const best = rows.reduce((m, r) => (r.valueIndex > m.valueIndex ? r : m), rows[0] || {});
  return (
    <div className="card" id={id}>
      <CardHead title={title} sub={sub} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, bottom: 0, left: -14 }} barCategoryGap="28%">
            {defs(id, C.blue)}
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="group" {...axis} interval={0} tick={{ fontSize: 11, fill: C.muted }} />
            <YAxis {...axis} tickFormatter={v => `${v}×`} />
            <Tooltip cursor={{ fill: 'rgba(51,102,255,0.06)' }}
              content={tip(r => ({ title: r.group, rows: [['Value Index', formatVI(r.valueIndex)], ['Spend', formatMoney(r.spendCr)], ['Player-seasons', r.players]] }))} />
            <ReferenceLine y={1} stroke={C.ink} strokeOpacity={0.45} strokeDasharray="4 4" />
            <Bar dataKey="valueIndex" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map(r => <Cell key={r.group} fill={r.group === best.group ? `url(#grad-${id})` : `url(#stripe-${id})`} />)}
              <LabelList dataKey="valueIndex" position="top" formatter={v => formatVI(v)} style={{ fontSize: 11, fill: C.muted }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="data-table" style={{ marginTop: 14 }}>
        <thead><tr><th>{groupLabel}</th><th className="num">Spend</th><th className="num">Player-seasons</th><th className="num">Value Index</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.group}>
              <td className="cell--strong">{r.group}</td>
              <td className="num">{formatMoney(r.spendCr)}</td>
              <td className="num">{r.players}</td>
              <td className={`num ${r.valueIndex >= 1 ? 'cell--steal' : r.valueIndex < 0.9 ? 'cell--overpaid' : ''}`}>{formatVI(r.valueIndex)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Roles() {
  const [season, setSeason] = useState(2026);
  const seasonParam = season ? `&season=${season}` : '';
  const { data: roleData, loading: l1 } = useApi(`/breakdown?by=Role${seasonParam}`);
  const { data: natData, loading: l2 } = useApi(`/breakdown?by=Nationality${seasonParam}`);

  if (l1 || l2 || !roleData || !natData) return <Loading />;

  const roles = roleData.filter(r => r.group !== 'Unknown');
  const nats = natData.filter(r => r.group !== 'Unknown');
  const ind = nats.find(r => r.group === 'Indian'), ovs = nats.find(r => r.group === 'Overseas');
  const label = season ? String(season) : 'All seasons';
  const bestRole = roles.reduce((m, r) => (r.valueIndex > m.valueIndex ? r : m), roles[0]);

  return (
    <div className="page" id="page-roles">
      <PageHeader
        title="Role & Nationality"
        finding={ind && ovs && <>{label}: overseas buys returned <strong>{formatVI(ovs.valueIndex)}</strong> fair value against <strong>{formatVI(ind.valueIndex)}</strong> for Indian buys. The overseas premium pays for scarcity, not output.</>}
        controls={<SeasonFilter season={season} onChange={setSeason} />}
      />

      <div className="kpi-strip">
        <Kpi label="Indian buys · Value Index" value={ind ? formatVI(ind.valueIndex) : '—'} hint={ind && `${formatMoney(ind.spendCr)} spend`} />
        <Kpi label="Overseas buys · Value Index" value={ovs ? formatVI(ovs.valueIndex) : '—'} hint={ovs && `${formatMoney(ovs.spendCr)} spend`} />
        <Kpi label="Best-value role" value={bestRole ? bestRole.group : '—'} hint={bestRole && formatVI(bestRole.valueIndex)} small />
        <Kpi label="Overseas share of spend" value={ind && ovs ? `${Math.round(100 * ovs.spendCr / (ind.spendCr + ovs.spendCr))}%` : '—'}
          hint={ind && ovs && `${Math.round(100 * ovs.players / (ind.players + ovs.players))}% of player-seasons`} />
      </div>

      <div className="grid-2">
        <GroupChart id="chart-role-vi" title="Value Index by role" sub="Dashed line = fair value (1.0×)" rows={roles} groupLabel="Role" />
        <GroupChart id="chart-nationality-vi" title="Value Index by nationality" sub="Dashed line = fair value (1.0×)" rows={nats} groupLabel="Nationality" />
      </div>

      <SoWhat>
        Spend overseas slots only on proven match-winners; build depth from Indian players, who return more output per crore.
      </SoWhat>
    </div>
  );
}
