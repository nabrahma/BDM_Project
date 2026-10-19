/**
 * Methodology page — static explanation of the Value metric.
 * Content adapted from the project report.
 * Matches Power BI page 8.
 */
export default function Methodology() {
  return (
    <div className="page" id="page-methodology">
      <div className="page-header">
        <h1 className="page-header__title">Methodology</h1>
        <p className="page-header__sub">How the value metric works.</p>
      </div>

      <div className="card" style={{ maxWidth: '860px', lineHeight: 1.8 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Impact Points</h2>
        <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          A single score that captures a player's on-field contribution across batting, bowling, and fielding:
        </p>
        <div className="card card--alt" style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '20px' }}>
          Impact Points = Runs + Fours + 2×Sixes + 25×Wickets + DotBalls + 8×Catches + 12×Stumpings + 6×RunOuts
        </div>
        <p style={{ marginBottom: '24px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          The weights are in the spirit of fantasy-scoring systems. Higher-impact events
          (wickets, stumpings) receive more points. The same players top both runs-only and
          wickets-only views, so the conclusions are robust to reasonable weight changes.
        </p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Fair Value</h2>
        <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          What a player's output would have cost at the league's average price per Impact Point
          that season:
        </p>
        <div className="card card--alt" style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '20px' }}>
          FairValue (₹ Cr) = ImpactPoints × (LeagueSpendCr ÷ LeaguePricedImpact)
        </div>
        <p style={{ marginBottom: '24px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <strong>Overpay</strong> = AuctionPrice − FairValue. Positive means overpaid.
        </p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Value Index</h2>
        <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          The ratio of a player's share of the league's impact to their share of the league's spend:
        </p>
        <div className="card card--alt" style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '20px' }}>
          Value Index = (ImpactPoints ÷ LeaguePricedImpact) ÷ (PriceCr ÷ LeagueSpendCr)
        </div>
        <ul style={{ marginBottom: '24px', color: 'var(--muted)', fontSize: '0.9rem', paddingLeft: '20px' }}>
          <li><strong>1.00</strong> = fair value (the league average)</li>
          <li><strong>&gt; 1</strong> = more output than the money suggests (steal)</li>
          <li><strong>&lt; 1</strong> = less output than the money suggests (overpaid)</li>
        </ul>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Combining Value Index</h2>
        <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <strong>Never average Value Index values.</strong> For any group (team, role, bracket,
          several seasons), sum the shares per season and then divide:
        </p>
        <div className="card card--alt" style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '20px' }}>
          VI(group) = Σ(ImpactPts / LeaguePricedImpact) ÷ Σ(PriceCr / LeagueSpendCr)
        </div>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px' }}>Quadrants</h2>
        <p style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '0.9rem' }}>
          Each season, players are placed into quadrants based on that season's median price and median impact:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div className="card" style={{ borderLeft: '4px solid #F2C94C', padding: '12px' }}>
            <strong>Star</strong> — price ≥ median, impact ≥ median
          </div>
          <div className="card" style={{ borderLeft: '4px solid #3BA55C', padding: '12px' }}>
            <strong>Steal</strong> — price &lt; median, impact ≥ median
          </div>
          <div className="card" style={{ borderLeft: '4px solid #E5484D', padding: '12px' }}>
            <strong>Overpaid</strong> — price ≥ median, impact &lt; median
          </div>
          <div className="card" style={{ borderLeft: '4px solid #A3A3A3', padding: '12px' }}>
            <strong>Passenger</strong> — price &lt; median, impact &lt; median
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          Players with fewer than 5 matches are classified as <strong>Too few matches</strong>.
          Retained players with no auction price are <strong>Unpriced</strong> and excluded from
          value calculations.
        </p>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', marginTop: '24px' }}>Limitations</h2>
        <ul style={{ color: 'var(--muted)', fontSize: '0.9rem', paddingLeft: '20px', lineHeight: 1.8 }}>
          <li>Retained players have no auction price and are excluded from value metrics.</li>
          <li>2013 prices are converted at a single ₹54/$ rate.</li>
          <li>Base prices exist only for 2025–26.</li>
          <li>66 auction buys (1% of spend) could not be matched to Cricsheet.</li>
          <li>Impact Points weights are a judgement call; conclusions hold for reasonable alternatives.</li>
        </ul>
      </div>
    </div>
  );
}
