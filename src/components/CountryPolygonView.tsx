import { useRef, useEffect, useCallback } from 'react'
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

function geoPath(
  ctx: CanvasRenderingContext2D,
  feature: any,
  project: (lng: number, lat: number) => [number, number],
) {
  const g = feature.geometry
  if (!g) return
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
  ctx.beginPath()
  for (const poly of polys) {
    for (const ring of poly) {
      ring.forEach(([lng, lat]: [number, number], i: number) => {
        const [x, y] = project(lng, lat)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
  }
}

function makeProject(
  west: number,
  east: number,
  south: number,
  north: number,
  W: number,
  H: number,
) {
  const lngSpan = east - west || 0.001
  const latSpan = north - south || 0.001
  return (lng: number, lat: number): [number, number] => [
    ((lng - west) / lngSpan) * W,
    ((north - lat) / latSpan) * H,
  ]
}

interface PinPos {
  photo: Photo
  x: number
  y: number
}

interface Props {
  photos: Photo[]
  countryCode: string
  onPhotoClick: (photo: Photo) => void
}

export default function CountryPolygonView({ photos, countryCode, onPhotoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const geoRef = useRef<any>(null)
  const imgsRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const pinsRef = useRef<PinPos[]>([])
  const photosRef = useRef(photos)
  photosRef.current = photos

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    if (W === 0 || H === 0) return

    const geo = geoRef.current
    const currentPhotos = photosRef.current

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#07071a')
    bg.addColorStop(1, '#0e0e2e')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    if (!geo) return

    const targetFeats = (geo.features as any[]).filter(
      (f) => f.properties?.ISO_A2 === countryCode,
    )

    // Bounding box from photos + target GeoJSON coordinates
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity

    for (const p of currentPhotos) {
      minLat = Math.min(minLat, p.lat)
      maxLat = Math.max(maxLat, p.lat)
      minLng = Math.min(minLng, p.lng)
      maxLng = Math.max(maxLng, p.lng)
    }
    for (const f of targetFeats) {
      const g = f.geometry
      const polys = g?.type === 'MultiPolygon' ? g.coordinates : [g?.coordinates ?? []]
      for (const poly of polys)
        for (const ring of poly)
          for (const [lng, lat] of ring) {
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
            minLng = Math.min(minLng, lng)
            maxLng = Math.max(maxLng, lng)
          }
    }

    if (!isFinite(minLat)) return

    const pLng = Math.max((maxLng - minLng) * 0.15, 1.5)
    const pLat = Math.max((maxLat - minLat) * 0.15, 1.5)
    const west = minLng - pLng
    const east = maxLng + pLng
    const south = minLat - pLat
    const north = maxLat + pLat

    const project = makeProject(west, east, south, north, W, H)

    // Surrounding countries (faint)
    for (const f of geo.features as any[]) {
      if (f.properties?.ISO_A2 === countryCode) continue
      ctx.fillStyle = 'rgba(28,36,80,0.55)'
      ctx.strokeStyle = 'rgba(55,75,140,0.28)'
      ctx.lineWidth = 0.5
      geoPath(ctx, f, project)
      ctx.fill()
      ctx.stroke()
    }

    // Target country
    for (const f of targetFeats) {
      ctx.fillStyle = 'rgba(52,211,153,0.20)'
      ctx.strokeStyle = 'rgba(52,211,153,0.85)'
      ctx.lineWidth = 1.8
      geoPath(ctx, f, project)
      ctx.fill()
      ctx.stroke()
    }

    // Visited-area glow at each photo location
    const glowR = Math.max(W * 0.06, 30)
    for (const photo of currentPhotos) {
      const [x, y] = project(photo.lng, photo.lat)
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR)
      grad.addColorStop(0, 'rgba(52,211,153,0.38)')
      grad.addColorStop(1, 'rgba(52,211,153,0)')
      ctx.beginPath()
      ctx.arc(x, y, glowR, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Photo thumbnail pins
    const pins: PinPos[] = []
    const pinR = 18 // 36px diameter

    for (const photo of currentPhotos) {
      const [x, y] = project(photo.lng, photo.lat)
      pins.push({ photo, x, y })

      // Outer glow ring
      ctx.beginPath()
      ctx.arc(x, y, pinR + 6, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.38)'
      ctx.lineWidth = 3
      ctx.stroke()

      // Clip to circle and draw thumbnail
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, pinR, 0, Math.PI * 2)
      ctx.clip()

      const img = imgsRef.current.get(photo.id)
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - pinR, y - pinR, pinR * 2, pinR * 2)
      } else {
        ctx.fillStyle = 'rgba(99,102,241,0.6)'
        ctx.fill()
      }
      ctx.restore()

      // White border
      ctx.beginPath()
      ctx.arc(x, y, pinR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,1)'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }

    pinsRef.current = pins
  }, [countryCode])

  // Load GeoJSON once
  useEffect(() => {
    getGeoJSON().then((geo) => {
      geoRef.current = geo
      draw()
    })
  }, [draw])

  // Preload thumbnails
  useEffect(() => {
    for (const photo of photos) {
      if (!imgsRef.current.has(photo.id)) {
        const img = new Image()
        img.onload = () => draw()
        img.onerror = () => draw()
        img.src = photo.thumbnailDataUrl
        imgsRef.current.set(photo.id, img)
      }
    }
    draw()
  }, [photos, draw])

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      draw()
    })
    ro.observe(container)

    // Initial size
    const { width, height } = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    draw()

    return () => ro.disconnect()
  }, [draw])

  // Click / touch handler
  const handleInteraction = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const cx = (clientX - rect.left) * dpr
      const cy = (clientY - rect.top) * dpr

      for (const pin of pinsRef.current) {
        const dx = cx - pin.x
        const dy = cy - pin.y
        if (Math.sqrt(dx * dx + dy * dy) <= 28 * dpr) {
          onPhotoClick(pin.photo)
          return
        }
      }
    },
    [onPhotoClick],
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#07071a' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        onClick={(e) => handleInteraction(e.clientX, e.clientY)}
        onTouchEnd={(e) => {
          e.preventDefault()
          const t = e.changedTouches[0]
          if (t) handleInteraction(t.clientX, t.clientY)
        }}
      />
    </div>
  )
}
