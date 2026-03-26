export interface CountryOption {
  code: string
  name: string
}

interface Props {
  countries: CountryOption[]
  selected: string | null   // null = globe
  onSelect: (code: string | null) => void
}

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏴'
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join('')
}

const ACTIVE_GLOBE  = { background: 'rgba(99,102,241,0.25)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.45)' }
const ACTIVE_CTRY   = { background: 'rgba(52,211,153,0.20)', color: '#34d399', border: '1px solid rgba(52,211,153,0.45)' }
const INACTIVE      = { background: 'var(--card-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }

export default function CountryPicker({ countries, selected, onSelect }: Props) {
  return (
    <div
      className="shrink-0"
      style={{ borderTop: '1px solid var(--card-border)', background: 'var(--bg)' }}
    >
      <div className="flex flex-wrap gap-2 px-3 py-2">
        {/* Globe button */}
        <button
          onClick={() => onSelect(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                     whitespace-nowrap transition-all shrink-0 touch-manipulation"
          style={selected === null ? ACTIVE_GLOBE : INACTIVE}
        >
          🌍 Globe
        </button>

        {/* One button per visited country */}
        {countries.map(c => (
          <button
            key={c.code}
            onClick={() => onSelect(c.code === selected ? null : c.code)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium
                       whitespace-nowrap transition-all shrink-0 touch-manipulation"
            style={selected === c.code ? ACTIVE_CTRY : INACTIVE}
          >
            <span>{flagEmoji(c.code)}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
