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

const GlobeView = forwardRef<GlobeHandle, Props>((props, ref) => {
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [geoJSON, setGeoJSON] = useState<any>(null)
  const [arcs, setArcs] = useState<ArcData[]>([])

  const isEmpty = props.photos.length === 0

  // Load GeoJSON
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
    )
      .then(r => r.json())
      .then(setGeoJSON)
      .catch(() => {})
  }, [])

  // Responsive size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Globe controls
  useEffect(() => {
    if (!globeRef.current) return
    const ctrl = globeRef.current.controls()
    ctrl.autoRotate = !isEmpty && !props.isRecording
    ctrl.autoRotateSpeed = 0.4
    ctrl.enablePan = false
    ctrl.minDistance = 150
    ctrl.maxDistance = 600
  })

  useImperativeHandle(ref, () => ({
    startArcs(origin, dests) {
      const newArcs: ArcData[] = dests.map(d => ({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: d.lat,
        endLng: d.lng,
        color: ['rgba(245,158,11,0.9)', 'rgba(245,158,11,0.1)'],
      }))
      setArcs(newArcs)
      if (globeRef.current) {
        globeRef.current.pointOfView({ lat: origin.lat, lng: origin.lng, altitude: 2.2 }, 1200)
      }
    },
    stopArcs() { setArcs([]) },
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
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        overflow: 'hidden',
        border: '2.5px solid rgba(255,255,255,0.85)',
        boxShadow: '0 0 12px rgba(99,102,241,0.7)',
        cursor: 'pointer',
        transition: 'transform 0.15s',
      })
      const img = document.createElement('img')
      img.src = photo.thumbnailDataUrl
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
      el.appendChild(img)
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.35)'; el.style.zIndex = '999' })
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; el.style.zIndex = '' })
      el.addEventListener('click', e => { e.stopPropagation(); props.onPhotoClick(photo) })
      return el
    },
    [props.onPhotoClick],
  )

  const visited = props.visitedCodes

  return (
    <div ref={containerRef} className="relative w-full h-full globe-wrapper">
      {/* Empty state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <button
            className="relative pointer-events-auto flex flex-col items-center gap-3 group"
            onClick={props.onUploadClick}
          >
            <div className="pin-ring relative w-16 h-16 rounded-full bg-indigo-600/80
                            hover:bg-indigo-500 border-2 border-indigo-400 flex items-center
                            justify-center text-2xl shadow-lg shadow-indigo-500/40
                            transition-all group-hover:scale-110">
              📍
            </div>
            <span className="text-white/60 text-sm font-medium">Upload travel photos</span>
          </button>
        </div>
      )}

      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          rendererConfig={{ preserveDrawingBuffer: true }}

          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere
          atmosphereColor="rgba(63,84,220,0.35)"
          atmosphereAltitude={0.14}

          polygonsData={geoJSON?.features ?? []}
          polygonCapColor={(d: any) => {
            const code: string = d?.properties?.ISO_A2 ?? ''
            return visited.has(code) ? 'rgba(74,222,128,0.65)' : 'rgba(18,26,58,0.45)'
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(100,130,220,0.22)'}
          polygonAltitude={(d: any) =>
            visited.has(d?.properties?.ISO_A2 ?? '') ? 0.015 : 0.005
          }

          htmlElementsData={props.photos}
          htmlElement={createPin as any}
          htmlAltitude={0.025}
          htmlTransitionDuration={800}

          arcsData={arcs}
          arcColor={'color'}
          arcDashLength={0.35}
          arcDashGap={0.65}
          arcDashAnimateTime={2000}
          arcStroke={1.8}
          arcAltitude={0.35}

          pointsData={
            props.originCode && props.originLat != null
              ? [{ lat: props.originLat, lng: props.originLng, color: 'rgba(239,68,68,0.9)', r: 0.45 }]
              : []
          }
          pointColor={'color'}
          pointRadius={'r' as any}
          pointAltitude={0.02}

          onGlobeClick={() => { if (isEmpty) props.onUploadClick() }}
          onGlobeReady={() => {
            if (!globeRef.current) return
            const ctrl = globeRef.current.controls()
            ctrl.autoRotate = !isEmpty
            ctrl.autoRotateSpeed = 0.4
            ctrl.enablePan = false
          }}
        />
      )}
    </div>
  )
})

GlobeView.displayName = 'GlobeView'
export default GlobeView
