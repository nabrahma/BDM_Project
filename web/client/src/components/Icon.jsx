/**
 * Icon — small stroke icon set (24px grid, 1.8 stroke) used across the UI.
 */
const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" /><path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: <path d="M12 3.5 13.7 9a2 2 0 0 0 1.3 1.3l5.5 1.7-5.5 1.7a2 2 0 0 0-1.3 1.3L12 20.5 10.3 15A2 2 0 0 0 9 13.7L3.5 12 9 10.3A2 2 0 0 0 10.3 9z" />,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" /></>,
  enter: <path d="M20 5v7a3 3 0 0 1-3 3H6m4-4-4 4 4 4" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
};

export default function Icon({ name, size = 18, stroke = 1.8, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {PATHS[name]}
    </svg>
  );
}
