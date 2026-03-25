import type { VisitStats } from '../types'

interface Props {
  stats: VisitStats | null
  onUploadClick: () => void
}

function Card({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub?: string
  icon: string
}) {
  return (
    <div className="glass-card rounded-xl p-3 flex items-center gap-2.5 min-w-0">
      <span className="text-2xl shrink-0 leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div
          className="text-sm sm:text-base font-bold text-white leading-tight"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={value}
        >
          {value}
        </div>
        {sub && <div className="text-[10px] text-indigo-300 leading-tight mt-0.5">{sub}</div>}
        <div className="text-[9px] sm:text-[10px] text-white/35 uppercase tracking-wider leading-tight mt-0.5">
          {label}
        </div>
      </div>
    </div>
  )
}

export default function StatsCards({ stats, onUploadClick }: Props) {
  // Mobile: 2×2 grid. Desktop: single row flex.
  return (
    <div className="px-3 py-2">
      {/* 2-column grid on mobile, flex row on sm+ */}
      <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-2">
        <Card
          icon="🗺️"
          label="Countries"
          value={stats ? String(stats.countriesVisited) : '—'}
          sub={stats ? `${stats.totalPhotos} photo${stats.totalPhotos !== 1 ? 's' : ''}` : undefined}
        />
        <Card
          icon="📍"
          label="Most Visited"
          value={stats?.mostVisitedCountry || '—'}
          sub={
            stats?.mostVisitedCountry
              ? `${stats.mostVisitedVisits} trip${stats.mostVisitedVisits !== 1 ? 's' : ''}`
              : undefined
          }
        />
        <Card
          icon="🏠"
          label="Origin"
          value={stats?.originCountry || '—'}
        />
        {/* Add Photos button — spans both columns on mobile */}
        <button
          onClick={onUploadClick}
          className="glass-card rounded-xl p-3 flex items-center justify-center gap-2
                     text-sm font-semibold text-indigo-300 border border-indigo-500/30
                     hover:border-indigo-400/60 hover:bg-indigo-500/10 active:bg-indigo-500/20
                     transition-all touch-manipulation"
        >
          <span className="text-lg leading-none">+</span>
          <span>Add Photos</span>
        </button>
      </div>
    </div>
  )
}
