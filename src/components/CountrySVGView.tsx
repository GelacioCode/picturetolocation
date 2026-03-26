import { useEffect, useState, useRef } from 'react'
import type { Photo } from '../types'

const GEOJSON_URL =
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson'

let geoCache: any = null
async function getGeoJSON() {
  if (geoCache) return geoCache
  const r = await fetch(GEOJSON_URL)
  geoCache = await r.json()
  return geoCache
}

function matchesCountry(f: any, code: string): boolean {
  const p = f.properties
  return p && (p.ISO_A2 === code || p.ISO_A2_EH === code || p.WB_A2 === code)
}

// GeoJSON ring → SVG path string
function ringToPath(ring: [number, number][], project: (lng: number, lat: number) => [number, number]): string {
  return ring.map(([lng, lat], i) => {
    const [x, y] = project(lng, lat)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function polyToPath(poly: [number, number][][], project: (lng: number, lat: number) => [number, number]): string {
  return poly.map(ring => ringToPath(ring, project)).join(' ')
}

interface Pin { x: number; y: number; photo: Photo }
interface Scene {
  vbW: number
  vbH: number
  surroundPaths: string[]
  targetPaths: string[]
  pins: Pin[]
}

interface Props {
  photos: Photo[]
  countryCode: string
  onPhotoClick: (photo: Photo) => void
}

export default function CountrySVGView({ photos, countryCode, onPhotoClick }: Props) {
  const [scene, setScene] = useState<Scene | null>(null)
  const clickRef = useRef(onPhotoClick)
  clickRef.current = onPhotoClick

  useEffect(() => {
    let cancelled = false
    setScene(null)

    getGeoJSON().then(geo => {
      if (cancelled) return

      const targetFeats = (geo.features as any[]).filter((f: any) => matchesCountry(f, countryCode))

      // Compute bounding box from GeoJSON + photo coords
      let [minLat, maxLat, minLng, maxLng] = [Infinity, -Infinity, Infinity, -Infinity]
      for (const ph of photos) {
        minLat = Math.min(minLat, ph.lat); maxLat = Math.max(maxLat, ph.lat)
        minLng = Math.min(minLng, ph.lng); maxLng = Math.max(maxLng, ph.lng)
      }
      for (const f of targetFeats) {
        const g = f.geometry
        const polys = g?.type === 'MultiPolygon' ? g.coordinates : [g?.coordinates ?? []]
        for (const poly of polys) for (const ring of poly)
          for (const [lng, lat] of ring) {
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
            minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
          }
      }
      if (!isFinite(minLat)) { minLat = -10; maxLat = 10; minLng = -10; maxLng = 10 }

      const pLng = Math.max((maxLng - minLng) * 0.15, 2)
      const pLat = Math.max((maxLat - minLat) * 0.15, 2)
      const wLng = minLng - pLng; const eLng = maxLng + pLng
      const sLat = minLat - pLat; const nLat = maxLat + pLat

      // SVG viewport — keep aspect ratio of the bbox
      const aspectRatio = (eLng - wLng) / (nLat - sLat)
      const vbH = 600
      const vbW = Math.round(vbH * Math.max(0.5, Math.min(3, aspectRatio)))

      const project = (lng: number, lat: number): [number, number] => [
        ((lng - wLng) / (eLng - wLng)) * vbW,
        ((nLat - lat) / (nLat - sLat)) * vbH,
      ]

      // Surrounding country paths
      const surroundPaths: string[] = []
      for (const f of geo.features as any[]) {
        if (matchesCountry(f, countryCode)) continue
        const g = f.geometry
        if (!g) continue
        const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
        for (const poly of polys) {
          surroundPaths.push(ringToPath(poly[0], project))
        }
      }

      // Target country paths (with holes via fillRule evenodd)
      const targetPaths: string[] = []
      for (const f of targetFeats) {
        const g = f.geometry
        const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
        for (const poly of polys) {
          targetPaths.push(polyToPath(poly, project))
        }
      }

      // Photo pin positions
      const pins: Pin[] = photos.map(photo => {
        const [x, y] = project(photo.lng, photo.lat)
        return { x, y, photo }
      })

      setScene({ vbW, vbH, surroundPaths, targetPaths, pins })
    })

    return () => { cancelled = true }
  }, [countryCode, photos])

  return (
    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(160deg,#06061a 0%,#0c0c2e 100%)', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes svgPulseRing {
          0%   { r: 42; opacity: 0.7; }
          100% { r: 80; opacity: 0; }
        }
        @keyframes svgPulseBlob {
          0%, 100% { opacity: 0.55; }
          50%       { opacity: 0.85; }
        }
        .sv-ring { animation: svgPulseRing 2.4s ease-out infinite; }
        .sv-blob { animation: svgPulseBlob 2.4s ease-in-out infinite; }
      `}</style>

      {!scene && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(129,140,248,0.6)', fontSize: 13 }}>
          Loading map…
        </div>
      )}

      {scene && (
        <svg
          viewBox={`0 0 ${scene.vbW} ${scene.vbH}`}
          style={{ width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
          overflow="hidden"
        >
          <defs>
            {/* Country gradient fill */}
            <linearGradient id="ctry-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#1e3a8a" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>

            {/* Per-pin radial glow */}
            {scene.pins.map((_, i) => (
              <radialGradient key={i} id={`pg-${i}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#34d399" stopOpacity="0.85" />
                <stop offset="55%"  stopColor="#34d399" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </radialGradient>
            ))}

            {/* Per-pin circle clip */}
            {scene.pins.map((pin, i) => (
              <clipPath key={i} id={`pc-${i}`}>
                <circle cx={pin.x} cy={pin.y} r={26} />
              </clipPath>
            ))}
          </defs>

          {/* ── Surrounding countries (dim navy) ── */}
          {scene.surroundPaths.map((d, i) => (
            <path key={i} d={d} fill="#0d1240" stroke="#1a2560" strokeWidth={0.6} opacity={0.75} />
          ))}

          {/* ── Target country ── */}
          {scene.targetPaths.map((d, i) => (
            <g key={i}>
              {/* Fill */}
              <path d={d} fill="url(#ctry-grad)" fillRule="evenodd" opacity={0.92} />
              {/* Inner glow overlay */}
              <path d={d} fill="#3b82f6" fillRule="evenodd" opacity={0.18} />
              {/* Border */}
              <path d={d} fill="none" fillRule="evenodd" stroke="#818cf8" strokeWidth={2} opacity={0.9} />
            </g>
          ))}

          {/* ── Visited-area blobs (one per photo) ── */}
          {scene.pins.map((pin, i) => (
            <g key={i}>
              {/* Animated expanding ring */}
              <circle
                className="sv-ring"
                cx={pin.x} cy={pin.y} r={42}
                fill="none" stroke="#34d399" strokeWidth={1.5}
                style={{ animationDelay: `${(i * 0.5) % 2.4}s` }}
              />
              {/* Radial glow blob (pulsing opacity) */}
              <circle
                className="sv-blob"
                cx={pin.x} cy={pin.y} r={52}
                fill={`url(#pg-${i})`}
                style={{ animationDelay: `${(i * 0.5) % 2.4}s` }}
              />
            </g>
          ))}

          {/* ── Photo thumbnail pins ── */}
          {scene.pins.map((pin, i) => (
            <g
              key={i}
              style={{ cursor: 'pointer' }}
              onClick={() => clickRef.current(pin.photo)}
            >
              {/* Drop shadow */}
              <circle cx={pin.x + 1} cy={pin.y + 2} r={28} fill="rgba(0,0,0,0.45)" />
              {/* Thumbnail clipped to circle */}
              <image
                href={pin.photo.thumbnailDataUrl}
                x={pin.x - 26} y={pin.y - 26}
                width={52} height={52}
                clipPath={`url(#pc-${i})`}
                preserveAspectRatio="xMidYMid slice"
              />
              {/* White border */}
              <circle cx={pin.x} cy={pin.y} r={26} fill="none" stroke="white" strokeWidth={2.5} opacity={0.95} />
              {/* Teal accent */}
              <circle cx={pin.x} cy={pin.y} r={30} fill="none" stroke="#34d399" strokeWidth={1.5} opacity={0.75} />
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
