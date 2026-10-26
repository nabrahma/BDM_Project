/**
 * SeasonFilter — season picker styled as a header chip (defaults are set by each page).
 */
import Icon from './Icon';

export default function SeasonFilter({ season, onChange, seasons = [], allLabel = 'All seasons', allowAll = true }) {
  const opts = seasons.length > 0 ? seasons : Array.from({ length: 14 }, (_, i) => 2026 - i);
  return (
    <div className="chip-group" id="season-filter">
      <span className="chip__note">Season</span>
      <label className="chip-select">
        <Icon name="calendar" size={15} />
        <select value={season} onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          aria-label="Season">
          {allowAll && <option value="">{allLabel}</option>}
          {opts.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Icon name="chevronDown" size={14} />
      </label>
    </div>
  );
}
