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

export default function ShareButton({ globeRef, stats, destinationPoints, onRecordingChange }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'encoding'>('idle')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef(false)

  const disabled = !stats || destinationPoints.length === 0

  async function handleShare() {
    if (!globeRef.current || !stats) return

    abortRef.current = false
    setState('recording')
    onRecordingChange(true)

    // Start arc animation + point view to origin
    globeRef.current.startArcs(
      { lat: stats.originLat, lng: stats.originLng },
      destinationPoints,
    )

    // Let the animation warm up for 200ms, then capture
    await new Promise(r => setTimeout(r, 200))

    const canvas = globeRef.current.getCanvas()
    if (!canvas) {
      cleanup()
      return
    }

    setState('encoding')
    try {
      const blob = await exportTravelGIF(canvas, stats, pct => {
        if (!abortRef.current) setProgress(Math.round(pct * 100))
      })

      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-travel-map.gif'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('GIF export failed', e)
    }

    cleanup()
  }

  function cleanup() {
    globeRef.current?.stopArcs()
    globeRef.current?.resetView()
    onRecordingChange(false)
    setState('idle')
    setProgress(0)
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
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                   bg-amber-500 hover:bg-amber-400 text-black transition-all
                   disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
        title={disabled ? 'Add photos first' : 'Export animated GIF'}
      >
        <span>✈️</span> Share GIF
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-white/50 w-12">
          {state === 'recording' ? 'Capturing…' : `${progress}%`}
        </span>
      </div>
      <button
        onClick={handleCancel}
        className="text-white/40 hover:text-white/80 text-sm"
      >
        Cancel
      </button>
    </div>
  )
}
