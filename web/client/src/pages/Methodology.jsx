/**
 * Methodology — how Impact Points, Fair Value, Value Index and quadrants are defined,
 * the weights, the data sources and the limitations.
 */
import { PageHeader, CardHead } from '../components/ui';
import { QUADRANT } from '../lib/chart';

const WEIGHTS = [
  ['Run', '1'], ['Four (bonus)', '+1'], ['Six (bonus)', '+2'], ['Wicket', '25'],
  ['Dot ball', '1'], ['Catch', '8'], ['Stumping', '12'], ['Run-out involvement', '6'],
];
const QUADS = [
  ['Star', 'price ≥ median, impact ≥ median'],
  ['Steal', 'price < median, impact ≥ median'],
  ['Overpaid', 'price ≥ median, impact < median'],
  ['Passenger', 'price < median, impact < median'],
];
const SOURCES = [
  ['Auction prices 2013–2026', 'Kaggle IPL Auction Dataset (14 auctions, 1,380 buys)'],
  ['Ball-by-ball data', 'Cricsheet IPL JSON (921 matches, 2013–2026)'],
  ['Player identities', 'Cricsheet Register; 96 hand-checked name fixes'],
  ['Roles & nationality', 'Kaggle 2013–22 auction list, official 2025 auction list'],
  ['Unsold 2026', 'Wisden unsold list (79 players)'],
];

const formula = { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.84rem', background: 'var(--card-alt)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', margin: '12px 0', lineHeight: 1.6 };
const p = { color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.65 };

export default function Methodology() {
  return (
    <div className="page" id="page-methodology">
      <PageHeader title="Methodology" finding="One score for bat, ball and field, judged against each season's own market." />

      <div className="grid-3">
        <div className="card">
          <CardHead title="Impact Points" sub="On-field output on one scale" />
          <div style={formula}>Runs + Fours + 2×Sixes + 25×Wickets + Dot balls + 8×Catches + 12×Stumpings + 6×Run-outs</div>
          <table className="data-table">
            <thead><tr><th>Contribution</th><th className="num">Points</th></tr></thead>
            <tbody>{WEIGHTS.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num cell--strong">{v}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="card">
          <CardHead title="Value Index" sub="Output share ÷ spend share, per season" />
          <div style={formula}>(Impact ÷ League priced impact) ÷ (Price ÷ League auction spend)</div>
          <p style={p}><strong style={{ color: 'var(--ink)' }}>1.00</strong> is fair value; above 1 means more output than the money suggests, below 1 less.</p>
          <p style={{ ...p, marginTop: 10 }}>For a group (team, role, bracket, several seasons) the shares are <strong style={{ color: 'var(--ink)' }}>summed season by season, then divided</strong>. Value Index values are never averaged.</p>
          <div style={formula}>VI(group) = Σ(Impact ÷ League impact) ÷ Σ(Price ÷ League spend)</div>
        </div>

        <div className="card">
          <CardHead title="Fair value & overpay" sub="What the output would have cost" />
          <div style={formula}>Fair value = Impact × (League spend ÷ League priced impact)</div>
          <div style={formula}>Overpay = Price − Fair value</div>
          <p style={p}>Positive overpay means overpaid. “Most overpaid” ranks by crores lost, because a ratio becomes extreme for ₹30-lakh players.</p>
        </div>
      </div>

      <div className="grid-2 mt">
        <div className="card">
          <CardHead title="Value quadrants" sub="Compared with that season's median price and median Impact Points" />
          <div className="grid-2" style={{ gap: 10 }}>
            {QUADS.map(([q, rule]) => (
              <div key={q} className="card card--alt" style={{ padding: '14px 16px' }}>
                <div style={{ fontWeight: 500 }}><span className="swatch" style={{ background: QUADRANT[q] }} />{q}</div>
                <div style={{ ...p, fontSize: '0.8rem', marginTop: 4 }}>{rule}</div>
              </div>
            ))}
          </div>
          <p style={{ ...p, marginTop: 12 }}>Fewer than 5 matches: <strong style={{ color: 'var(--ink)' }}>Too few matches</strong>. Retained players with no auction price: <strong style={{ color: 'var(--ink)' }}>Unpriced</strong>, excluded from value measures.</p>
        </div>

        <div className="card">
          <CardHead title="Data sources" sub="Validated against official auction totals and Orange/Purple Caps" />
          <table className="data-table">
            <tbody>{SOURCES.map(([k, v]) => <tr key={k}><td className="cell--strong">{k}</td><td style={{ color: 'var(--muted)' }}>{v}</td></tr>)}</tbody>
          </table>
          <CardHead title="Limitations" />
          <ul style={{ ...p, paddingLeft: 18 }}>
            <li>Retained players have no auction price and are excluded from value measures.</li>
            <li>2013 prices are converted at a single ₹54 per US$.</li>
            <li>Base prices exist only for 2025–26.</li>
            <li>66 buys (1% of spend, mostly players who never played) are not matched to Cricsheet.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
