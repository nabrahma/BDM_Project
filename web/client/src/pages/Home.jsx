/**
 * Home page — KPI strip + navigation cards to each dashboard page.
 * Matches the Power BI Home page design.
 */
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { formatMoney, formatNum } from '../lib/format';
import Loading from '../components/Loading';

const NAV_CARDS = [
  { num: '01', title: 'Auction Market', desc: 'How far have prices inflated since 2013?', path: '/market' },
  { num: '02', title: 'Franchise Efficiency', desc: 'Who gets the most impact per crore, and does it win?', path: '/franchises' },
  { num: '03', title: 'Player Value Map', desc: 'Price vs impact for every buy: Stars, Steals, Overpaid', path: '/value-map' },
  { num: '04', title: 'Steals and Overpaid', desc: 'Best bargains, worst buys, Bargain XI and Overpaid XI', path: '/steals' },
  { num: '05', title: 'Role and Nationality', desc: 'Are all-rounders and overseas stars worth the premium?', path: '/roles' },
  { num: '06', title: 'Price Brackets', desc: 'Do base-price buys beat marquee signings per crore?', path: '/brackets' },
  { num: '07', title: '⚡ Squad Builder & Simulator', desc: 'Draft an 11-player squad under budget cap, scored on Value for Money', path: '/squad-builder' },
];

const QUESTIONS = [
  'Build a squad under ₹120 Cr cap',
  'Most impact per crore',
  'Best bargains & worst buys',
  'Does efficiency win matches?',
  'Roles & overseas premium',
  'Price inflation since 2013',
  'Base-price vs marquee buys',
];

export default function Home() {
  const { data, loading } = useApi('/summary');
  const navigate = useNavigate();

  if (loading || !data) return <Loading />;

  return (
    <div className="page" id="page-home">
      {/* Hero */}
      <div className="page-header">
        <h1 className="page-header__title" style={{ fontSize: '1.8rem' }}>
          Which IPL auction buys earned their price?
        </h1>
        <p className="page-header__sub">
          Every auction buy from 2013 to 2026, scored on runs, wickets and fielding per crore,
          then rolled up to franchises, roles and price brackets.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip" id="home-kpis">
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(data.totalSpendCr)}</div>
          <div className="kpi__label">Auction spend 2013–2026</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatNum(data.totalBuys)}</div>
          <div className="kpi__label">Auction buys</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{formatMoney(data.avgPriceCr)}</div>
          <div className="kpi__label">Average price per buy</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{data.priceInflation}x</div>
          <div className="kpi__label">Price inflation, 2025 vs 2013</div>
        </div>
        <div className="card kpi">
          <div className="kpi__value">{data.matchPct}%</div>
          <div className="kpi__label">Spend matched to ball-by-ball data</div>
        </div>
      </div>

      {/* Questions + Nav Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px' }}>
        <div className="card card--dark">
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '12px' }}>Questions answered</h3>
          <ul style={{ listStyle: 'none', fontSize: '0.85rem', lineHeight: 1.8 }}>
            {QUESTIONS.map(q => (
              <li key={q}>
                <span style={{ color: 'var(--yellow)', marginRight: '8px' }}>✓</span>
                {q}
              </li>
            ))}
          </ul>
        </div>

        <div className="nav-cards" id="home-nav-cards">
          {NAV_CARDS.map(({ num, title, desc, path }) => (
            <div
              key={num}
              className="card card--alt nav-card"
              onClick={() => navigate(path)}
              role="button"
              tabIndex={0}
              id={`nav-card-${num}`}
            >
              <div className="nav-card__num">{num}</div>
              <div className="nav-card__title">{title}</div>
              <div className="nav-card__desc">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
