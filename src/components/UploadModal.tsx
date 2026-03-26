import { useState, useRef, useCallback } from 'react'
import { MdMyLocation, MdSearch } from 'react-icons/md'
import { extractExif, createThumbnail, createPreview } from '../lib/exif'
import { reverseGeocode } from '../lib/geocode'
import { COUNTRIES } from '../lib/countries'
import type { Photo, ProcessedImage } from '../types'

interface Props {
  onClose: () => void
  onPhotosAdded: (photos: Photo[]) => void
}

function StatusBadge({ status }: { status: ProcessedImage['geocoding'] }) {
  if (status === 'pending')  return <span className="text-yellow-400 text-xs">Locating…</span>
  if (status === 'done')     return <span className="text-green-400 text-xs">✓</span>
  if (status === 'failed')   return null
  return <span className="text-indigo-300 text-xs">Manual</span>
}

// Nominatim forward geocode — returns top matches
async function searchPlace(query: string, countryCode?: string) {
  const cc = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : ''
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}${cc}&format=json&limit=5&addressdetails=1`
  const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TravelMapApp/1.0' } })
  if (!res.ok) return []
  return (await res.json()) as any[]
}

// ── Per-row location picker for failed items ───────────────
function LocationPicker({
  item,
  onLocated,
}: {
  item: ProcessedImage
  onLocated: (file: File, lat: number, lng: number, country: string, countryCode: string, city: string) => void
}) {
  const [locating, setLocating]     = useState(false)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<any[]>([])
  const [searching, setSearching]   = useState(false)
  const [selectedCode, setSelectedCode] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Use browser GPS ──────────────────────────────────────
  async function handleGPS() {
    if (!navigator.geolocation) {
      alert('GPS not available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        const geo = await reverseGeocode(latitude, longitude)
        onLocated(item.file, latitude, longitude, geo.country, geo.countryCode, geo.city)
        setLocating(false)
      },
      err => {
        setLocating(false)
        if (err.code === 1) alert('Location permission denied. Please allow location access or search manually.')
        else alert('Could not get GPS location. Please search for a city instead.')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── Place search ─────────────────────────────────────────
  function handleQueryChange(val: string) {
    setQuery(val)
    setResults([])
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) return
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const hits = await searchPlace(val.trim(), selectedCode || undefined)
      setResults(hits)
      setSearching(false)
    }, 500)
  }

  async function handlePickResult(r: any) {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const addr = r.address ?? {}
    const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? r.display_name.split(',')[0]
    const country = addr.country ?? 'Unknown'
    const countryCode = (addr.country_code ?? '').toUpperCase()
    onLocated(item.file, lat, lng, country, countryCode, city)
    setResults([])
    setQuery('')
  }

  // ── Country centroid fallback ────────────────────────────
  function handleCountrySelect(code: string) {
    const c = COUNTRIES.find(x => x.code === code)
    if (!c) return
    onLocated(item.file, c.lat, c.lng, c.name, c.code, '')
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {/* GPS button */}
      <button
        disabled={locating}
        onClick={handleGPS}
        className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-xs font-semibold
                   transition-all active:scale-95 touch-manipulation disabled:opacity-50"
        style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
      >
        <MdMyLocation size={13} />
        {locating ? 'Getting location…' : 'Use my current location'}
      </button>

      {/* Place search */}
      <div className="relative">
        <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 rounded-lg px-2 py-1">
          <MdSearch size={13} className="text-white/40 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search city or place…"
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none min-w-0"
          />
          {searching && <span className="text-white/30 text-[10px] shrink-0">…</span>}
        </div>

        {results.length > 0 && (
          <div
            className="absolute left-0 right-0 z-10 mt-1 rounded-xl overflow-hidden shadow-xl"
            style={{ background: 'var(--popover-bg)', border: '1px solid var(--card-border)' }}
          >
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handlePickResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/8 transition-colors truncate"
                style={{ color: 'var(--text)' }}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Country-only fallback */}
      <div className="flex items-center gap-1.5">
        <select
          className="flex-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1"
          defaultValue=""
          onChange={e => {
            setSelectedCode(e.target.value)
            handleCountrySelect(e.target.value)
          }}
        >
          <option value="" disabled>Or pick country only…</option>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function UploadModal({ onClose, onPhotosAdded }: Props) {
  const [items, setItems] = useState<ProcessedImage[]>([])
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return

    const initial: ProcessedImage[] = imageFiles.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      lat: null, lng: null, country: null, countryCode: null, city: null,
      datetime: null, geocoding: 'pending',
    }))
    setItems(prev => [...prev, ...initial])

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

  function handleLocated(file: File, lat: number, lng: number, country: string, countryCode: string, city: string) {
    setItems(prev =>
      prev.map(item =>
        item.file === file
          ? { ...item, lat, lng, country, countryCode, city, geocoding: 'manual' }
          : item,
      ),
    )
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processFiles(Array.from(e.target.files))
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

  const readyCount   = items.filter(i => i.countryCode && i.lat != null).length
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
            <p className="text-white/30 text-xs mt-1">GPS metadata auto-detected · set manually if missing</p>
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
              <div key={item.file.name + item.file.size} className="bg-white/4 rounded-xl p-2">
                <div className="flex items-center gap-3">
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
                      <div className="text-[10px] text-amber-400">No GPS — set location below</div>
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

                {/* Location picker — only shown when GPS failed */}
                {item.geocoding === 'failed' && (
                  <LocationPicker item={item} onLocated={handleLocated} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-3">
          <span className="text-xs text-white/40">
            {pendingCount > 0
              ? `Locating ${pendingCount} photo${pendingCount > 1 ? 's' : ''}…`
              : `${readyCount} ready to add`}
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
