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

  const showOrigin = !loading && !origin

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-[#07071a]" style={{ height: '100dvh' }}>
        <div className="text-white/40 text-sm animate-pulse">Loading your map…</div>
      </div>
    )
  }

  return (
    // 100dvh = actual visible viewport on iOS Safari (accounts for browser chrome)
    <div className="flex flex-col bg-[#07071a] overflow-hidden" style={{ height: '100dvh' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">My Travel Map</h1>
          {origin && (
            <p className="text-[11px] text-white/35 leading-tight">Exploring from {origin.name}</p>
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
      <div className="shrink-0">
        <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />
      </div>

      {/* Globe — flex-1 fills remaining height since parent has 100dvh */}
      <div className="flex-1 min-h-0 relative">
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
