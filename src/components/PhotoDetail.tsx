import { useRef, useEffect } from 'react'
import { MdClose, MdLocationOn, MdCalendarMonth, MdPhoto, MdDeleteOutline, MdOpenInNew } from 'react-icons/md'
import type { Photo } from '../types'

interface Props {
  photo: Photo
  onClose: () => void
  onDelete: (id: string) => void
}

function InfoRow({ icon, label, value, mono = false }: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
      <span style={{ color: '#818cf8', marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </div>
        <div
          className={`text-sm leading-snug break-words ${mono ? 'font-mono' : 'font-medium'}`}
          style={{ color: 'var(--text)' }}
        >
          {value}
        </div>
      </div>
    </div>
  )
}

export default function PhotoDetail({ photo, onClose, onDelete }: Props) {
  // Guard against iOS ghost clicks: touchend on pin opens modal, then ~300ms later
  // a synthetic click fires at the same coords and lands on the backdrop, closing it instantly.
  const allowClose = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => { allowClose.current = true }, 400)
    return () => clearTimeout(t)
  }, [])

  const date = photo.datetime ? new Date(photo.datetime) : null

  const dateStr = date
    ? date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const timeStr = date
    ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  const locationLabel = [photo.city, photo.country].filter(Boolean).join(', ')
  const coordStr = `${photo.lat.toFixed(5)}°, ${photo.lng.toFixed(5)}°`
  const mapsUrl = `https://www.google.com/maps?q=${photo.lat},${photo.lng}`

  function handleDelete() {
    if (confirm(`Remove "${photo.filename}" from your travel map?`)) {
      onDelete(photo.id)
      onClose()
    }
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={() => { if (allowClose.current) onClose() }}
    >
      <div
        className="modal-panel w-full sm:max-w-sm overflow-hidden flex flex-col"
        style={{
          background: 'var(--card-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--card-border)',
          borderRadius: '24px 24px 0 0',
          maxHeight: '92dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Drag handle (mobile) ────────────────────────────── */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--card-border)', opacity: 2 }} />
        </div>

        {/* ── Photo ──────────────────────────────────────────── */}
        <div className="relative flex-shrink-0">
          <img
            src={photo.previewDataUrl}
            alt={photo.filename}
            className="w-full object-cover"
            style={{ maxHeight: '52vw', minHeight: 160 }}
          />
          {/* Close button overlay */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center
                       transition-all active:scale-90"
            style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
          >
            <MdClose size={18} />
          </button>
        </div>

        {/* ── Info ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">

          {/* Title row */}
          <div className="pt-4 pb-2">
            <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--text)' }}>
              {locationLabel || photo.filename}
            </h2>
            {dateStr && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {dateStr}{timeStr ? ` · ${timeStr}` : ''}
              </p>
            )}
          </div>

          {/* Info rows */}
          <InfoRow
            icon={<MdLocationOn size={18} />}
            label="Location"
            value={locationLabel || 'Unknown'}
          />

          <InfoRow
            icon={<MdPhoto size={18} />}
            label="Filename"
            value={photo.filename}
          />

          {dateStr && (
            <InfoRow
              icon={<MdCalendarMonth size={18} />}
              label="Date &amp; Time"
              value={`${dateStr}${timeStr ? ` at ${timeStr}` : ''}`}
            />
          )}

          <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <span style={{ color: '#818cf8', marginTop: 1, flexShrink: 0 }}>
              <MdLocationOn size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--text-muted)' }}>
                GPS Coordinates
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: 'var(--text)' }}>{coordStr}</span>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                  onClick={e => e.stopPropagation()}
                >
                  <MdOpenInNew size={11} />
                  Maps
                </a>
              </div>
            </div>
          </div>

          {/* Country badge */}
          <div className="flex items-center gap-2 py-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
            >
              {photo.country}
            </span>
            {photo.countryCode && (
              <span
                className="px-2 py-1 rounded-full text-xs font-mono"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
              >
                {photo.countryCode}
              </span>
            )}
            {photo.year && (
              <span
                className="px-2 py-1 rounded-full text-xs"
                style={{ background: 'var(--card-border)', color: 'var(--text-muted)' }}
              >
                {photo.year}
              </span>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="mt-2 w-full py-2.5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2
                       transition-all active:scale-98"
            style={{
              color: '#f87171',
              border: '1px solid rgba(248,113,113,0.25)',
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <MdDeleteOutline size={18} />
            Remove from map
          </button>
        </div>
      </div>
    </div>
  )
}
