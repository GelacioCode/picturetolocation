import type { VisitStats } from '../types'

interface Props {
  stats: VisitStats | null
  onUploadClick: () => void
}

function Card({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4 flex-1 min-w-0">
      <span className="text-3xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div
          className="text-xl font-bold text-white truncate"
          title={value}
        >
          {value}
        </div>
        {sub && <div className="text-xs text-indigo-300 mt-0.5">{sub}</div>}
        <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">{label}</div>
      </div>
    </div>
  )
}

export default function StatsCards({ stats, onUploadClick }: Props) {
  if (!stats) {
    return (
      <div className="flex gap-3 px-4 py-3">
        {[
          { icon: '🗺️', label: 'Countries Visited' },
          { icon: '📍', label: 'Most Visited' },
          { icon: '🏠', label: 'Country of Origin' },
        ].map(c => (
          <div key={c.label} className="glass-card rounded-2xl px-5 py-4 flex items-center gap-4 flex-1 opacity-40">
            <span className="text-3xl">{c.icon}</span>
            <div>
              <div className="text-xl font-bold text-white">—</div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider mt-1">{c.label}</div>
            </div>
          </div>
        ))}
        <button
          onClick={onUploadClick}
          className="glass-card rounded-2xl px-5 py-3 flex items-center gap-2 text-sm font-medium
                     text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/60
                     hover:bg-indigo-500/10 transition-all shrink-0"
        >
          <span className="text-lg">+</span> Add Photos
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <Card
        icon="🗺️"
        label="Countries Visited"
        value={String(stats.countriesVisited)}
        sub={`${stats.totalPhotos} photo${stats.totalPhotos !== 1 ? 's' : ''}`}
      />
      <Card
        icon="📍"
        label="Most Visited"
        value={stats.mostVisitedCountry || '—'}
        sub={stats.mostVisitedCountry ? `${stats.mostVisitedVisits} trip${stats.mostVisitedVisits !== 1 ? 's' : ''}` : undefined}
      />
      <Card
        icon="🏠"
        label="Country of Origin"
        value={stats.originCountry}
      />
      <button
        onClick={onUploadClick}
        className="glass-card rounded-2xl px-5 py-3 flex items-center gap-2 text-sm font-medium
                   text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/60
                   hover:bg-indigo-500/10 transition-all shrink-0"
      >
        <span className="text-lg">+</span> Add Photos
      </button>
    </div>
  )
}
