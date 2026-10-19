/**
 * SeasonFilter — Dropdown defaulting to 2026 (latest season).
 */
export default function SeasonFilter({ season, onChange, seasons = [] }) {
  // Default seasons list if not provided
  const opts = seasons.length > 0
    ? seasons
    : Array.from({ length: 14 }, (_, i) => 2013 + i);

  return (
    <div className="season-filter" id="season-filter">
      <label>Season</label>
      <select value={season} onChange={e => onChange(Number(e.target.value))}>
        <option value="">All Seasons</option>
        {opts.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}
