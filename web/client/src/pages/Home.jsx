/**
 * Home — overview: value per crore by price bracket (funnel) with an explore prompt,
 * auction spend split, average price trend, buys and matches per season, and
 * rotating insights. Every number comes from the API.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatNum } from '../lib/format';
import { C, axis, defs, tip } from '../lib/chart';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import ValueFunnel from '../components/ValueFunnel';
import { PageHeader, CardHead, Meter, DotMatrix } from '../components/ui';

const ROUTES = [
  [/squad|build|purse|salary|cap\b|draft|retain/, '/squad-builder'],
  [/steal|bargain|overpa|worst|best buy|unsold|xi\b/, '/steals'],
  [/quadrant|value map|scatter|passenger|\bstar/, '/value-map'],
  [/franchise|team|win|efficien|csk|rcb|\bmi\b|kkr|srh|pbks|\brr\b|\bdc\b|\bgt\b|lsg/, '/franchises'],
  [/overseas|role|nationality|bowler|batter|all.?rounder|keeper|indian/, '/roles'],
  [/bracket|base.?price|marquee|cheap|expensive|crore/, '/brackets'],
  [/market|inflation|price trend|mega|mini|spend|orange cap|purple cap/, '/market'],
  [/method|formula|impact point|value index|how/, '/methodology'],
];
const TOKENS = [
  ['/steals and overpaid', '/steals'],
  ['/value map', '/value-map'],
  ['/franchise efficiency', '/franchises'],
  ['/price brackets', '/brackets'],
  ['/squad builder', '/squad-builder'],
];

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
const signed = r => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(2)}`;

function ExplorePrompt() {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState('');
  const navigate = useNavigate();
  const go = e => {
    e.preventDefault();
    const q = text.trim().toLowerCase();
    if (!q) return;
    const hit = ROUTES.find(([re]) => re.test(q));
    navigate(hit ? hit[1] : `/players?q=${encodeURIComponent(text.trim())}`);
  };
  return (
    <div className="prompt" style={{ position: 'relative', zIndex: 2, marginTop: -12 }}>
      <div className="prompt__head">
        <span><Icon name="sparkle" size={15} style={{ color: C.blue }} /> What would you like to explore next?</span>
        <button type="button" className="icon-btn icon-btn--sm" style={{ width: 26, height: 26, background: 'transparent', border: 'none' }}
          onClick={() => setOpen(o => !o)} aria-label={open ? 'Hide suggestions' : 'Show suggestions'}>
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={15} />
        </button>
      </div>
      <form className="prompt__box" onSubmit={go}>
        <input value={text} onChange={e => setText(e.target.value)} aria-label="Explore"
          placeholder="Ask about a topic (e.g. “overseas premium”) or type a player name (e.g. Kohli)" />
        <button type="submit" className="btn-dark" aria-label="Go"><Icon name="enter" size={14} /> Go</button>
      </form>
      {open && (
        <div className="prompt__tokens">
          {TOKENS.map(([t, to]) => <Link key={to} to={to} className="token">{t}</Link>)}
        </div>
      )}
    </div>
  );
}

function InsightCarousel({ slides }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI(k => (k + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  const s = slides[i];
  return (
    <div className="insight" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 330 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite">
      <span className="insight__chip" style={{ alignSelf: 'flex-start' }}><Icon name="bulb" size={14} /> Insights</span>
      <div style={{ marginTop: 'auto' }}>
        <div className="insight__big" style={s.bigSize ? { fontSize: s.bigSize } : undefined}>{s.big}</div>
        <div className="insight__head" style={{ marginTop: 14 }}>{s.head}</div>
        <div className="insight__text" style={{ marginTop: 8 }}>{s.text}</div>
      </div>
      <div className="insight__bars" role="tablist" aria-label="Insights">
        {slides.map((x, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={x.head}
            className={`insight__bar${k === i ? ' insight__bar--on' : ''}`} onClick={() => setI(k)} style={{ padding: 0, cursor: 'pointer' }} />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: summary, loading: l1 } = useApi('/summary');
  const { data: brackets, loading: l2 } = useApi('/breakdown?by=PriceBracket');
  const { data: matrix, loading: l3 } = useApi('/team-seasons/matrix');

  const derived = useMemo(() => {
    if (!summary || !brackets || !matrix) return null;
    const seasons = summary.seasons;
    const first = seasons[0], latest = seasons[seasons.length - 1];
    const mega = seasons.filter(s => s.IsMegaAuction);
    const latestMega = [...mega].reverse()[0];
    const megaSpend = mega.reduce((a, s) => a + s.AuctionSpendCr, 0);
    const miniSpend = seasons.filter(s => !s.IsMegaAuction && s !== latest).reduce((a, s) => a + s.AuctionSpendCr, 0);
    const total = summary.totalSpendCr;
    const ts = matrix.filter(r => r.WinPct != null && r.SpendCr != null && r.ValueIndex != null);
    const rSpend = pearson(ts.map(r => r.SpendCr), ts.map(r => r.WinPct));
    const rVI = pearson(ts.map(r => r.ValueIndex), ts.map(r => r.WinPct));
    const base = brackets.find(b => b.group === 'Base price buy');
    const top = brackets.find(b => b.group === '10 Cr and above');
    const peakBuys = seasons.reduce((m, s, i) => (s.PlayersBought > seasons[m].PlayersBought ? i : m), 0);
    const peakMatches = seasons.reduce((m, s, i) => (s.Matches > seasons[m].Matches ? i : m), 0);
    const peakPrice = seasons.reduce((m, s) => (s.AvgPriceCr > m.AvgPriceCr ? s : m), seasons[0]);
    const topBuy = seasons.reduce((m, s) => (s.TopBuyPriceCr > m.TopBuyPriceCr ? s : m), seasons[0]);
    return { seasons, first, latest, latestMega, megaSpend, miniSpend, total, ts, rSpend, rVI, base, top, peakBuys, peakMatches, peakPrice, topBuy, megaCount: mega.length };
  }, [summary, brackets, matrix]);

  if (l1 || l2 || l3 || !derived) return <Loading />;
  const d = derived;
  const totalMatches = d.seasons.reduce((a, s) => a + s.Matches, 0);

  const slides = [
    { big: `${d.base.valueIndex.toFixed(1)}×`, head: 'Base-price buys return the most output per crore',
      text: `Across ${d.first.Season}–${d.latest.Season}, ₹10 Cr+ signings returned ${d.top.valueIndex.toFixed(2)}× fair value.` },
    { big: `${Number(summary.priceInflation).toFixed(1)}×`, head: `Average auction price has doubled since ${d.first.Season}`,
      text: `${formatMoney(d.first.AvgPriceCr)} per buy in ${d.first.Season}, ${formatMoney(d.latestMega.AvgPriceCr)} at the ${d.latestMega.Season} mega auction.` },
    { big: `r = ${signed(d.rVI)}`, bigSize: '3.2rem', head: 'Efficient auctions win; bigger budgets do not',
      text: `Spend vs win %: r = ${signed(d.rSpend)} across ${d.ts.length} team-seasons.` },
  ];

  return (
    <div className="page" id="page-home">
      <PageHeader
        title="Overview"
        finding={<>Which IPL auction buys earned their price? Every buy from {d.first.Season} to {d.latest.Season}, scored on runs, wickets and catches <strong>per crore</strong>.</>}
        controls={<>
          <div className="chip-group">
            <span className="chip chip--on" style={{ cursor: 'default' }}><Icon name="calendar" size={15} /> {d.first.Season} – {d.latest.Season}</span>
            <span className="chip__note">{formatNum(summary.totalBuys)} buys · {formatNum(totalMatches)} matches</span>
          </div>
          <Link to="/methodology" className="chip chip--solo">How it works</Link>
          <Link to="/squad-builder" className="btn-dark" style={{ height: 42, borderRadius: 13, padding: '0 16px' }}>
            Squad Builder <Icon name="plus" size={14} />
          </Link>
        </>}
      />

      <div className="home-top">
        <div className="card" style={{ paddingBottom: 16 }}>
          <CardHead title="Value per crore" sub="Value Index by auction price bracket · 1.0× = fair value" to="/brackets" />
          <ValueFunnel data={brackets} />
          <ExplorePrompt />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <CardHead title="Auction spend" to="/market" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '10px 0 22px' }}>
            <span className="display-num">₹{formatNum(Math.round(d.total))}<span style={{ fontSize: '1.4rem', color: 'var(--muted)', marginLeft: 6, letterSpacing: 0 }}>Cr</span></span>
            <span className="delta delta--up" title={`Average price, ${d.latestMega.Season} mega auction vs ${d.first.Season}`}>
              <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden="true"><path d="M4.5 0 9 8H0z" fill="currentColor" /></svg>
              {Number(summary.priceInflation).toFixed(1)}× price
            </span>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 6 }}>
            <Meter label={`Mega auctions (${d.megaCount})`} value={formatMoney(d.megaSpend)} pct={100 * d.megaSpend / d.total} tone="blue" />
            <Meter label={`Mini auctions ${d.first.Season}–${d.latest.Season - 1}`} value={formatMoney(d.miniSpend)} pct={100 * d.miniSpend / d.total} tone="green" />
            <Meter label={`${d.latest.Season} auction`} value={formatMoney(d.latest.AuctionSpendCr)} pct={100 * d.latest.AuctionSpendCr / d.total} tone="pink" />
          </div>
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 16 }}>
            <div className="card card--alt" style={{ padding: '14px 16px' }}>
              <div className="kpi__label">Average per buy</div>
              <div style={{ fontSize: '1.4rem', letterSpacing: '-0.03em', marginTop: 4 }}>{formatMoney(summary.avgPriceCr)}</div>
            </div>
            <div className="card card--alt" style={{ padding: '14px 16px' }}>
              <div className="kpi__label">Record buy · {d.topBuy.Season}</div>
              <div style={{ fontSize: '1.4rem', letterSpacing: '-0.03em', marginTop: 4 }}>{formatMoney(d.topBuy.TopBuyPriceCr)}</div>
              <div className="kpi__hint" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.topBuy.TopBuyPlayer}</div>
            </div>
          </div>
          <div style={{ paddingTop: 12, fontSize: '0.76rem', color: 'var(--faint)' }}>
            {summary.matchPct}% of auction spend matched to ball-by-ball data
          </div>
        </div>
      </div>

      <div className="home-bottom">
        <div className="card">
          <CardHead title="Average price per buy" to="/market" />
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.seasons} margin={{ top: 34, right: 6, bottom: 0, left: -18 }}>
                {defs('avg', C.rose)}
                <XAxis dataKey="Season" {...axis} tickFormatter={v => `’${String(v).slice(2)}`} interval={1} />
                <YAxis {...axis} tickFormatter={v => `₹${v}`} width={52} domain={[0, Math.ceil(d.peakPrice.AvgPriceCr)]} allowDecimals={false} />
                <Tooltip cursor={{ stroke: C.rose, strokeOpacity: 0.25 }}
                  content={tip(s => ({ title: `${s.Season} · ${s.AuctionType}`, rows: [['Average price', formatMoney(s.AvgPriceCr)], ['Buys', s.PlayersBought]] }))} />
                <Area type="stepAfter" dataKey="AvgPriceCr" stroke={C.rose} strokeWidth={2} fill="url(#vline-avg)" isAnimationActive={false}
                  activeDot={{ r: 4, fill: C.rose, stroke: 'var(--card)', strokeWidth: 2 }} />
                <ReferenceDot x={d.peakPrice.Season} y={d.peakPrice.AvgPriceCr} r={3.5} fill={C.rose} stroke="var(--card)" strokeWidth={1.5}
                  label={({ viewBox }) => (
                    <g transform={`translate(${viewBox.x},${viewBox.y - 22})`}>
                      <rect x={-34} y={-12} width={68} height={22} rx={8} fill="var(--card)" stroke={C.grid} />
                      <text x={0} y={3} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.ink}>{formatMoney(d.peakPrice.AvgPriceCr)}</text>
                    </g>
                  )} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <CardHead title="Auction buys" to="/market" />
            <div className="stat-row">
              <span className="display-num" style={{ fontSize: '2.8rem' }}>{formatNum(summary.totalBuys)}</span>
              <div style={{ position: 'relative', justifySelf: 'center', paddingTop: 30 }}>
                <span className="tag" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
                  Peak:<strong>{d.seasons[d.peakBuys].Season}</strong>
                </span>
                <DotMatrix data={d.seasons.map(s => ({ label: String(s.Season), value: s.PlayersBought }))}
                  perDot={Math.ceil(d.seasons[d.peakBuys].PlayersBought / 6)} color={C.blue} highlight={d.peakBuys} height={78}
                  format={v => `${v} buys`} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{d.latest.Season} auction</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.02em' }}>{d.latest.PlayersBought} buys</div>
              </div>
            </div>
          </div>
          <div className="card">
            <CardHead title="Matches analysed" to="/methodology" />
            <div className="stat-row">
              <span className="display-num" style={{ fontSize: '2.8rem' }}>{formatNum(totalMatches)}</span>
              <div style={{ position: 'relative', justifySelf: 'center', paddingTop: 30 }}>
                <span className="tag" style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
                  Most:<strong>{d.seasons[d.peakMatches].Season}</strong>
                </span>
                <DotMatrix data={d.seasons.map(s => ({ label: String(s.Season), value: s.Matches }))}
                  perDot={Math.ceil(d.seasons[d.peakMatches].Matches / 6)} color={C.accent} highlight={d.peakMatches} height={78}
                  format={v => `${v} matches`} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Players in data</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 500, letterSpacing: '-0.02em' }}>{formatNum(summary.totalPlayers)}</div>
              </div>
            </div>
          </div>
        </div>

        <InsightCarousel slides={slides} />
      </div>
    </div>
  );
}
