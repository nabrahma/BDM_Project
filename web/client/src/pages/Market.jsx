/**
 * Auction Market page — Avg price per season, spend trend, top buys.
 * Mega auctions highlighted. Matches Power BI page 1.
 */
import { useApi } from '../hooks/useApi';
import { formatMoney, formatNum } from '../lib/format';
import Loading from '../components/Loading';
import SoWhat from '../components/SoWhat';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine, Cell,
} from 'recharts';

export default function Market() {
  const { data: seasons, loading } = useApi('/seasons');

  if (loading || !seasons) return <Loading />;

  const latest = seasons[seasons.length - 1];

  return (
    <div className="page" id="page-market">
      <div className="page-header">
        <h1 className="page-header__title">
          Auction Market — prices have doubled since 2013
        </h1>
        <p className="page-header__sub">
          Average price, total spend and top buy per season. Mega auctions in yellow.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="card kpi">
          <div className="kpi__value">{seasons.length}</div>
          <div className="kpi__label">Seasons</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatNum(seasons.reduce((s, r) => s + r.PlayersBought, 0))}</div>
          <div className="kpi__label">Total buys</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(latest.AvgPriceCr)}</div>
          <div className="kpi__label">Avg price {latest.Season}</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(latest.TopBuyPriceCr)}</div>
          <div className="kpi__label">Top buy {latest.Season}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Average Price Trend */}
        <div className="card" id="chart-avg-price">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Average auction price per season
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={seasons} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis dataKey="Season" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toFixed(2)} Cr`, 'Avg Price']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Bar dataKey="AvgPriceCr" radius={[6, 6, 0, 0]}>
                {seasons.map((s, i) => (
                  <Cell
                    key={i}
                    fill={s.IsMegaAuction ? '#F2C94C' : '#262626'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="dot-legend" style={{ marginTop: '8px' }}>
            <div className="dot-legend__item">
              <div className="dot-legend__swatch" style={{ background: '#F2C94C' }} />
              Mega auction
            </div>
            <div className="dot-legend__item">
              <div className="dot-legend__swatch" style={{ background: '#262626' }} />
              Mini auction
            </div>
          </div>
        </div>

        {/* Total Spend Trend */}
        <div className="card" id="chart-total-spend">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            Total auction spend per season
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={seasons} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ECE8DF" />
              <XAxis dataKey="Season" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
              <Tooltip
                formatter={(v) => [`₹${Number(v).toFixed(1)} Cr`, 'Spend']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #ECE8DF' }}
              />
              <Line
                type="monotone"
                dataKey="AuctionSpendCr"
                stroke="#F2C94C"
                strokeWidth={3}
                dot={{ fill: '#262626', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Buys Table */}
      <div className="card" style={{ marginTop: '20px' }} id="table-top-buys">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
          Top buy each season
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>Type</th>
              <th>Top Buy</th>
              <th className="num">Price</th>
              <th>Orange Cap</th>
              <th className="num">Runs</th>
              <th>Purple Cap</th>
              <th className="num">Wickets</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.Season}>
                <td style={{ fontWeight: 600 }}>{s.Season}</td>
                <td>{s.IsMegaAuction ? <span className="pill pill--mega">MEGA</span> : 'Mini'}</td>
                <td>{s.TopBuyPlayer}</td>
                <td className="num" style={{ fontWeight: 600 }}>{formatMoney(s.TopBuyPriceCr)}</td>
                <td>{s.TopRunScorer}</td>
                <td className="num">{s.TopRunScorerRuns}</td>
                <td>{s.TopWicketTaker}</td>
                <td className="num">{s.TopWicketTakerWickets}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SoWhat>
        Average auction price has doubled: ₹1.73 Cr per buy in 2013, ₹3.51 Cr at the 2025 mega auction (₹2.80 Cr in the 2026 mini auction).
        Mega auctions (2014, 2018, 2022, 2025) step-change the spending — the 2025 mega auction
        saw ₹639 Cr spent, the most ever.
      </SoWhat>
    </div>
  );
}
