import { useState, useRef, useEffect, useMemo } from 'react'
import { MdDarkMode, MdLightMode, MdMap, MdPublic } from 'react-icons/md'
import { usePhotos } from './hooks/usePhotos'
import StatsCards from './components/StatsCards'
import GlobeView, { GlobeHandle } from './components/GlobeView'
import CountryMapView from './components/CountryMapView'
import CountryPicker from './components/CountryPicker'
import OriginModal from './components/OriginModal'
import UploadModal from './components/UploadModal'
import PhotoDetail from './components/PhotoDetail'
import ShareButton from './components/ShareButton'
import type { Photo, OriginCountry } from './types'

export default function App() {
  // ── Theme ────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark',
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // ── Data ─────────────────────────────────────────────────
  const {
    photos, origin, loading, stats, visitedCodes, uniqueCountries,
    destinationPoints, addPhotos, removePhoto, setOrigin,
  } = usePhotos()

  const globeRef = useRef<GlobeHandle>(null)
  const [showUpload, setShowUpload]       = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isRecording, setIsRecording]     = useState(false)

  // ── View mode ────────────────────────────────────────────
  // null = full globe  |  string = focused on this country
  const [mapCountryCode, setMapCountryCode] = useState<string | null>(null)
  // When a country is focused: 'map' = Leaflet flat  |  '3d' = globe zoomed in
  const [countryViewType, setCountryViewType] = useState<'map' | '3d'>('map')

  // If all photos are from one country, force that country's view
  const forcedSingle = useMemo(
    () => (uniqueCountries.length === 1 ? uniqueCountries[0] : null),
    [uniqueCountries],
  )
  const effectiveMapCode = forcedSingle?.code ?? mapCountryCode

  // Reset sub-view to flat map whenever the focused country changes
  useEffect(() => { setCountryViewType('map') }, [effectiveMapCode])

  // Photos for the currently focused country
  const mapPhotos = useMemo(
    () => (effectiveMapCode ? photos.filter(p => p.countryCode === effectiveMapCode) : []),
    [photos, effectiveMapCode],
  )

  // Centroid of the focused country's photos (used for globe zoom)
  const mapCentroid = useMemo(() => {
    if (!mapPhotos.length) return null
    return {
      lat: mapPhotos.reduce((s, p) => s + p.lat, 0) / mapPhotos.length,
      lng: mapPhotos.reduce((s, p) => s + p.lng, 0) / mapPhotos.length,
    }
  }, [mapPhotos])

  const showGlobe = !effectiveMapCode || countryViewType === '3d'
  const showMap   = !!effectiveMapCode && countryViewType === 'map'

  const showOrigin = !loading && !origin

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100dvh', background: 'var(--bg)' }}
      >
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }} className="animate-pulse">
          Loading your map…
        </div>
      </div>
    )
  }

  function handleSwitch3D() {
    setCountryViewType('3d')
    // Globe may not be mounted yet — give it 2 frames to initialize
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (mapCentroid) globeRef.current?.focusCountry(mapCentroid.lat, mapCentroid.lng)
      }),
    )
  }

  function handleSwitchMap() {
    // Reset globe view so switching back to full globe looks right
    if (countryViewType === '3d') globeRef.current?.resetView()
    setCountryViewType('map')
  }

  return (
    <div
      className="flex flex-col overflow-hidden transition-colors duration-300"
      style={{ height: '100dvh', background: 'var(--bg)' }}
    >
      {/* ── Top bar: theme toggle ──────────────────────── */}
      <div
        className="flex items-center justify-end px-4 pt-2 pb-0 shrink-0 gap-2"
        style={{ color: 'var(--text-muted)' }}
      >
        <MdLightMode
          size={15}
          style={{ color: theme === 'light' ? '#f59e0b' : 'var(--text-muted)', transition: 'color .25s' }}
        />
        <button
          onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          className="theme-toggle"
          style={{ background: theme === 'dark' ? '#4f46e5' : '#cbd5e1' }}
          title="Toggle dark/light mode"
        >
          <span
            className="theme-toggle-thumb"
            style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(2px)' }}
          />
        </button>
        <MdDarkMode
          size={15}
          style={{ color: theme === 'dark' ? '#818cf8' : 'var(--text-muted)', transition: 'color .25s' }}
        />
      </div>

      {/* ── Header ────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-1 pb-1 shrink-0">
        <div>
          <h1
            className="text-lg font-bold tracking-tight leading-tight"
            style={{ color: 'var(--text)' }}
          >
            My Travel Map
          </h1>
          {origin && (
            <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              Exploring from {origin.name}
            </p>
          )}
        </div>
        <ShareButton
          globeRef={globeRef}
          stats={stats}
          destinationPoints={destinationPoints}
          uniqueCountries={uniqueCountries}
          photos={photos}
          viewMode={effectiveMapCode ? 'map' : 'globe'}
          effectiveMapCode={effectiveMapCode}
          onRecordingChange={setIsRecording}
        />
      </header>

      {/* ── Stats cards ───────────────────────────────────── */}
      <div className="shrink-0">
        <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />
      </div>

      {/* ── Main view: Globe or Country Map ──────────────── */}
      <div
        className="flex-1 min-h-0 relative rounded-t-2xl overflow-hidden"
        style={{ background: '#07071a' }}
      >
        {/* Globe (shown in full-globe mode OR in 3D country mode) */}
        {showGlobe && (
          <GlobeView
            ref={globeRef}
            photos={photos}
            visitedCodes={visitedCodes}
            originCode={origin?.code ?? null}
            originLat={origin?.lat ?? null}
            originLng={origin?.lng ?? null}
            onUploadClick={() => setShowUpload(true)}
            onPhotoClick={setSelectedPhoto}
            isRecording={isRecording}
          />
        )}

        {/* Flat Leaflet map (shown in country map mode) */}
        {showMap && (
          <CountryMapView
            photos={mapPhotos}
            onPhotoClick={setSelectedPhoto}
          />
        )}

        {/* ── Map / 3D toggle (only when a country is focused) ── */}
        {effectiveMapCode && (
          <div
            className="absolute top-3 right-3 z-10 flex gap-0.5 p-0.5 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)' }}
          >
            <button
              onClick={handleSwitchMap}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold
                         transition-all touch-manipulation"
              style={countryViewType === 'map'
                ? { background: 'rgba(52,211,153,0.3)', color: '#34d399' }
                : { color: 'rgba(255,255,255,0.5)' }}
              title="Flat map view"
            >
              <MdMap size={13} /> Map
            </button>
            <button
              onClick={handleSwitch3D}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold
                         transition-all touch-manipulation"
              style={countryViewType === '3d'
                ? { background: 'rgba(52,211,153,0.3)', color: '#34d399' }
                : { color: 'rgba(255,255,255,0.5)' }}
              title="3D globe view"
            >
              <MdPublic size={13} /> 3D
            </button>
          </div>
        )}
      </div>

      {/* ── Country picker bar (bottom) ──────────────────── */}
      {uniqueCountries.length > 1 && (
        <CountryPicker
          countries={uniqueCountries}
          selected={mapCountryCode}
          onSelect={code => {
            // If deselecting → reset globe to full view
            if (!code) globeRef.current?.resetView()
            setMapCountryCode(code)
          }}
        />
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showOrigin && <OriginModal onConfirm={(o: OriginCountry) => setOrigin(o)} />}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onPhotosAdded={async newPhotos => {
            await addPhotos(newPhotos)
            setShowUpload(false)
          }}
        />
      )}

      {selectedPhoto && (
        <PhotoDetail
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={async id => {
            await removePhoto(id)
            setSelectedPhoto(null)
          }}
        />
      )}
    </div>
  )
}
