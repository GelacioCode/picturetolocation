import { useState, useRef } from 'react'
import { exportTravelGIF } from '../lib/gifExport'
import { exportMapGIF } from '../lib/mapGifExport'
import type { VisitStats, Photo } from '../types'
import type { GlobeHandle } from './GlobeView'
import type { CountryOption } from './CountryPicker'

interface Props {
  globeRef: React.RefObject<GlobeHandle | null>
  stats: VisitStats | null
  destinationPoints: { lat: number; lng: number }[]
  uniqueCountries: CountryOption[]
  photos: Photo[]
  viewMode: 'globe' | 'map'
  effectiveMapCode: string | null
  onRecordingChange: (recording: boolean) => void
}

function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '🏴'
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
}

// Share or download a blob — uses Web Share API on iOS, download link elsewhere
async function shareOrDownload(blob: Blob) {
  const file = new File([blob], 'my-travel-map.gif', { type: 'image/gif' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My Travel Map' }); return }
    catch { /* cancelled — fall through */ }
  }
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = 'my-travel-map.gif'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

type ExportMode = 'globe' | { countryCode: string; countryName: string }

export default function ShareButton({
  globeRef, stats, destinationPoints, uniqueCountries, photos,
  viewMode, effectiveMapCode, onRecordingChange,
}: Props) {
  const [phase, setPhase]         = useState<'idle' | 'picking' | 'prep' | 'recording' | 'encoding'>('idle')
  const [progress, setProgress]   = useState(0)
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null)
  const abortRef  = useRef(false)
  const btnRef    = useRef<HTMLButtonElement>(null)

  const hasPhotos  = photos.length > 0
  const multiCountry = uniqueCountries.length > 1

  // ── Decide what to do when the share button is tapped ───
  function handleClick() {
    if (phase !== 'idle') return
    if (!hasPhotos) return

    if (multiCountry) {
      // Show the picker popover
      setPickerAnchor(btnRef.current?.getBoundingClientRect() ?? null)
      setPhase('picking')
    } else {
      // Single country (or no international travel) → map GIF directly
      const c = uniqueCountries[0]
      startExport(c ? { countryCode: c.code, countryName: c.name } : 'globe')
    }
  }

  // ── Start export for the chosen mode ────────────────────
  async function startExport(mode: ExportMode) {
    abortRef.current = false
    setPhase('prep')

    if (mode === 'globe') {
      await runGlobeExport()
    } else {
      await runMapExport(mode.countryCode, mode.countryName)
    }
  }

  // ── Globe GIF (existing flow) ────────────────────────────
  async function runGlobeExport() {
    if (!globeRef.current || !stats) { setPhase('idle'); return }

    onRecordingChange(true)
    globeRef.current.startArcs(
      { lat: stats.originLat, lng: stats.originLng },
      destinationPoints,
    )
    await new Promise(r => setTimeout(r, 2000))
    if (abortRef.current) { cleanup(); return }

    const canvas = globeRef.current.getCanvas()
    if (!canvas) { cleanup(); return }

    // Sanity check — canvas must have content
    const ck = document.createElement('canvas')
    ck.width = 4; ck.height = 4
    ck.getContext('2d')!.drawImage(canvas, 0, 0, 4, 4)
    const px = ck.getContext('2d')!.getImageData(0, 0, 4, 4).data
    if (!Array.from(px).some(v => v > 0)) {
      alert('Globe is still loading — please try again in a moment.')
      cleanup(); return
    }

    setPhase('recording')
    try {
      const blob = await exportTravelGIF(canvas, stats, pct => {
        if (!abortRef.current) setProgress(Math.round(pct * 100))
      })
      if (!abortRef.current) { setPhase('encoding'); await shareOrDownload(blob) }
    } catch (e) {
      console.error('GIF export failed', e)
      alert('Export failed — try again or use a desktop browser for best results.')
    }
    cleanup()
  }

  // ── Country Map GIF ──────────────────────────────────────
  async function runMapExport(countryCode: string, countryName: string) {
    const countryPhotos = photos.filter(p => p.countryCode === countryCode)
    if (countryPhotos.length === 0) { cleanup(); return }

    setPhase('recording')
    try {
      const blob = await exportMapGIF(
        countryPhotos, countryCode, countryName, stats,
        pct => { if (!abortRef.current) setProgress(Math.round(pct * 100)) },
      )
      if (!abortRef.current) { setPhase('encoding'); await shareOrDownload(blob) }
    } catch (e) {
      console.error('Map GIF export failed', e)
      alert('Export failed — please try again.')
    }
    cleanup()
  }

  function cleanup() {
    globeRef.current?.stopArcs()
    globeRef.current?.resetView()
    onRecordingChange(false)
    setPhase('idle')
    setProgress(0)
    abortRef.current = false
  }

  function handleCancel() {
    abortRef.current = true
    cleanup()
  }

  // ── Idle state ───────────────────────────────────────────
  if (phase === 'idle' || phase === 'picking') {
    return (
      <div className="relative">
        <button
          ref={btnRef}
          disabled={!hasPhotos}
          onClick={handleClick}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm
                     bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black transition-all
                     disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25
                     touch-manipulation"
          title={!hasPhotos ? 'Add photos first' : 'Export animated GIF'}
        >
          <span>✈️</span>
          <span className="hidden sm:inline">Share GIF</span>
          <span className="sm:hidden">Share</span>
        </button>

        {/* ── GIF type picker popover ─────────────────── */}
        {phase === 'picking' && (
          <>
            {/* Backdrop — tap outside to dismiss */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setPhase('idle')}
            />
            <div
              className="absolute right-0 top-full mt-2 z-50 rounded-2xl shadow-2xl overflow-hidden"
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                minWidth: 220,
              }}
            >
              <p
                className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Export as GIF
              </p>

              {/* Globe option */}
              <button
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                           transition-all hover:bg-white/5 active:bg-white/10 touch-manipulation"
                style={{ color: 'var(--text)' }}
                onClick={() => { setPhase('idle'); startExport('globe') }}
              >
                <span className="text-lg">🌍</span>
                <div className="text-left">
                  <div>Globe (animated)</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    All destinations with arcs
                  </div>
                </div>
              </button>

              <div style={{ height: 1, background: 'var(--card-border)' }} />

              {/* One option per country */}
              {uniqueCountries.map(c => (
                <button
                  key={c.code}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium
                             transition-all hover:bg-white/5 active:bg-white/10 touch-manipulation"
                  style={{ color: 'var(--text)' }}
                  onClick={() => {
                    setPhase('idle')
                    startExport({ countryCode: c.code, countryName: c.name })
                  }}
                >
                  <span className="text-lg">{flagEmoji(c.code)}</span>
                  <div className="text-left">
                    <div>{c.name}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      Country map with pins
                    </div>
                  </div>
                </button>
              ))}

              <div className="pb-1" />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Progress state ───────────────────────────────────────
  const label =
    phase === 'prep'     ? 'Preparing…' :
    phase === 'encoding' ? 'Saving…'    :
    `${progress}%`

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: phase === 'prep' ? '15%' : `${progress}%` }}
          />
        </div>
        <span className="text-xs text-white/50 w-14 text-right">{label}</span>
      </div>
      <button
        onClick={handleCancel}
        className="text-white/40 hover:text-white/80 text-sm touch-manipulation"
      >
        ✕
      </button>
    </div>
  )
}
