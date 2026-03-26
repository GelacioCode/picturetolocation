import { MdPublic, MdPlace, MdHome, MdAddAPhoto, MdMap } from 'react-icons/md'
import type { VisitStats } from '../types'

interface Props {
  stats: VisitStats | null
  onUploadClick: () => void
  selectedCountry?: { code: string; name: string } | null
}

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      className="glass-card rounded-2xl px-3 py-3 flex items-center gap-3 shrink-0 min-w-[140px]"
    >
      {/* Icon circle */}
      <div
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.15)' }}
      >
        <span style={{ color: '#818cf8', fontSize: 20, lineHeight: 1 }}>{icon}</span>
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div
          className="font-bold leading-tight truncate"
          style={{ color: 'var(--text)', fontSize: 15 }}
          title={value}
        >
          {value}
        </div>
        {sub && (
          <div className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--text-sub)' }}>
            {sub}
          </div>
        )}
        <div
          className="text-[9px] uppercase tracking-widest mt-0.5 leading-tight"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

export default function StatsCards({ stats, onUploadClick, selectedCountry }: Props) {
  return (
    <div className="px-3 py-2">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        <Card
          icon={<MdPublic />}
          label="Countries"
          value={stats ? String(stats.countriesVisited) : '—'}
          sub={stats ? `${stats.totalPhotos} photo${stats.totalPhotos !== 1 ? 's' : ''}` : undefined}
        />
        <Card
          icon={<MdPlace />}
          label="Most Visited"
          value={stats?.mostVisitedCountry || '—'}
          sub={
            stats?.mostVisitedCountry
              ? `${stats.mostVisitedVisits} trip${stats.mostVisitedVisits !== 1 ? 's' : ''}`
              : undefined
          }
        />
        <Card
          icon={<MdHome />}
          label="Origin"
          value={stats?.originCountry || '—'}
        />

        {selectedCountry && (
          <Card
            icon={<MdMap />}
            label="Map View"
            value={selectedCountry.name}
          />
        )}

        {/* Add Photos */}
        <button
          onClick={onUploadClick}
          className="glass-card rounded-2xl px-3 py-3 flex items-center justify-center gap-2
                     transition-all active:scale-95 touch-manipulation shrink-0"
          style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          <MdAddAPhoto size={20} />
          <span className="font-semibold text-sm">Add Photos</span>
        </button>
      </div>
    </div>
  )
}
