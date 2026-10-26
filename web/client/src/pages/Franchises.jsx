/**
 * Franchise Efficiency — Value Index by franchise (team colours), spend vs win %
 * (direct-labelled), and the franchise table. Correlations computed from all team-seasons.
 */
import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter,
  CartesianGrid, ZAxis, Cell, ReferenceLine, LabelList,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatPct } from '../lib/format';
import { C, axis, defs, tip } from '../lib/chart';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import { PageHeader, CardHead, Kpi, SoWhat } from '../components/ui';

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
const signed = r => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`;

export default function Franchises() {
  const [season, setSeason] = useState(2026);
  const path = season ? `/team-seasons?season=${season}` : '/team-seasons';
  const { data, loading } = useApi(path);
  const { data: matrix } = useApi('/team-seasons/matrix');

  const r = useMemo(() => {
    if (!matrix) return null;
    const ts = matrix.filter(x => x.WinPct != null && x.SpendCr != null && x.ValueIndex != null);
    return { n: ts.length, spend: pearson(ts.map(x => x.SpendCr), ts.map(x => x.WinPct)), vi: pearson(ts.map(x => x.ValueIndex), ts.map(x => x.WinPct)) };
  }, [matrix]);

  if (loading || !data) return <Loading />;

  const rows = data.map(x => ({
    team: x.TeamKey || x.group,
    teamName: x.TeamSeasonLabel || x.teamName || x.group,
    vi: x.ValueIndex ?? x.valueIndex,
    spend: x.SpendCr ?? x.spendCr,
    colour: x.TeamColour || x.teamColour || C.neutral,
    winPct: x.WinPct ?? x.winPct,
  })).filter(x => x.vi != null).sort((a, b) => (b.vi || 0) - (a.vi || 0));

  const best = rows[0], worst = rows[rows.length - 1];
  const spender = rows.reduce((m, x) => ((x.spend || 0) > (m.spend || 0) ? x : m), rows[0]);
  const label = season ? String(season) : 'All seasons';

  return (
    <div className="page" id="page-franchises">
      <PageHeader
        title="Franchise Efficiency"
        finding={best && <>{label}: <strong>{best.team}</strong> got {formatVI(best.vi)} fair value from {formatMoney(best.spend)} of buys; <strong>{spender.team}</strong> spent the most ({formatMoney(spender.spend)}) for {formatVI(spender.vi)}.</>}
        controls={<SeasonFilter season={season} onChange={setSeason} />}
      />

      <div className="kpi-strip">
        <Kpi label="Most efficient" value={best ? `${best.team} · ${formatVI(best.vi)}` : '—'} small />
        <Kpi label="Least efficient" value={worst ? `${worst.team} · ${formatVI(worst.vi)}` : '—'} small />
        <Kpi label="Biggest spender" value={spender ? `${spender.team} · ${formatMoney(spender.spend)}` : '—'} small />
        <Kpi label="Spend vs win %" value={r ? `r = ${signed(r.spend)}` : '—'} hint={r && `${r.n} team-seasons`} small />
        <Kpi label="Value Index vs win %" value={r ? `r = ${signed(r.vi)}` : '—'} hint={r && `${r.n} team-seasons`} small />
      </div>

      <div className="grid-2">
        <div className="card" id="chart-franchise-vi">
          <CardHead title="Value Index by franchise" sub="1.0× = fair value (dashed line)" />
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 0 }} barCategoryGap="22%">
                {rows.map(x => defs(`t-${x.team}`, x.colour))}
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" {...axis} tickFormatter={v => `${v}×`} />
                <YAxis type="category" dataKey="team" {...axis} width={46} tick={{ fontSize: 12, fill: C.muted }} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--blue) 5%, transparent)' }}
                  content={tip(x => ({ title: x.teamName, rows: [['Value Index', formatVI(x.vi)], ['Spend', formatMoney(x.spend)], ['Win %', formatPct(x.winPct)]] }))} />
                <ReferenceLine x={1} stroke={C.ink} strokeOpacity={0.45} strokeDasharray="4 4" />
                <Bar dataKey="vi" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {rows.map(x => <Cell key={x.team} fill={`url(#stripe-t-${x.team})`} />)}
                  <LabelList dataKey="vi" position="right" formatter={v => formatVI(v)} style={{ fontSize: 11, fill: C.muted }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" id="chart-spend-win">
          <CardHead title="Does spending more win more?" sub={r ? `Each dot is a franchise · across all ${r.n} team-seasons r = ${signed(r.spend)}` : 'Each dot is a franchise'} />
          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 24, bottom: 16, left: -6 }}>
                <CartesianGrid stroke={C.grid} />
                <XAxis type="number" dataKey="spend" name="Spend" {...axis} tickFormatter={v => `₹${v}`}
                  label={{ value: 'Spend on priced players (₹ Cr)', position: 'insideBottom', offset: -10, fontSize: 11, fill: C.faint }} />
                <YAxis type="number" dataKey="winPct" name="Win %" {...axis} tickFormatter={v => `${Math.round(v * 100)}%`} domain={[0, 1]} />
                <ZAxis range={[110, 110]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                  content={tip(x => ({ title: x.teamName, rows: [['Spend', formatMoney(x.spend)], ['Win %', formatPct(x.winPct)], ['Value Index', formatVI(x.vi)]] }))} />
                <Scatter data={rows} isAnimationActive={false}>
                  {rows.map(x => <Cell key={x.team} fill={x.colour} stroke="var(--card)" strokeWidth={2} />)}
                  <LabelList dataKey="team" position="right" offset={8} style={{ fontSize: 11, fill: C.muted }} />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card mt" id="table-franchise">
        <CardHead title="Franchises" sub={label} />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Team</th><th className="num">Spend</th><th className="num">Win %</th><th className="num">Value Index</th></tr>
            </thead>
            <tbody>
              {rows.map(x => (
                <tr key={x.team}>
                  <td className="cell--strong"><span className="swatch" style={{ background: x.colour }} />{x.teamName}</td>
                  <td className="num">{formatMoney(x.spend)}</td>
                  <td className="num">{formatPct(x.winPct)}</td>
                  <td className={`num ${(x.vi || 0) >= 1 ? 'cell--steal' : (x.vi || 0) < 0.9 ? 'cell--overpaid' : ''}`}>{formatVI(x.vi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SoWhat>
        {r ? <>Spending more does not win more (r = {signed(r.spend)}), but spending efficiently does: Value Index vs win % has r = {signed(r.vi)} across {r.n} team-seasons.</> : 'Spending efficiently matters more than spending more.'}
      </SoWhat>
    </div>
  );
}
