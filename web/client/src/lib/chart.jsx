/**
 * chart.jsx — chart palette and Recharts helpers so every chart shares one look:
 * recessive axes, horizontal hairline grid, striped fills, white pill tooltips.
 * Colours are CSS variables from index.css, so charts follow the light/dark theme; both palettes were
 * validated with the dataviz validate_palette script (all pairs, against each mode's card surface).
 */
export const C = {
  blue: 'var(--blue)',
  blue2: 'var(--blue-2)',
  blueSoft: 'var(--blue-soft)',
  green: 'var(--green)',
  pink: 'var(--pink)',
  rose: 'var(--rose)',
  accent: 'var(--accent)',
  neutral: 'var(--neutral)',
  neutral2: 'var(--neutral-2)',
  neutral3: 'var(--neutral-3)',
  grid: 'var(--grid)',
  faint: 'var(--faint)',
  muted: 'var(--muted)',
  ink: 'var(--ink)',
};

/** Fixed meaning on every page. */
export const QUADRANT = {
  Steal: C.green,
  Star: C.blue,
  Overpaid: C.pink,
  Passenger: C.neutral,
  'Too few matches': C.neutral2,
  Unpriced: C.neutral3,
};

export const axis = {
  tick: { fontSize: 11, fill: C.faint },
  axisLine: false,
  tickLine: false,
};

/**
 * <defs> with a diagonal-stripe pattern (`stripe-<id>`), a vertical gradient (`grad-<id>`)
 * and a vertical hairline pattern (`vline-<id>`) for one colour. Call inside a chart: {defs('blue', C.blue)}
 */
export function defs(id, color, light = '#FFFFFF') {
  return (
    <defs key={`defs-${id}`}>
      <pattern id={`stripe-${id}`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
        <rect width="7" height="7" fill={color} />
        <rect width="2.6" height="7" fill={light} fillOpacity="0.38" />
      </pattern>
      <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="1" />
        <stop offset="100%" stopColor={color} stopOpacity="0.62" />
      </linearGradient>
      <pattern id={`vline-${id}`} patternUnits="userSpaceOnUse" width="5" height="10">
        <rect width="1.4" height="10" fill={color} fillOpacity="0.22" />
      </pattern>
    </defs>
  );
}

/** Tooltip body: title + rows of [label, value]. Use with <Tooltip content={tip(fn)} /> */
export function tip(rowsFor) {
  return function ChartTip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const { title, rows } = rowsFor(payload[0].payload, label, payload);
    return (
      <div className="tip">
        {title && <div className="tip__title">{title}</div>}
        {rows.map(([k, v], i) => (
          <div key={i}>{k}: <strong>{v}</strong></div>
        ))}
      </div>
    );
  };
}
