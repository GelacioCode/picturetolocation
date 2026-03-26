import { useState, useRef, useEffect, useMemo } from 'react'
import { MdDarkMode, MdLightMode, MdMap, MdPublic, MdViewInAr } from 'react-icons/md'
import { usePhotos } from './hooks/usePhotos'
import StatsCards from './components/StatsCards'
import GlobeView, { GlobeHandle } from './components/GlobeView'
import CountryMapView from './components/CountryMapView'
import CountryThreeView from './components/CountryThreeView'
import CountryPicker from './components/CountryPicker'
import type { CountryOption } from './components/CountryPicker'
import OriginModal from './components/OriginModal'
import UploadModal from './components/UploadModal'
import PhotoDetail from './components/PhotoDetail'
import ShareButton from './components/ShareButton'
import type { Photo, OriginCountry } from './types'

type CountryViewType = 'map' | 'polygon' | '3d'

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
  const [showUpload, setShowUpload]         = useState(false)
  const [selectedPhoto, setSelectedPhoto]   = useState<Photo | null>(null)
  const [isRecording, setIsRecording]       = useState(false)

  // ── View state ───────────────────────────────────────────
  // null = full globe  |  string = focused on this country code
  const [mapCountryCode, setMapCountryCode] = useState<string | null>(null)
  // How to display the focused country
  const [countryViewType, setCountryViewType] = useState<CountryViewType>('map')
  // Country pending a view-type choice dialog
  const [pendingCountry, setPendingCountry] = useState<CountryOption | null>(null)

  // If all photos are from one country, always focus that country
  const forcedSingle = useMemo(
    () => (uniqueCountries.length === 1 ? uniqueCountries[0] : null),
    [uniqueCountries],
  )
  const effectiveMapCode = forcedSingle?.code ?? mapCountryCode
  const effectiveCountry = useMemo(
    () => (effectiveMapCode ? uniqueCountries.find(c => c.code === effectiveMapCode) ?? null : null),
    [effectiveMapCode, uniqueCountries],
  )

  // Reset sub-view when focused country changes
  useEffect(() => { setCountryViewType('map') }, [effectiveMapCode])

  // Photos for the currently focused country
  const mapPhotos = useMemo(
    () => (effectiveMapCode ? photos.filter(p => p.countryCode === effectiveMapCode) : []),
    [photos, effectiveMapCode],
  )

  // Centroid of the focused country's photos (for globe zoom)
  const mapCentroid = useMemo(() => {
    if (!mapPhotos.length) return null
    return {
      lat: mapPhotos.reduce((s, p) => s + p.lat, 0) / mapPhotos.length,
      lng: mapPhotos.reduce((s, p) => s + p.lng, 0) / mapPhotos.length,
    }
  }, [mapPhotos])

  const showGlobe   = !effectiveMapCode || countryViewType === '3d'
  const showFlatMap = !!effectiveMapCode && countryViewType === 'map'
  const showPolygon = !!effectiveMapCode && countryViewType === 'polygon'

  const showOriginModal = !loading && !origin

  // ── Handlers ────────────────────────────────────────────
  function handleCountryPickerSelect(code: string | null) {
    if (!code) {
      // Globe selected → reset everything
      globeRef.current?.resetView()
      setMapCountryCode(null)
      return
    }
    const country = uniqueCountries.find(c => c.code === code)
    if (country) setPendingCountry(country)   // show view-type choice dialog
  }

  function confirmView(country: CountryOption, viewType: CountryViewType) {
    setMapCountryCode(country.code)
    setCountryViewType(viewType)
    setPendingCountry(null)
    if (viewType === '3d' && mapCentroid) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          globeRef.current?.focusCountry(mapCentroid.lat, mapCentroid.lng),
        ),
      )
    }
  }

  function handleSwitch3D() {
    setCountryViewType('3d')
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (mapCentroid) globeRef.current?.focusCountry(mapCentroid.lat, mapCentroid.lng)
      }),
    )
  }

  function handleSwitchMap() {
    if (countryViewType === '3d') globeRef.current?.resetView()
    setCountryViewType('map')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100dvh', background: 'var(--bg)' }}>
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
      {/* ── Theme toggle ──────────────────────────────────── */}
      <div className="flex items-center justify-end px-4 pt-2 pb-0 shrink-0 gap-2" style={{ color: 'var(--text-muted)' }}>
        <MdLightMode size={15} style={{ color: theme === 'light' ? '#f59e0b' : 'var(--text-muted)', transition: 'color .25s' }} />
        <button
          onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          className="theme-toggle"
          style={{ background: theme === 'dark' ? '#4f46e5' : '#cbd5e1' }}
        >
          <span className="theme-toggle-thumb" style={{ transform: theme === 'dark' ? 'translateX(16px)' : 'translateX(2px)' }} />
        </button>
        <MdDarkMode size={15} style={{ color: theme === 'dark' ? '#818cf8' : 'var(--text-muted)', transition: 'color .25s' }} />
      </div>

      {/* ── Header ────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-1 pb-1 shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-tight" style={{ color: 'var(--text)' }}>
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
        <StatsCards
          stats={stats}
          onUploadClick={() => setShowUpload(true)}
          selectedCountry={effectiveCountry}
        />
      </div>

      {/* ── Main view ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative rounded-t-2xl overflow-hidden" style={{ background: '#07071a' }}>

        {/* Globe — full-globe mode OR 3D country mode */}
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

        {/* Flat Leaflet street map */}
        {showFlatMap && (
          <CountryMapView
            photos={mapPhotos}
            onPhotoClick={setSelectedPhoto}
          />
        )}

        {/* Three.js 3D polygon map */}
        {showPolygon && effectiveMapCode && (
          <CountryThreeView
            photos={mapPhotos}
            countryCode={effectiveMapCode}
            onPhotoClick={setSelectedPhoto}
          />
        )}

        {/* ── Map / Polygon / 3D toggle ────────────────── */}
        {effectiveMapCode && (
          <div
            className="absolute top-3 right-3 z-10 flex gap-0.5 p-0.5 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            {(
              [
                { type: 'map'     as CountryViewType, icon: <MdMap size={13} />,       label: 'Map'    },
                { type: 'polygon' as CountryViewType, icon: <MdViewInAr size={13} />,  label: '3D Map' },
                { type: '3d'      as CountryViewType, icon: <MdPublic size={13} />,    label: 'Globe'  },
              ] as const
            ).map(btn => (
              <button
                key={btn.type}
                onClick={() => {
                  if (btn.type === '3d') handleSwitch3D()
                  else if (btn.type === 'map') handleSwitchMap()
                  else setCountryViewType('polygon')
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold
                           transition-all touch-manipulation"
                style={
                  countryViewType === btn.type
                    ? { background: 'rgba(52,211,153,0.30)', color: '#34d399' }
                    : { color: 'rgba(255,255,255,0.50)' }
                }
              >
                {btn.icon} {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Country picker bar (bottom) ──────────────────── */}
      {uniqueCountries.length > 1 && (
        <CountryPicker
          countries={uniqueCountries}
          selected={mapCountryCode}
          onSelect={handleCountryPickerSelect}
        />
      )}

      {/* ── Country view-type choice dialog ──────────────── */}
      {pendingCountry && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPendingCountry(null)} />
          <div
            className="fixed left-3 right-3 z-50 rounded-2xl overflow-hidden"
            style={{
              bottom: uniqueCountries.length > 1 ? 64 : 12,
              background: 'var(--popover-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.40)',
            }}
          >
            <p className="px-4 pt-3 pb-1 text-center text-[11px] uppercase tracking-widest font-semibold"
               style={{ color: 'var(--text-muted)' }}>
              View {pendingCountry.name} as
            </p>
            <div className="flex gap-3 p-3">
              <button
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-semibold
                           transition-all active:scale-95 touch-manipulation"
                style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--text)', border: '1px solid rgba(99,102,241,0.25)' }}
                onClick={() => confirmView(pendingCountry, 'map')}
              >
                <MdMap size={22} style={{ color: '#818cf8' }} />
                Street Map
                <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>Zoomable OSM tiles</span>
              </button>
              <button
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-semibold
                           transition-all active:scale-95 touch-manipulation"
                style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--text)', border: '1px solid rgba(52,211,153,0.25)' }}
                onClick={() => confirmView(pendingCountry, 'polygon')}
              >
                <MdViewInAr size={22} style={{ color: '#34d399' }} />
                3D Map
                <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>Three.js polygon view</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showOriginModal && <OriginModal onConfirm={(o: OriginCountry) => setOrigin(o)} />}

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
