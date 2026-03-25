import type { Photo } from '../types'

interface Props {
  photo: Photo
  onClose: () => void
  onDelete: (id: string) => void
}

export default function PhotoDetail({ photo, onClose, onDelete }: Props) {
  function handleDelete() {
    if (confirm('Remove this photo from the map?')) {
      onDelete(photo.id)
      onClose()
    }
  }

  const dateStr = photo.datetime
    ? new Date(photo.datetime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="modal-panel glass-card rounded-3xl overflow-hidden w-full max-w-sm border border-white/10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={photo.previewDataUrl}
          alt={photo.filename}
          className="w-full object-cover max-h-64"
        />
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-bold text-white text-lg">
                {photo.city ? `${photo.city}, ` : ''}{photo.country}
              </h3>
              {dateStr && <p className="text-white/50 text-sm mt-0.5">{dateStr}</p>}
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl leading-none shrink-0">✕</button>
          </div>

          <div className="text-xs text-white/30 font-mono mb-4">
            {photo.lat.toFixed(4)}°, {photo.lng.toFixed(4)}°
          </div>

          <button
            onClick={handleDelete}
            className="w-full py-2 rounded-xl text-sm text-red-400 border border-red-400/25
                       hover:bg-red-400/10 transition-all"
          >
            Remove from map
          </button>
        </div>
      </div>
    </div>
  )
}
