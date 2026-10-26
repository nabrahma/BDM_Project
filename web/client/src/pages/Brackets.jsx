/**
 * Price Brackets — Value Index by auction price bracket as a stepped funnel (same
 * component as Home), with the breakdown table.
 */
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import ValueFunnel from '../components/ValueFunnel';
import { PageHeader, CardHead, Kpi, Meter, SoWhat } from '../components/ui';

export default function Brackets() {
  const [season, setSeason] = useState('');
  const seasonParam = season ? `&season=${season}` : '';
  const { data, loading } = useApi(`/breakdown?by=PriceBracket${seasonParam}`);

  if (loading || !data) return <Loading />;

  const base = data.find(r => r.group === 'Base price buy');
  const top = data.find(r => r.group === '10 Cr and above');
  const totalSpend = data.reduce((a, r) => a + r.spendCr, 0);
  const label = season ? String(season) : '2013–2026';

  return (
    <div className="page" id="page-brackets">
      <PageHeader
        title="Price Brackets"
        finding={base && top && <>{label}: base-price buys returned <strong>{formatVI(base.valueIndex)}</strong> fair value per crore; ₹10 Cr+ signings returned <strong>{formatVI(top.valueIndex)}</strong>.</>}
        controls={<SeasonFilter season={season} onChange={setSeason} />}
      />

      <div className="kpi-strip">
        {data.map(r => <Kpi key={r.group} label={r.group} value={formatVI(r.valueIndex)} hint={`${r.players} player-seasons`} />)}
      </div>

      <div className="grid-sidebar-right">
        <div className="card" id="chart-brackets">
          <CardHead title="Value per crore" sub="Value Index by price bracket · white markers = fair value (1.0×) · hover a column" />
          <ValueFunnel data={data} height={320} />
        </div>
        <div className="card" id="table-brackets">
          <CardHead title="Where the money went" sub={`Share of ${formatMoney(totalSpend)} spend on priced player-seasons`} />
          {data.map(r => (
            <Meter key={r.group} label={r.group} value={formatMoney(r.spendCr)} pct={100 * r.spendCr / totalSpend}
              tone={r.valueIndex >= 1 ? 'green' : 'red'} title={`Value Index ${formatVI(r.valueIndex)}`} />
          ))}
          <div className="legend" style={{ marginTop: 12 }}>
            <span className="legend__item"><span className="legend__swatch stripes-green" /> returned ≥ fair value</span>
            <span className="legend__item"><span className="legend__swatch stripes-red" /> returned &lt; fair value</span>
          </div>
        </div>
      </div>

      <SoWhat>
        Most of the money sits in the brackets that return the least per crore. Fill depth from the base-price pool and cap marquee bids at fair value.
      </SoWhat>
    </div>
  );
}
