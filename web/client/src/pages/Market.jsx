/**
 * Auction Market — average price per season (mega auctions solid, mini striped),
 * total spend per season, and the top buy / Orange and Purple Cap per season.
 */
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid, Cell } from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatNum } from '../lib/format';
import { C, axis, defs, tip } from '../lib/chart';
import Loading from '../components/Loading';
import { PageHeader, CardHead, Kpi, SoWhat, Legend } from '../components/ui';

export default function Market() {
  const { data: seasons, loading } = useApi('/seasons');
  if (loading || !seasons) return <Loading />;

  const first = seasons[0];
  const latest = seasons[seasons.length - 1];
  const latestMega = [...seasons].reverse().find(s => s.IsMegaAuction) || latest;
  const biggest = seasons.reduce((m, s) => (s.AuctionSpendCr > m.AuctionSpendCr ? s : m), seasons[0]);
  const ratio = latestMega.AvgPriceCr / first.AvgPriceCr;

  return (
    <div className="page" id="page-market">
      <PageHeader
        title="Auction Market"
        finding={<>Average price per buy has <strong>{ratio >= 1.95 ? 'doubled' : `risen ${ratio.toFixed(1)}×`}</strong>: {formatMoney(first.AvgPriceCr)} in {first.Season}, {formatMoney(latestMega.AvgPriceCr)} at the {latestMega.Season} mega auction.</>}
      />

      <div className="kpi-strip">
        <Kpi label="Seasons" value={seasons.length} hint={`${first.Season}–${latest.Season}`} />
        <Kpi label="Auction buys" value={formatNum(seasons.reduce((s, r) => s + r.PlayersBought, 0))} />
        <Kpi label={`Average price, ${latestMega.Season} mega`} value={formatMoney(latestMega.AvgPriceCr)} hint={`${ratio.toFixed(1)}× ${first.Season}`} />
        <Kpi label={`Average price, ${latest.Season}`} value={formatMoney(latest.AvgPriceCr)} />
        <Kpi label="Biggest auction" value={formatMoney(biggest.AuctionSpendCr)} hint={`${biggest.Season} · ${biggest.PlayersBought} buys`} />
      </div>

      <div className="grid-2">
        <div className="card" id="chart-avg-price">
          <CardHead title="Average price per buy" sub="₹ Cr per auction buy, by season"
            right={<Legend items={[
              { label: 'Mega auction', color: C.blue },
              { label: 'Mini auction', color: C.blue2, style: { backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.45) 0 2px, transparent 2px 5px)' } },
            ]} />} />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasons} margin={{ top: 8, right: 4, bottom: 0, left: -14 }} barCategoryGap="18%">
                {defs('mega', C.blue)}{defs('mini', C.blue2)}
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="Season" {...axis} tickFormatter={v => `’${String(v).slice(2)}`} />
                <YAxis {...axis} tickFormatter={v => `₹${v}`} />
                <Tooltip cursor={{ fill: 'rgba(51,102,255,0.06)' }}
                  content={tip(s => ({ title: `${s.Season} · ${s.AuctionType}`, rows: [['Average price', formatMoney(s.AvgPriceCr)], ['Buys', s.PlayersBought], ['Spend', formatMoney(s.AuctionSpendCr)]] }))} />
                <Bar dataKey="AvgPriceCr" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {seasons.map(s => <Cell key={s.Season} fill={s.IsMegaAuction ? 'url(#grad-mega)' : 'url(#stripe-mini)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" id="chart-total-spend">
          <CardHead title="Total auction spend" sub="₹ Cr spent at each season's auction" />
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={seasons} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                {defs('spend', C.blue)}
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="Season" {...axis} tickFormatter={v => `’${String(v).slice(2)}`} />
                <YAxis {...axis} tickFormatter={v => `₹${v}`} />
                <Tooltip cursor={{ stroke: C.blue, strokeOpacity: 0.25 }}
                  content={tip(s => ({ title: `${s.Season} · ${s.AuctionType}`, rows: [['Spend', formatMoney(s.AuctionSpendCr)], ['Buys', s.PlayersBought]] }))} />
                <Area type="monotone" dataKey="AuctionSpendCr" stroke={C.blue} strokeWidth={2} fill="url(#vline-spend)" isAnimationActive={false}
                  dot={false} activeDot={{ r: 4, fill: C.blue, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card mt" id="table-top-buys">
        <CardHead title="Top buy and season leaders" sub="Most expensive buy at each auction; Orange Cap (runs) and Purple Cap (wickets)" />
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Season</th><th>Auction</th><th>Top buy</th><th className="num">Price</th>
                <th>Orange Cap</th><th className="num">Runs</th><th>Purple Cap</th><th className="num">Wickets</th>
              </tr>
            </thead>
            <tbody>
              {[...seasons].reverse().map(s => (
                <tr key={s.Season}>
                  <td className="cell--strong">{s.Season}</td>
                  <td>{s.IsMegaAuction ? <span className="pill pill--blue">Mega</span> : <span className="pill pill--grey">Mini</span>}</td>
                  <td>{s.TopBuyPlayer}</td>
                  <td className="num cell--strong">{formatMoney(s.TopBuyPriceCr)}</td>
                  <td>{s.TopRunScorer}</td>
                  <td className="num">{s.TopRunScorerRuns}</td>
                  <td>{s.TopWicketTaker}</td>
                  <td className="num">{s.TopWicketTakerWickets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SoWhat>
        Mega auctions ({seasons.filter(s => s.IsMegaAuction).map(s => s.Season).join(', ')}) reset prices upward;
        the {biggest.Season} auction alone spent {formatMoney(biggest.AuctionSpendCr)}. Budget for the next mega auction at today's prices, not last cycle's.
      </SoWhat>
    </div>
  );
}
