import { useState, useRef } from 'react'
import { exportTravelGIF } from '../lib/gifExport'
import type { VisitStats } from '../types'
import type { GlobeHandle } from './GlobeView'

interface Props {
  globeRef: React.RefObject<GlobeHandle | null>
  stats: VisitStats | null
  destinationPoints: { lat: number; lng: number }[]
  onRecordingChange: (recording: boolean) => void
}

// Share/download helper that works on iOS Safari
async function shareOrDownload(blob: Blob) {
  const file = new File([blob], 'my-travel-map.gif', { type: 'image/gif' })

  // Web Share API — native share sheet on iOS/Android
  if (
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: 'My Travel Map' })
      return
    } catch {
      // User cancelled or share failed — fall through to download
    }
  }

  // Standard download (works on desktop + Android Chrome)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'my-travel-map.gif'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

export default function ShareButton({ globeRef, stats, destinationPoints, onRecordingChange }: Props) {
  const [state, setState] = useState<'idle' | 'prep' | 'recording' | 'encoding'>('idle')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef(false)

  const disabled = !stats || destinationPoints.length === 0

  async function handleShare() {
    if (!globeRef.current || !stats) return

    abortRef.current = false
    setState('prep')
    onRecordingChange(true)

    // Start arcs + zoom out to see full globe
    globeRef.current.startArcs(
      { lat: stats.originLat, lng: stats.originLng },
      destinationPoints,
    )

    // Wait for the globe to finish its camera transition and
    // for all country polygons + arcs to render at least 2 full frames
    await new Promise(r => setTimeout(r, 2000))

    if (abortRef.current) { cleanup(); return }

    const canvas = globeRef.current.getCanvas()
    if (!canvas) { cleanup(); return }

    // Verify canvas has content (not blank)
    const check = document.createElement('canvas')
    check.width = 4; check.height = 4
    check.getContext('2d')!.drawImage(canvas, 0, 0, 4, 4)
    const px = check.getContext('2d')!.getImageData(0, 0, 4, 4).data
    const hasContent = Array.from(px).some(v => v > 0)
    if (!hasContent) {
      alert('Globe is still loading — please try again in a moment.')
      cleanup()
      return
    }

    setState('recording')

    try {
      const blob = await exportTravelGIF(canvas, stats, pct => {
        if (!abortRef.current) setProgress(Math.round(pct * 100))
      })

      if (!abortRef.current) {
        setState('encoding')
        await shareOrDownload(blob)
      }
    } catch (e) {
      console.error('GIF export failed', e)
      alert('Export failed — try again or use a desktop browser for best results.')
    }

    cleanup()
  }

  function cleanup() {
    globeRef.current?.stopArcs()
    globeRef.current?.resetView()
    onRecordingChange(false)
    setState('idle')
    setProgress(0)
    abortRef.current = false
  }

  function handleCancel() {
    abortRef.current = true
    cleanup()
  }

  if (state === 'idle') {
    return (
      <button
        disabled={disabled}
        onClick={handleShare}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm
                   bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black transition-all
                   disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25
                   touch-manipulation"
        title={disabled ? 'Add photos first' : 'Export animated GIF'}
      >
        <span>✈️</span>
        <span className="hidden sm:inline">Share GIF</span>
        <span className="sm:hidden">Share</span>
      </button>
    )
  }

  const label = state === 'prep' ? 'Preparing…' : state === 'encoding' ? 'Saving…' : `${progress}%`

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: state === 'prep' ? '15%' : `${progress}%` }}
          />
        </div>
        <span className="text-xs text-white/50 w-14 text-right">{label}</span>
      </div>
      <button onClick={handleCancel} className="text-white/40 hover:text-white/80 text-sm touch-manipulation">
        ✕
      </button>
    </div>
  )
}
