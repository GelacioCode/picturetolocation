import { MdPublic, MdPlace, MdHome, MdAddAPhoto, MdMap } from 'react-icons/md'
import type { VisitStats } from '../types'

interface Props {
  stats: VisitStats | null
  onUploadClick: () => void
  selectedCountry?: { code: string; name: string } | null
}

function Card({ icon, label, value, sub }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="glass-card rounded-2xl px-3 py-3 flex items-center gap-3 min-w-0">
      <div
        className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(99,102,241,0.15)' }}
      >
        <span style={{ color: '#818cf8', fontSize: 20, lineHeight: 1 }}>{icon}</span>
      </div>
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
  const showMapCard = !!selectedCountry

  return (
    <div className="px-3 py-2">
      {/* 2-col grid on mobile, flex row on sm+ */}
      <div className="grid grid-cols-2 sm:flex sm:items-stretch gap-2">
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
          sub={stats?.mostVisitedCountry
            ? `${stats.mostVisitedVisits} trip${stats.mostVisitedVisits !== 1 ? 's' : ''}`
            : undefined}
        />

        {showMapCard ? (
          // When a country is focused: show Origin + Map View in 2nd row
          <>
            <Card icon={<MdHome />}  label="Origin"    value={stats?.originCountry || '—'} />
            <Card icon={<MdMap />}   label="Map View"  value={selectedCountry!.name} />
          </>
        ) : (
          // No country focused: show Origin + Add Photos button
          <>
            <Card icon={<MdHome />} label="Origin" value={stats?.originCountry || '—'} />
            <button
              onClick={onUploadClick}
              className="glass-card rounded-2xl px-3 py-3 flex items-center justify-center gap-2
                         transition-all active:scale-95 touch-manipulation"
              style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <MdAddAPhoto size={20} />
              <span className="font-semibold text-sm">Add Photos</span>
            </button>
          </>
        )}
      </div>

      {/* When country is focused, Add Photos button sits below the 2x2 grid */}
      {showMapCard && (
        <button
          onClick={onUploadClick}
          className="mt-2 w-full glass-card rounded-2xl px-3 py-2.5 flex items-center justify-center gap-2
                     transition-all active:scale-95 touch-manipulation"
          style={{ color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          <MdAddAPhoto size={18} />
          <span className="font-semibold text-sm">Add Photos</span>
        </button>
      )}
    </div>
  )
}
