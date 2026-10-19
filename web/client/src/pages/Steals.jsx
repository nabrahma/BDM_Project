/**
 * Steals and Overpaid page — Top 10 steals, top 10 overpaid,
 * Bargain XI, Overpaid XI, unsold players.
 * Matches Power BI page 4.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import Loading from '../components/Loading';
import SeasonFilter from '../components/SeasonFilter';
import SoWhat from '../components/SoWhat';

export default function Steals() {
  const [season, setSeason] = useState(2026);
  const navigate = useNavigate();

  const { data: steals, loading: l1 } = useApi(`/rankings/steals?season=${season}`);
  const { data: overpaid, loading: l2 } = useApi(`/rankings/overpaid?season=${season}`);
  const { data: bargainXI, loading: l3 } = useApi(`/rankings/bargain-xi?season=${season}`);
  const { data: overpaidXI, loading: l4 } = useApi(`/rankings/overpaid-xi?season=${season}`);
  const { data: unsold, loading: l5 } = useApi('/rankings/unsold');

  if (l1 || l2 || l3 || l4 || l5) return <Loading />;

  const topSteal = steals?.[0];
  const topOverpaid = overpaid?.[0];

  return (
    <div className="page" id="page-steals">
      <div className="page-header">
        <h1 className="page-header__title">
          {season}: {topSteal ? `₹${topSteal.PriceCr} Cr ${topSteal.PlayerName} returned ${topSteal.ValueIndex?.toFixed(0)}× fair value` : ''}
          {topOverpaid ? ` while ₹${topOverpaid.PriceCr} Cr ${topOverpaid.PlayerName} was overpaid by ${formatMoney(topOverpaid.OverpayCr)}` : ''}
        </h1>
        <p className="page-header__sub">
          Best bargains and worst buys of the season (min 5 matches).
        </p>
      </div>

      <SeasonFilter season={season} onChange={setSeason} />

      <div className="grid-2">
        {/* Top 10 Steals */}
        <div className="card" id="table-steals">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
            Top 10 steals · highest Value Index
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th className="num">Price</th>
                <th className="num">Impact</th>
                <th className="num">Value Index</th>
              </tr>
            </thead>
            <tbody>
              {steals?.map(p => (
                <tr key={p.PlayerSeasonKey} onClick={() => navigate(`/players/${p.PlayerID}`)} style={{ cursor: 'pointer' }}>
                  <td>{p.PlayerName}</td>
                  <td>{p.TeamKey}</td>
                  <td className="num">{formatMoney(p.PriceCr)}</td>
                  <td className="num">{formatNum(p.ImpactPoints)}</td>
                  <td className="num cell--steal">{formatVI(p.ValueIndex)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Top 10 Overpaid */}
        <div className="card" id="table-overpaid">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
            Top 10 overpaid · price above output value
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th className="num">Price</th>
                <th className="num">Impact</th>
                <th className="num">Overpaid by</th>
              </tr>
            </thead>
            <tbody>
              {overpaid?.map(p => (
                <tr key={p.PlayerSeasonKey} onClick={() => navigate(`/players/${p.PlayerID}`)} style={{ cursor: 'pointer' }}>
                  <td>{p.PlayerName}</td>
                  <td>{p.TeamKey}</td>
                  <td className="num">{formatMoney(p.PriceCr)}</td>
                  <td className="num">{formatNum(p.ImpactPoints)}</td>
                  <td className="num cell--overpaid">{formatMoney(p.OverpayCr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bargain XI & Overpaid XI */}
      <div className="grid-2" style={{ marginTop: '20px' }}>
        <div className="card" id="table-bargain-xi">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
            Bargain XI · best value XI
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Player</th>
                <th className="num">Price</th>
                <th className="num">VI</th>
              </tr>
            </thead>
            <tbody>
              {bargainXI?.map(p => (
                <tr key={p.PlayerSeasonKey} onClick={() => navigate(`/players/${p.PlayerID}`)} style={{ cursor: 'pointer' }}>
                  <td>{p.Role}</td>
                  <td>{p.PlayerName}</td>
                  <td className="num">{formatMoney(p.PriceCr)}</td>
                  <td className="num cell--steal">{formatVI(p.ValueIndex)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" id="table-overpaid-xi">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
            Overpaid XI · biggest gap between price and output
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Player</th>
                <th className="num">Price</th>
                <th className="num">Overpaid by</th>
              </tr>
            </thead>
            <tbody>
              {overpaidXI?.map(p => (
                <tr key={p.PlayerSeasonKey} onClick={() => navigate(`/players/${p.PlayerID}`)} style={{ cursor: 'pointer' }}>
                  <td>{p.Role}</td>
                  <td>{p.PlayerName}</td>
                  <td className="num">{formatMoney(p.PriceCr)}</td>
                  <td className="num cell--overpaid">{formatMoney(p.OverpayCr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unsold */}
      <div className="card" style={{ marginTop: '20px' }} id="table-unsold">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>
          Unsold in {season || 2026}
        </h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="num">Base Price</th>
              <th className="num">Career Matches</th>
              <th className="num">Career Impact</th>
            </tr>
          </thead>
          <tbody>
            {unsold?.slice(0, 15).map((p, i) => (
              <tr key={i}>
                <td>{p.Player}</td>
                <td className="num">{formatMoney(p.BasePriceCr)}</td>
                <td className="num">{p.CareerMatches}</td>
                <td className="num">{formatNum(p.CareerImpact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SoWhat>
        Every one of the five most overpaid {season || 2026} players cost ₹14 Cr or more;
        the best value sat in ₹30-lakh buys.
      </SoWhat>
    </div>
  );
}
