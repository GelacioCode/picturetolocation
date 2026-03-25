import { useState, useRef, useEffect } from 'react'
import { MdDarkMode, MdLightMode } from 'react-icons/md'
import { usePhotos } from './hooks/usePhotos'
import StatsCards from './components/StatsCards'
import GlobeView, { GlobeHandle } from './components/GlobeView'
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
  const { photos, origin, loading, stats, visitedCodes, destinationPoints,
          addPhotos, removePhoto, setOrigin } = usePhotos()

  const globeRef = useRef<GlobeHandle>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isRecording, setIsRecording] = useState(false)

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
          onRecordingChange={setIsRecording}
        />
      </header>

      {/* ── Stats cards ───────────────────────────────────── */}
      <div className="shrink-0">
        <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />
      </div>

      {/* ── Globe — always dark backdrop regardless of theme ── */}
      <div
        className="flex-1 min-h-0 relative rounded-t-2xl overflow-hidden"
        style={{ background: '#07071a' }}
      >
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
      </div>

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
