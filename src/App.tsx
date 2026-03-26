import { useState, useRef, useEffect, useMemo } from 'react'
import { MdDarkMode, MdLightMode } from 'react-icons/md'
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
  const [showUpload, setShowUpload]     = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isRecording, setIsRecording]   = useState(false)

  // ── View mode: null = globe, string = country map ────────
  const [mapCountryCode, setMapCountryCode] = useState<string | null>(null)

  // If all photos are from a single country, force map view for that country.
  // If the user manually selects a country (or clears it), that wins.
  const forcedSingleCountry = useMemo(
    () => (uniqueCountries.length === 1 ? uniqueCountries[0] : null),
    [uniqueCountries],
  )

  // Effective country being shown on map (forced or user-selected)
  const effectiveMapCode = forcedSingleCountry?.code ?? mapCountryCode

  // Photos visible in the current map view
  const mapPhotos = useMemo(
    () => (effectiveMapCode ? photos.filter(p => p.countryCode === effectiveMapCode) : []),
    [photos, effectiveMapCode],
  )

  const viewMode = effectiveMapCode ? 'map' : 'globe'

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
          viewMode={viewMode}
          effectiveMapCode={effectiveMapCode}
          onRecordingChange={setIsRecording}
        />
      </header>

      {/* ── Stats cards ───────────────────────────────────── */}
      <div className="shrink-0">
        <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />
      </div>

      {/* ── Globe or Country Map ─────────────────────────── */}
      <div
        className="flex-1 min-h-0 relative rounded-t-2xl overflow-hidden"
        style={{ background: '#07071a' }}
      >
        {viewMode === 'globe' ? (
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
        ) : (
          <CountryMapView
            photos={mapPhotos}
            onPhotoClick={setSelectedPhoto}
          />
        )}
      </div>

      {/* ── Country picker bar (bottom) ──────────────────── */}
      {/*  Show only when multiple countries exist AND not forced-single */}
      {uniqueCountries.length > 1 && (
        <CountryPicker
          countries={uniqueCountries}
          selected={mapCountryCode}
          onSelect={setMapCountryCode}
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
