import { useState, useRef, useCallback } from 'react'
import { extractExif, createThumbnail, createPreview } from '../lib/exif'
import { reverseGeocode } from '../lib/geocode'
import { COUNTRIES } from '../lib/countries'
import type { Photo, ProcessedImage } from '../types'

interface Props {
  onClose: () => void
  onPhotosAdded: (photos: Photo[]) => void
}

function StatusBadge({ status }: { status: ProcessedImage['geocoding'] }) {
  if (status === 'pending') return <span className="text-yellow-400 text-xs">Locating…</span>
  if (status === 'done') return <span className="text-green-400 text-xs">✓</span>
  if (status === 'failed') return <span className="text-red-400 text-xs">No GPS</span>
  return <span className="text-indigo-300 text-xs">Manual</span>
}

export default function UploadModal({ onClose, onPhotosAdded }: Props) {
  const [items, setItems] = useState<ProcessedImage[]>([])
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    // Add placeholder rows immediately
    const initial: ProcessedImage[] = imageFiles.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      lat: null,
      lng: null,
      country: null,
      countryCode: null,
      city: null,
      datetime: null,
      geocoding: 'pending',
    }))
    setItems(prev => [...prev, ...initial])

    // Process each file sequentially (geocoding rate limit)
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const exif = await extractExif(file)

      setItems(prev =>
        prev.map(item =>
          item.file === file
            ? { ...item, datetime: exif.datetime, lat: exif.latitude, lng: exif.longitude }
            : item,
        ),
      )

      if (exif.latitude != null && exif.longitude != null) {
        const geo = await reverseGeocode(exif.latitude, exif.longitude)
        setItems(prev =>
          prev.map(item =>
            item.file === file
              ? { ...item, country: geo.country, countryCode: geo.countryCode, city: geo.city, geocoding: 'done' }
              : item,
          ),
        )
      } else {
        setItems(prev =>
          prev.map(item =>
            item.file === file ? { ...item, geocoding: 'failed' } : item,
          ),
        )
      }
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(Array.from(e.target.files))
  }

  function setManualCountry(file: File, code: string) {
    const c = COUNTRIES.find(x => x.code === code)
    if (!c) return
    setItems(prev =>
      prev.map(item =>
        item.file === file
          ? { ...item, country: c.name, countryCode: c.code, lat: c.lat, lng: c.lng, geocoding: 'manual' }
          : item,
      ),
    )
  }

  function removeItem(file: File) {
    setItems(prev => {
      const item = prev.find(x => x.file === file)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return prev.filter(x => x.file !== file)
    })
  }

  async function handleSave() {
    const ready = items.filter(i => i.countryCode && (i.lat != null))
    if (!ready.length) return
    setSaving(true)

    const photos: Photo[] = []
    for (const item of ready) {
      const [thumb, preview] = await Promise.all([
        createThumbnail(item.file),
        createPreview(item.file),
      ])
      const dt = item.datetime
      photos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        thumbnailDataUrl: thumb,
        previewDataUrl: preview,
        lat: item.lat!,
        lng: item.lng!,
        country: item.country!,
        countryCode: item.countryCode!,
        city: item.city ?? '',
        datetime: dt ? dt.toISOString() : null,
        year: dt ? dt.getFullYear() : null,
        month: dt ? dt.getMonth() + 1 : null,
        filename: item.file.name,
      })
    }

    onPhotosAdded(photos)
    items.forEach(i => URL.revokeObjectURL(i.previewUrl))
    setSaving(false)
    onClose()
  }

  const readyCount = items.filter(i => i.countryCode && i.lat != null).length
  const pendingCount = items.filter(i => i.geocoding === 'pending').length

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="modal-panel glass-card rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <h2 className="text-lg font-bold text-white">Upload Travel Photos</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 text-xl leading-none">✕</button>
        </div>

        {/* Drop zone */}
        <div className="px-6 pt-4">
          <div
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all
              ${dragging ? 'dropzone-active' : 'border-white/15 hover:border-indigo-500/50'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-2">📸</div>
            <p className="text-white/60 text-sm">Drop photos here or <span className="text-indigo-400 underline">browse</span></p>
            <p className="text-white/30 text-xs mt-1">GPS metadata will be auto-detected</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2 mt-2">
            {items.map(item => (
              <div key={item.file.name + item.file.size} className="flex items-center gap-3 bg-white/4 rounded-xl p-2">
                <img
                  src={item.previewUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/60 truncate">{item.file.name}</div>
                  {(item.geocoding === 'done' || item.geocoding === 'manual') ? (
                    <div className="text-xs text-white/80 truncate">
                      {item.city ? `${item.city}, ` : ''}{item.country}
                      {item.datetime && (
                        <span className="text-white/40 ml-1">
                          {new Date(item.datetime).getFullYear()}
                        </span>
                      )}
                    </div>
                  ) : item.geocoding === 'failed' ? (
                    <select
                      className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1"
                      defaultValue=""
                      onChange={e => setManualCountry(item.file, e.target.value)}
                    >
                      <option value="" disabled>Select country…</option>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={item.geocoding} />
                  )}
                </div>
                <StatusBadge status={item.geocoding} />
                <button
                  onClick={() => removeItem(item.file)}
                  className="text-white/30 hover:text-red-400 text-sm shrink-0"
                >✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-3">
          <span className="text-xs text-white/40">
            {pendingCount > 0 ? `Locating ${pendingCount} photo${pendingCount > 1 ? 's' : ''}…` : `${readyCount} ready to add`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={readyCount === 0 || saving || pendingCount > 0}
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30
                         disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl
                         transition-all"
            >
              {saving ? 'Saving…' : `Add ${readyCount} Photo${readyCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
