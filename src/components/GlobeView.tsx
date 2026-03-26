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
  focusCountry: (lat: number, lng: number) => void
}

// Stable renderer config — must not be recreated each render
const RENDERER_CONFIG = { preserveDrawingBuffer: true, antialias: true }

// ── Color constants ──────────────────────────────────────────
// Polygon layer = country-level tint (shows which countries have photos)
const COLOR_VISITED_POLYGON  = 'rgba(74, 222, 128, 0.38)'   // clear green for visited countries
const COLOR_ORIGIN_POLYGON   = 'rgba(251, 146, 60, 0.42)'   // warm amber for home country
const COLOR_UNVISITED        = 'rgba(18, 26, 58, 0.52)'

// Hex-bin layer = precise sub-country highlight at actual GPS coordinates
// Sits ABOVE the polygon layer (higher altitude) to show exact visited spots
const COLOR_HEX_VISIT_TOP   = 'rgba(52, 211, 153, 0.95)'    // vivid teal-green
const COLOR_HEX_VISIT_SIDE  = 'rgba(52, 211, 153, 0.35)'
const COLOR_HEX_ORIGIN_TOP  = 'rgba(251, 146, 60, 0.95)'    // vivid amber for home spots
const COLOR_HEX_ORIGIN_SIDE = 'rgba(251, 146, 60, 0.38)'

const GlobeView = forwardRef<GlobeHandle, Props>((props, ref) => {
  const globeRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [geoJSON, setGeoJSON] = useState<any>(null)
  const [arcs, setArcs] = useState<ArcData[]>([])

  const isEmpty = props.photos.length === 0

  // Load world GeoJSON for country borders/fills
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
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    }
    return () => ro.disconnect()
  }, [])

  // Globe controls — sync after every render
  useEffect(() => {
    if (!globeRef.current) return
    const ctrl = globeRef.current.controls()
    ctrl.autoRotate = !props.isRecording   // always rotating, pauses only for GIF
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
        color: ['rgba(245,158,11,0.95)', 'rgba(245,158,11,0.10)'],
      }))
      setArcs(newArcs)
      if (globeRef.current) {
        // Zoom out to see the whole globe during GIF recording
        globeRef.current.pointOfView({ lat: 15, lng: origin.lng, altitude: 2.8 }, 1500)
      }
    },
    stopArcs() { setArcs([]) },
    getCanvas() { return globeRef.current?.renderer()?.domElement ?? null },
    resetView() {
      globeRef.current?.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000)
    },
    focusCountry(lat, lng) {
      globeRef.current?.pointOfView({ lat, lng, altitude: 1.1 }, 1200)
    },
  }))

  const createPin = useCallback((photo: Photo) => {
    const el = document.createElement('div')
    Object.assign(el.style, {
      width: '40px', height: '40px', borderRadius: '50%',
      overflow: 'hidden',
      border: '2px solid rgba(255,255,255,0.9)',
      boxShadow: '0 0 10px rgba(99,102,241,0.8), 0 2px 8px rgba(0,0,0,0.5)',
      cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
      WebkitTapHighlightColor: 'transparent',
    })
    const img = document.createElement('img')
    img.src = photo.thumbnailDataUrl
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;'
    el.appendChild(img)
    el.addEventListener('mouseenter', () => {
      el.style.transform = 'scale(1.4)'
      el.style.zIndex = '999'
    })
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'scale(1)'
      el.style.zIndex = ''
    })
    el.addEventListener('click', e => { e.stopPropagation(); props.onPhotoClick(photo) })
    el.addEventListener('touchend', e => {
      e.stopPropagation(); e.preventDefault(); props.onPhotoClick(photo)
    }, { passive: false })
    return el
  }, [props.onPhotoClick])

  const visited    = props.visitedCodes
  const originCode = props.originCode

  return (
    <div ref={containerRef} className="relative w-full h-full globe-wrapper">

      {/* Empty-state overlay — rotating globe shows behind this */}
      {isEmpty && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 28%, rgba(7,7,26,0.6) 100%)' }}
        >
          <button
            className="relative pointer-events-auto flex flex-col items-center gap-3 group"
            onClick={props.onUploadClick}
          >
            <span
              className="absolute rounded-full border-2 border-indigo-400/50 animate-ping"
              style={{ width: 80, height: 80, top: -8, left: -8 }}
            />
            <div
              className="relative w-16 h-16 rounded-full flex items-center justify-center text-2xl
                         border-2 border-indigo-300 transition-all group-hover:scale-110 active:scale-95
                         touch-manipulation shadow-2xl shadow-indigo-500/50"
              style={{ background: 'rgba(79,70,229,0.85)' }}
            >
              📍
            </div>
            <div className="text-center">
              <p className="text-white/85 text-sm font-semibold">Upload travel photos</p>
              <p className="text-white/45 text-xs mt-0.5">GPS data auto-detected</p>
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
          atmosphereColor="rgba(63,84,220,0.38)"
          atmosphereAltitude={0.14}

          // ── Country polygons ──────────────────────────────────
          // Very subtle tints — just enough to see home country
          // Real "visited" areas shown by hex bins below
          polygonsData={geoJSON?.features ?? []}
          polygonCapColor={(d: any) => {
            const code: string = d?.properties?.ISO_A2 ?? ''
            if (code === originCode) return COLOR_ORIGIN_POLYGON
            if (visited.has(code))   return COLOR_VISITED_POLYGON
            return COLOR_UNVISITED
          }}
          polygonSideColor={() => 'rgba(0,0,0,0)'}
          polygonStrokeColor={() => 'rgba(100,130,220,0.20)'}
          polygonAltitude={(d: any) => {
            const code: string = d?.properties?.ISO_A2 ?? ''
            if (code === originCode) return 0.015
            if (visited.has(code))   return 0.012
            return 0.005
          }}

          // ── Hex-bin layer — highlights EXACT visited sub-regions ──
          // Each hexagon covers ~200–400 km, so HK ≠ all of China
          hexBinPointsData={props.photos}
          hexBinPointLat={(d: any) => (d as Photo).lat}
          hexBinPointLng={(d: any) => (d as Photo).lng}
          hexBinResolution={4}
          hexMargin={0.15}
          hexAltitude={0.05}
          hexTopColor={(d: any) => {
            // d is an array of Photo objects in this hex cell
            const inOrigin = originCode && (d as Photo[]).some(p => p.countryCode === originCode)
            return inOrigin ? COLOR_HEX_ORIGIN_TOP : COLOR_HEX_VISIT_TOP
          }}
          hexSideColor={(d: any) => {
            const inOrigin = originCode && (d as Photo[]).some(p => p.countryCode === originCode)
            return inOrigin ? COLOR_HEX_ORIGIN_SIDE : COLOR_HEX_VISIT_SIDE
          }}

          // ── Photo thumbnail pins ──────────────────────────────
          htmlElementsData={props.photos}
          htmlElement={createPin as any}
          htmlAltitude={0.03}
          htmlTransitionDuration={800}

          // ── Airplane arcs ─────────────────────────────────────
          arcsData={arcs}
          arcColor={'color'}
          arcDashLength={0.35}
          arcDashGap={0.65}
          arcDashAnimateTime={1800}
          arcStroke={2}
          arcAltitude={0.4}

          // ── Origin dot ───────────────────────────────────────
          pointsData={
            originCode && props.originLat != null
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
