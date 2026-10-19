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

/** Get raw hex colour for Recharts (CSS vars don't work there) */
export function quadrantHex(q) {
  const map = {
    'Steal': '#3BA55C',
    'Star': '#F2C94C',
    'Overpaid': '#E5484D',
    'Passenger': '#A3A3A3',
    'Too few matches': '#D6D3CC',
    'Unpriced': '#C9C5BC',
  };
  return map[q] || '#A8A396';
}
