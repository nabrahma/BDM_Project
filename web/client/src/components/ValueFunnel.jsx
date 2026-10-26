/**
 * ValueFunnel — Value Index by price bracket drawn as a stepped funnel: one column per
 * bracket (label + value on top), striped bars, slanted connectors, a fair-value marker
 * (1.0×) in every column and a hover tooltip. The active column is solid and highlighted.
 */
import { useEffect, useRef, useState } from 'react';
import { formatMoney, formatVI, formatNum } from '../lib/format';
import { C, defs } from '../lib/chart';

const LABELS = {
  'Base price buy': 'Base price',
  'Under 2 Cr': 'Under ₹2 Cr',
  '2 to 5 Cr': '₹2–5 Cr',
  '5 to 10 Cr': '₹5–10 Cr',
  '10 Cr and above': '₹10 Cr +',
};

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export default function ValueFunnel({ data, height = 290 }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(0);
  const GUTTER = 36, HEAD = 64;
  const n = data.length;
  const cw = n ? Math.max(0, (width - GUTTER) / n) : 0;
  const yMax = Math.max(2, Math.ceil(Math.max(...data.map(d => d.valueIndex || 0)) * 2) / 2);
  const y = v => height - (v / yMax) * (height - 20);
  const bw = cw * 0.84;
  const ticks = Array.from({ length: Math.floor(yMax) + 1 }, (_, i) => i);
  const a = data[active];

  return (
    <div ref={ref} style={{ position: 'relative', height: HEAD + height, userSelect: 'none' }}
      onMouseLeave={() => setActive(0)}>
      {/* column highlight + separators */}
      {data.map((d, i) => (
        <div key={`col-${d.group}`} style={{
          position: 'absolute', top: 0, bottom: 0, left: GUTTER + i * cw, width: cw,
          borderLeft: `1px solid ${C.grid}`,
          background: i === active ? 'linear-gradient(180deg, transparent 0%, var(--blue-soft) 100%)' : 'transparent',
          transition: 'background 0.2s ease',
        }} onMouseEnter={() => setActive(i)} />
      ))}

      {/* headers */}
      {data.map((d, i) => (
        <div key={`h-${d.group}`} style={{ position: 'absolute', top: 2, left: GUTTER + i * cw + 10, width: cw - 14, pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.74rem', color: i === active ? C.ink : C.faint, fontWeight: i === active ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {LABELS[d.group] || d.group}
          </div>
          <div style={{ fontSize: Math.max(13, Math.min(24.8, cw / 4.4)), letterSpacing: '-0.03em', color: i === active ? C.ink : 'var(--faint)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
            {formatVI(d.valueIndex)}
          </div>
        </div>
      ))}

      {/* y ticks */}
      {ticks.map(t => (
        <div key={`t-${t}`} style={{ position: 'absolute', left: 0, top: HEAD + y(t) - 8, fontSize: 11, color: C.faint, width: GUTTER - 8, textAlign: 'right' }}>
          {t}×
        </div>
      ))}

      {width > 0 && (
        <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: HEAD, pointerEvents: 'none', overflow: 'visible' }}
          role="img" aria-label={data.map(d => `${d.group}: ${formatVI(d.valueIndex)}`).join(', ')}>
          {defs('funnel', C.blue)}
          <defs>
            <linearGradient id="funnel-side" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue2} stopOpacity="0.45" />
              <stop offset="100%" stopColor={C.blue2} stopOpacity="0.08" />
            </linearGradient>
          </defs>
          {data.map((d, i) => {
            const x = GUTTER + i * cw;
            const top = y(d.valueIndex || 0);
            const next = data[i + 1];
            return (
              <g key={d.group}>
                {next && (
                  <polygon points={`${x + bw},${top} ${x + cw},${y(next.valueIndex || 0)} ${x + cw},${height} ${x + bw},${height}`}
                    fill="url(#funnel-side)" />
                )}
                <rect x={x} y={top} width={bw} height={height - top}
                  fill={i === active ? 'url(#grad-funnel)' : 'url(#stripe-funnel)'}
                  opacity={i === active ? 1 : 0.92} />
                {i === active && <rect x={x} y={top} width={bw} height={2} fill="var(--blue-ink)" />}
                {/* fair value marker (1.0×) */}
                <rect x={x + bw / 2 - 11} y={y(1) - 2.5} width={22} height={5} rx={2.5}
                  fill="var(--card)" stroke={C.blue2} strokeWidth="1.2" />
              </g>
            );
          })}
        </svg>
      )}

      {/* tooltip over the active bar */}
      {a && width > 0 && (() => {
        const cx = GUTTER + active * cw + bw / 2;
        const top = HEAD + y(a.valueIndex || 0) - 46;
        const left = Math.min(Math.max(cx - 150, 0), width - 300);
        return (
          <div className="tip" style={{ position: 'absolute', top: Math.max(HEAD - 6, top), left, width: 300, textAlign: 'center', pointerEvents: 'none' }}>
            <strong>{formatNum(a.players)}</strong> player-seasons<span className="tip__sep">|</span>
            Spend <strong>{formatMoney(a.spendCr)}</strong><span className="tip__sep">|</span>
            Value <strong>{formatVI(a.valueIndex)}</strong>
          </div>
        );
      })()}
    </div>
  );
}
