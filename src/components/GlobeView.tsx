import {
  useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback,
} from 'react'
import Globe from 'react-globe.gl'
import type { Photo, ArcData } from '../types'

interface Props {
  photos: Photo[]
  visitedCodes: Set<string>
  originCode: string | null
  originLat: number | null
  originLng: number | null
  onUploadClick: () => void
  onPhotoClick: (photo: Photo) => void
  isRecording: boolean
}

export interface GlobeHandle {
  startArcs: (origin: { lat: number; lng: number }, dests: { lat: number; lng: number }[]) => void
  stopArcs: () => void
  getCanvas: () => HTMLCanvasElement | null
  resetView: () => void
}

// Keep rendererConfig stable (not recreated each render)
const RENDERER_CONFIG = { preserveDrawingBuffer: true, antialias: true }

const GlobeView = forwardRef<GlobeHandle, Props>((props, ref) => {
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [geoJSON, setGeoJSON] = useState<any>(null)
  const [arcs, setArcs] = useState<ArcData[]>([])

  const isEmpty = props.photos.length === 0

  // Load world GeoJSON
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
    )
      .then(r => r.json())
      .then(setGeoJSON)
      .catch(() => {})
  }, [])

  // Responsive size observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    // Set initial size
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    return () => ro.disconnect()
  }, [])

  // Globe controls — runs after every render to stay in sync
  useEffect(() => {
    if (!globeRef.current) return
    const ctrl = globeRef.current.controls()
    // Globe ALWAYS rotates (empty or loaded), pauses only while recording GIF
    ctrl.autoRotate = !props.isRecording
    ctrl.autoRotateSpeed = isEmpty ? 0.6 : 0.4
    ctrl.enablePan = false
    ctrl.minDistance = 150
    ctrl.maxDistance = 700
  })

  useImperativeHandle(ref, () => ({
    startArcs(origin, dests) {
      const newArcs: ArcData[] = dests.map(d => ({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: d.lat,
        endLng: d.lng,
        color: ['rgba(245,158,11,0.95)', 'rgba(245,158,11,0.15)'],
      }))
      setArcs(newArcs)
      // Gentle zoom out to see the whole globe during recording
      if (globeRef.current) {
        globeRef.current.pointOfView({ lat: 20, lng: origin.lng, altitude: 2.8 }, 1500)
      }
    },
    stopArcs() {
      setArcs([])
    },
    getCanvas() {
      return globeRef.current?.renderer()?.domElement ?? null
    },
    resetView() {
      globeRef.current?.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000)
    },
  }))

  const createPin = useCallback(
    (photo: Photo) => {
      const el = document.createElement('div')
      Object.assign(el.style, {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: '0 0 10px rgba(99,102,241,0.8), 0 2px 8px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        WebkitTapHighlightColor: 'transparent',
      })
      const img = document.createElement('img')
      img.src = photo.thumbnailDataUrl
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;'
      el.appendChild(img)

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.4)'
        el.style.zIndex = '999'
        el.style.boxShadow = '0 0 18px rgba(99,102,241,1), 0 4px 12px rgba(0,0,0,0.6)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
        el.style.zIndex = ''
        el.style.boxShadow = '0 0 10px rgba(99,102,241,0.8), 0 2px 8px rgba(0,0,0,0.5)'
      })
      el.addEventListener('click', e => {
        e.stopPropagation()
        props.onPhotoClick(photo)
      })
      // Touch support
      el.addEventListener('touchend', e => {
        e.stopPropagation()
        e.preventDefault()
        props.onPhotoClick(photo)
      }, { passive: false })

      return el
    },
    [props.onPhotoClick],
  )

  const visited = props.visitedCodes

  return (
    <div ref={containerRef} className="relative w-full h-full globe-wrapper">

      {/* Empty-state overlay — globe still rotates behind this */}
      {isEmpty && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(7,7,26,0.55) 100%)',
          }}
        >
          <button
            className="relative pointer-events-auto flex flex-col items-center gap-3 group"
            onClick={props.onUploadClick}
          >
            {/* Outer pulse ring */}
            <span
              className="absolute rounded-full border-2 border-indigo-400/50 animate-ping"
              style={{ width: 80, height: 80, top: -8, left: -8 }}
            />
            <div
              className="relative w-16 h-16 rounded-full bg-indigo-600/85 hover:bg-indigo-500
                         border-2 border-indigo-300 flex items-center justify-center text-2xl
                         shadow-2xl shadow-indigo-500/50 transition-all group-hover:scale-110
                         active:scale-95 touch-manipulation"
            >
              📍
            </div>
            <div className="text-center">
              <p className="text-white/80 text-sm font-semibold">Upload travel photos</p>
              <p className="text-white/40 text-xs mt-0.5">GPS data auto-detected</p>
            </div>
          </button>
        </div>
      )}

      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={RENDERER_CONFIG}

          // Earth textures
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere
          atmosphereColor="rgba(63,84,220,0.4)"
          atmosphereAltitude={0.14}

          // Country polygons
          polygonsData={geoJSON?.features ?? []}
          polygonCapColor={(d: any) => {
            const code: string = d?.properties?.ISO_A2 ?? ''
            return visited.has(code)
              ? 'rgba(74,222,128,0.70)'
              : 'rgba(18,26,58,0.50)'
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(100,130,220,0.25)'}
          polygonAltitude={(d: any) =>
            visited.has(d?.properties?.ISO_A2 ?? '') ? 0.018 : 0.006
          }

          // Photo pins
          htmlElementsData={props.photos}
          htmlElement={createPin as any}
          htmlAltitude={0.028}
          htmlTransitionDuration={800}

          // Airplane arcs
          arcsData={arcs}
          arcColor={'color'}
          arcDashLength={0.35}
          arcDashGap={0.65}
          arcDashAnimateTime={1800}
          arcStroke={2}
          arcAltitude={0.4}

          // Origin dot
          pointsData={
            props.originCode && props.originLat != null
              ? [{ lat: props.originLat, lng: props.originLng, color: 'rgba(239,68,68,0.95)', r: 0.5 }]
              : []
          }
          pointColor={'color'}
          pointRadius={'r' as any}
          pointAltitude={0.02}

          onGlobeClick={() => { if (isEmpty) props.onUploadClick() }}
          onGlobeReady={() => {
            if (!globeRef.current) return
            const ctrl = globeRef.current.controls()
            ctrl.autoRotate = true
            ctrl.autoRotateSpeed = isEmpty ? 0.6 : 0.4
            ctrl.enablePan = false
          }}
        />
      )}
    </div>
  )
})

GlobeView.displayName = 'GlobeView'
export default GlobeView
