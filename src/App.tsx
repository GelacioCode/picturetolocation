import { useState, useRef } from 'react'
import { usePhotos } from './hooks/usePhotos'
import StatsCards from './components/StatsCards'
import GlobeView, { GlobeHandle } from './components/GlobeView'
import OriginModal from './components/OriginModal'
import UploadModal from './components/UploadModal'
import PhotoDetail from './components/PhotoDetail'
import ShareButton from './components/ShareButton'
import type { Photo, OriginCountry } from './types'

export default function App() {
  const { photos, origin, loading, stats, visitedCodes, destinationPoints, addPhotos, removePhoto, setOrigin } =
    usePhotos()

  const globeRef = useRef<GlobeHandle>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  // Show origin modal if no origin is set yet (after initial load)
  const showOrigin = !loading && !origin

  async function handleOriginConfirm(o: OriginCountry) {
    await setOrigin(o)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07071a] flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading your map…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#07071a]">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">My Travel Map</h1>
          {origin && (
            <p className="text-xs text-white/35 mt-0.5">
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

      {/* Stats cards */}
      <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />

      {/* Globe — takes remaining viewport height */}
      <div className="flex-1 min-h-0" style={{ minHeight: '400px' }}>
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

      {/* Modals */}
      {showOrigin && <OriginModal onConfirm={handleOriginConfirm} />}

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
