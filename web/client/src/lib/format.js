/**
 * format.js — Formatting utilities for the dashboard.
 * ₹19.5 Cr, ₹30 L, 1.63×, percentages.
 */

/** Format money in crores / lakhs */
export function formatMoney(cr) {
  if (cr == null) return '—';
  if (Math.abs(cr) < 1) {
    const lakhs = cr * 100;
    return `₹${Number(lakhs.toFixed(0))} L`;
  }
  if (Math.abs(cr) >= 100) return `₹${Math.round(cr).toLocaleString('en-IN')} Cr`;
  return `₹${Number(cr.toFixed(1))} Cr`;
}

/** Format Value Index to 2 decimals with × suffix */
export function formatVI(vi) {
  if (vi == null) return '—';
  return `${vi.toFixed(2)}×`;
}

/** Format percentage */
export function formatPct(val) {
  if (val == null) return '—';
  return `${(val * 100).toFixed(1)}%`;
}

/** Format large number with commas */
export function formatNum(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-IN');
}

/** Get the CSS colour for a quadrant */
export function quadrantColour(q) {
  const map = {
    'Steal': 'var(--steal)',
    'Star': 'var(--star)',
    'Overpaid': 'var(--overpaid)',
    'Passenger': 'var(--passenger)',
    'Too few matches': 'var(--too-few)',
    'Unpriced': 'var(--unpriced)',
  };
  return map[q] || 'var(--faint)';
}

/** Raw hex colour for Recharts (CSS vars don't work there); same values as lib/chart.jsx QUADRANT */
export function quadrantHex(q) {
  const map = {
    'Steal': '#2BAF66',
    'Star': '#3366FF',
    'Overpaid': '#B8165A',
    'Passenger': '#9A9AA5',
    'Too few matches': '#D4D4DA',
    'Unpriced': '#E4E4E9',
  };
  return map[q] || '#A3A3AD';
}
