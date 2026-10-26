/**
 * ui.jsx — shared layout pieces: page header, card header, KPI tile, striped meter,
 * dot matrix and the gradient insight strip.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';

/** Big light title + finding line on the left, controls on the right. */
export function PageHeader({ title, finding, controls }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        <h1 className="page-head__title">
          {title}
          <button type="button" className="icon-btn icon-btn--sm" onClick={copy}
            title={copied ? 'Link copied' : 'Copy link to this page'} aria-label="Copy link to this page">
            <Icon name={copied ? 'check' : 'link'} size={15} />
          </button>
        </h1>
        {finding && <p className="page-head__finding">{finding}</p>}
      </div>
      {controls && <div className="page-head__controls">{controls}</div>}
    </div>
  );
}

/** Card title row; `to` adds a round arrow button linking to the detail page. */
export function CardHead({ title, sub, to, right }) {
  return (
    <div className="card-head">
      <div>
        <div className="card-head__title">{title}</div>
        {sub && <div className="card-head__sub">{sub}</div>}
      </div>
      {right}
      {to && (
        <Link to={to} className="icon-btn icon-btn--sm" title={`Open ${title}`} aria-label={`Open ${title}`}>
          <Icon name="arrowUpRight" size={15} />
        </Link>
      )}
    </div>
  );
}

export function Kpi({ label, value, hint, small }) {
  return (
    <div className="card kpi">
      <div className="kpi__label">{label}</div>
      <div className={`kpi__value${small ? ' kpi__value--sm' : ''}`}>{value}</div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  );
}

/** Label + value on one line, striped progress bar below. tone: blue | green | pink | red | grey */
export function Meter({ label, value, pct, tone = 'blue', title }) {
  return (
    <div className="meter-row" title={title}>
      <div className="meter-row__top">
        <span className="meter-row__label">{label}</span>
        <span className="meter-row__value">{value}</span>
      </div>
      <div className="meter" role="img" aria-label={`${label}: ${value}`}>
        <div className={`meter__fill stripes-${tone}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

/**
 * Columns of dots (one dot per `perDot` units). The highlighted column is solid,
 * the rest are tinted; each column carries a native tooltip with the exact value.
 */
export function DotMatrix({ data, perDot, color, highlight, height = 96, format = v => v }) {
  return (
    <div className="dots" style={{ height }} role="img"
      aria-label={data.map(d => `${d.label}: ${format(d.value)}`).join(', ')}>
      {data.map((d, i) => {
        const n = Math.max(1, Math.round(d.value / perDot));
        const on = i === highlight;
        return (
          <div className="dots__col" key={d.label} title={`${d.label}: ${format(d.value)}`}>
            {Array.from({ length: n }, (_, k) => (
              <span key={k} className="dots__dot"
                style={{ background: color, opacity: on ? 1 : 0.38 + 0.04 * Math.min(k, 6) }} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Page-level "So what" as a gradient insight strip. */
export function SoWhat({ children }) {
  return (
    <div className="insight so-what" id="so-what-panel">
      <span className="insight__chip"><Icon name="bulb" size={14} /> So what</span>
      <div className="so-what__text">{children}</div>
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map(({ label, color, style }) => (
        <span className="legend__item" key={label}>
          <span className="legend__swatch" style={{ background: color, ...style }} />
          {label}
        </span>
      ))}
    </div>
  );
}
