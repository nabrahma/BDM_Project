/**
 * Steals and Overpaid — top 10 steals, top 10 overpaid, Bargain XI, Overpaid XI and
 * the latest unsold list. Rankings use player-seasons with at least 5 matches.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import { PageHeader, CardHead, Kpi, SoWhat } from '../components/ui';

function RankTable({ rows, cols, onRow }) {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead><tr>{cols.map(c => <th key={c.h} className={c.num ? 'num' : undefined}>{c.h}</th>)}</tr></thead>
        <tbody>
          {rows?.map((p, i) => (
            <tr key={p.PlayerSeasonKey || i} className={onRow ? 'is-link' : undefined} onClick={onRow ? () => onRow(p) : undefined}>
              {cols.map(c => <td key={c.h} className={[c.num && 'num', c.cls].filter(Boolean).join(' ') || undefined}>{c.v(p, i)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const rank = (_, i) => <span style={{ color: 'var(--faint)' }}>{i + 1}</span>;

export default function Steals() {
  const [season, setSeason] = useState(2026);
  const navigate = useNavigate();
  const yr = season || 2026;
  const { data: steals, loading: l1 } = useApi(`/rankings/steals?season=${yr}`);
  const { data: overpaid, loading: l2 } = useApi(`/rankings/overpaid?season=${yr}`);
  const { data: bargainXI, loading: l3 } = useApi(`/rankings/bargain-xi?season=${yr}`);
  const { data: overpaidXI, loading: l4 } = useApi(`/rankings/overpaid-xi?season=${yr}`);
  const { data: unsold, loading: l5 } = useApi('/rankings/unsold');

  if (l1 || l2 || l3 || l4 || l5) return <Loading />;

  const s0 = steals?.[0], o0 = overpaid?.[0];
  const open = p => navigate(`/players/${p.PlayerID}`);
  const xiSpend = xs => (xs || []).reduce((a, p) => a + (p.PriceCr || 0), 0);

  return (
    <div className="page" id="page-steals">
      <PageHeader
        title="Steals & Overpaid"
        finding={s0 && o0 && <>{yr}: {formatMoney(s0.PriceCr)} <strong>{s0.PlayerName}</strong> returned {s0.ValueIndex.toFixed(0)}× fair value, while {formatMoney(o0.PriceCr)} <strong>{o0.PlayerName}</strong> was overpaid by {formatMoney(o0.OverpayCr)}.</>}
        controls={<SeasonFilter season={yr} onChange={v => setSeason(v || 2026)} allowAll={false} />}
      />

      <div className="kpi-strip">
        <Kpi label="Top steal" value={s0 ? formatVI(s0.ValueIndex) : '—'} hint={s0 && `${s0.PlayerName} · ${formatMoney(s0.PriceCr)}`} />
        <Kpi label="Most overpaid" value={o0 ? formatMoney(o0.OverpayCr) : '—'} hint={o0 && `${o0.PlayerName} · ${formatMoney(o0.PriceCr)}`} />
        <Kpi label="Bargain XI cost" value={formatMoney(xiSpend(bargainXI))} hint="11 best-value buys" />
        <Kpi label="Overpaid XI cost" value={formatMoney(xiSpend(overpaidXI))} hint="11 biggest overpays" />
      </div>

      <div className="grid-2">
        <div className="card" id="table-steals">
          <CardHead title="Top 10 steals" sub="Highest Value Index · minimum 5 matches" />
          <RankTable rows={steals} onRow={open} cols={[
            { h: '#', v: rank }, { h: 'Player', v: p => p.PlayerName, cls: 'cell--strong' }, { h: 'Team', v: p => p.TeamKey },
            { h: 'Price', num: true, v: p => formatMoney(p.PriceCr) }, { h: 'Impact', num: true, v: p => formatNum(p.ImpactPoints) },
            { h: 'Value Index', num: true, cls: 'cell--steal', v: p => formatVI(p.ValueIndex) },
          ]} />
        </div>
        <div className="card" id="table-overpaid">
          <CardHead title="Top 10 overpaid" sub="Price above the value of the output · minimum 5 matches" />
          <RankTable rows={overpaid} onRow={open} cols={[
            { h: '#', v: rank }, { h: 'Player', v: p => p.PlayerName, cls: 'cell--strong' }, { h: 'Team', v: p => p.TeamKey },
            { h: 'Price', num: true, v: p => formatMoney(p.PriceCr) }, { h: 'Impact', num: true, v: p => formatNum(p.ImpactPoints) },
            { h: 'Overpaid by', num: true, cls: 'cell--overpaid', v: p => formatMoney(p.OverpayCr) },
          ]} />
        </div>
      </div>

      <div className="grid-2 mt">
        <div className="card" id="table-bargain-xi">
          <CardHead title="Bargain XI" sub="Best-value XI by role" />
          <RankTable rows={bargainXI} onRow={open} cols={[
            { h: 'Role', v: p => <span className="pill pill--grey">{p.Role}</span> }, { h: 'Player', v: p => p.PlayerName, cls: 'cell--strong' },
            { h: 'Price', num: true, v: p => formatMoney(p.PriceCr) }, { h: 'VI', num: true, cls: 'cell--steal', v: p => formatVI(p.ValueIndex) },
          ]} />
        </div>
        <div className="card" id="table-overpaid-xi">
          <CardHead title="Overpaid XI" sub="Biggest gap between price and output, by role" />
          <RankTable rows={overpaidXI} onRow={open} cols={[
            { h: 'Role', v: p => <span className="pill pill--grey">{p.Role}</span> }, { h: 'Player', v: p => p.PlayerName, cls: 'cell--strong' },
            { h: 'Price', num: true, v: p => formatMoney(p.PriceCr) }, { h: 'Overpaid by', num: true, cls: 'cell--overpaid', v: p => formatMoney(p.OverpayCr) },
          ]} />
        </div>
      </div>

      <div className="card mt" id="table-unsold">
        <CardHead title="Unsold at the 2026 auction" sub="Ranked by career Impact Points" />
        <RankTable rows={unsold?.slice(0, 12)} cols={[
          { h: '#', v: rank }, { h: 'Player', v: p => p.Player, cls: 'cell--strong' },
          { h: 'Base price', num: true, v: p => formatMoney(p.BasePriceCr) }, { h: 'Career matches', num: true, v: p => p.CareerMatches },
          { h: 'Career impact', num: true, v: p => formatNum(p.CareerImpact) }, { h: 'Last IPL season', num: true, v: p => p.LastIplSeason ?? '—' },
        ]} />
      </div>

      <SoWhat>
        The best value sat in ₹30-lakh buys, while the most overpaid {yr} players were marquee signings: price the next bid on expected output, not reputation.
      </SoWhat>
    </div>
  );
}
