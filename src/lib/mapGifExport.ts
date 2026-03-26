import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { Photo, VisitStats } from '../types'

const GIF_W = 960
const GIF_H = 580
const CARD_H = 118
const FPS    = 12
const DURATION_MS = 4000
const FRAME_COUNT = Math.round((FPS * DURATION_MS) / 1000)

// ── Canvas helpers ────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawCards(ctx: CanvasRenderingContext2D, stats: VisitStats, countryName: string) {
  const pad   = 10
  const cardW = (GIF_W - pad * 5) / 4
  const cardH = CARD_H - pad * 2

  const cards = [
    {
      label: 'COUNTRIES VISITED',
      value: String(stats.countriesVisited),
      sub: `${stats.totalPhotos} photo${stats.totalPhotos !== 1 ? 's' : ''}`,
    },
    {
      label: 'MOST VISITED',
      value: stats.mostVisitedCountry || '—',
      sub: stats.mostVisitedCountry
        ? `${stats.mostVisitedVisits} trip${stats.mostVisitedVisits !== 1 ? 's' : ''}`
        : '',
    },
    { label: 'COUNTRY OF ORIGIN', value: stats.originCountry, sub: '' },
    { label: 'SELECTED MAP', value: countryName, sub: '' },
  ]

  cards.forEach((card, i) => {
    const x = pad + i * (cardW + pad)
    const y = pad

    ctx.fillStyle = 'rgba(22,28,72,0.97)'
    roundRect(ctx, x, y, cardW, cardH, 8)
    ctx.fill()

    ctx.strokeStyle = 'rgba(99,120,220,0.40)'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, cardW, cardH, 8)
    ctx.stroke()

    const cx2 = x + cardW / 2
    ctx.textAlign = 'center'

    const fontSize = Math.min(24, Math.max(13, Math.floor((cardW - 20) / Math.max(card.value.length, 1) * 1.3)))
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillText(card.value, cx2, y + cardH * 0.53, cardW - 16)

    if (card.sub) {
      ctx.fillStyle = 'rgba(160,180,240,0.9)'
      ctx.font = '10px sans-serif'
      ctx.fillText(card.sub, cx2, y + cardH * 0.75)
    }

    ctx.fillStyle = 'rgba(100,120,190,0.75)'
    ctx.font = '9px sans-serif'
    ctx.fillText(card.label, cx2, y + cardH * 0.92)
    ctx.textAlign = 'left'
  })
}

// ── Animated arc (quadratic bezier, draws up to t=0..1) ──────
function drawArc(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  t: number,
) {
  if (t <= 0) return

  // Control point: above the midpoint — creates a nice upward curve
  const mx  = (x1 + x2) / 2
  const my  = (y1 + y2) / 2
  const dx  = x2 - x1
  const dy  = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Perpendicular, pointing "up" on screen (negative y = up)
  const cpx = mx + (dy / len) * Math.min(len * 0.35, 60)
  const cpy = my - (dx / len) * Math.min(len * 0.35, 60) - len * 0.1

  // Draw partial bezier up to t
  const steps = Math.max(6, Math.round(50 * t))
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const p  = (i / steps) * t
    const bx = (1 - p) * (1 - p) * x1 + 2 * (1 - p) * p * cpx + p * p * x2
    const by = (1 - p) * (1 - p) * y1 + 2 * (1 - p) * p * cpy + p * p * y2
    if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by)
  }
  ctx.strokeStyle = 'rgba(245,158,11,0.80)'
  ctx.lineWidth   = 1.8
  ctx.stroke()

  // Airplane dot at the tip of the arc
  const tipX = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cpx + t * t * x2
  const tipY = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cpy + t * t * y2
  ctx.beginPath()
  ctx.arc(tipX, tipY, 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(245,158,11,0.95)'
  ctx.fill()
}

// ── GeoJSON cache ─────────────────────────────────────────────
let geoCache: any = null
async function getGeoJSON() {
  if (geoCache) return geoCache
  const r = await fetch(
    'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
  )
  geoCache = await r.json()
  return geoCache
}

// ── Equirectangular projection ────────────────────────────────
function makeProject(
  west: number, east: number, south: number, north: number,
  W: number, H: number,
  offX: number, offY: number,
) {
  const lngSpan = east  - west  || 0.001
  const latSpan = north - south || 0.001
  return (lng: number, lat: number): [number, number] => [
    offX + ((lng - west)  / lngSpan) * W,
    offY + ((north - lat) / latSpan) * H,
  ]
}

// Draw a GeoJSON Polygon/MultiPolygon onto a canvas path
function geoPath(
  ctx: CanvasRenderingContext2D,
  feature: any,
  project: (lng: number, lat: number) => [number, number],
) {
  const g = feature.geometry
  if (!g) return
  const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
  ctx.beginPath()
  for (const poly of polys)
    for (const ring of poly) {
      ring.forEach(([lng, lat]: [number, number], i: number) => {
        const [x, y] = project(lng, lat)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise(res => {
    const img = new Image()
    img.onload = img.onerror = () => res(img)
    img.src = src
  })
}

// ── Main export ───────────────────────────────────────────────
export async function exportMapGIF(
  photos: Photo[],
  countryCode: string,
  countryName: string,
  stats: VisitStats | null,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  if (photos.length === 0) throw new Error('No photos to export')

  const geoJSON = await getGeoJSON()
  const targetFeats = (geoJSON.features as any[]).filter(
    f => f.properties?.ISO_A2 === countryCode,
  )

  // Bounding box from photos + GeoJSON features
  let [minLat, maxLat, minLng, maxLng] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const p of photos) {
    minLat = Math.min(minLat, p.lat);  maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng);  maxLng = Math.max(maxLng, p.lng)
  }
  for (const f of targetFeats) {
    const g = f.geometry
    const polys = g?.type === 'MultiPolygon' ? g.coordinates : [g?.coordinates ?? []]
    for (const poly of polys) for (const ring of poly) for (const [lng, lat] of ring) {
      minLat = Math.min(minLat, lat);  maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng);  maxLng = Math.max(maxLng, lng)
    }
  }

  // Arc origin: use stats origin if available, else centroid of photos
  const originLat = stats?.originLat ?? photos.reduce((s, p) => s + p.lat, 0) / photos.length
  const originLng = stats?.originLng ?? photos.reduce((s, p) => s + p.lng, 0) / photos.length

  // Expand bbox to include arc origin if it's within 60 degrees of country center
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  if (Math.abs(originLat - centerLat) < 60 && Math.abs(originLng - centerLng) < 80) {
    minLat = Math.min(minLat, originLat)
    maxLat = Math.max(maxLat, originLat)
    minLng = Math.min(minLng, originLng)
    maxLng = Math.max(maxLng, originLng)
  }

  const pLng = Math.max((maxLng - minLng) * 0.15, 1.5)
  const pLat = Math.max((maxLat - minLat) * 0.15, 1.5)
  const [west, east, south, north] = [minLng - pLng, maxLng + pLng, minLat - pLat, maxLat + pLat]

  const hasStats = !!stats
  const mapTop  = hasStats ? CARD_H + 6 : 8
  const mapLeft = 8
  const mapW    = GIF_W - 16
  const mapH    = GIF_H - mapTop - 8

  const project = makeProject(west, east, south, north, mapW, mapH, mapLeft, mapTop)

  // Preload thumbnails
  const thumbs = new Map<string, HTMLImageElement>()
  await Promise.all(photos.map(async p => { thumbs.set(p.id, await loadImg(p.thumbnailDataUrl)) }))

  const comp = document.createElement('canvas')
  comp.width = GIF_W; comp.height = GIF_H
  const ctx  = comp.getContext('2d')!

  // Animation phases (in frames):
  //  0 → arcEnd  : arcs fly from origin to all destinations simultaneously
  //  arcEnd → end: everything holds static
  const arcEnd   = Math.floor(FRAME_COUNT * 0.55) // ~60% for arc animation
  const frameDelay = Math.round(1000 / FPS)
  const frames: Uint8ClampedArray[] = []

  for (let i = 0; i < FRAME_COUNT; i++) {
    const arcT = i < arcEnd ? (i + 1) / arcEnd : 1.0  // 0→1 over first 55% of frames

    // ── Background ─────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, GIF_H)
    bg.addColorStop(0, '#07071a'); bg.addColorStop(1, '#0d0d2b')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, GIF_W, GIF_H)

    // ── Stats cards ─────────────────────────────────────────
    if (hasStats) drawCards(ctx, stats!, countryName)

    // ── Map area background ──────────────────────────────────
    ctx.fillStyle = 'rgba(8,10,36,0.90)'
    roundRect(ctx, mapLeft, mapTop, mapW, mapH, 12)
    ctx.fill()

    // Clip all map drawing to rounded rect
    ctx.save()
    roundRect(ctx, mapLeft, mapTop, mapW, mapH, 12)
    ctx.clip()

    // Surrounding countries (faint)
    for (const f of geoJSON.features as any[]) {
      if (f.properties?.ISO_A2 === countryCode) continue
      ctx.fillStyle   = 'rgba(28,36,80,0.55)'
      ctx.strokeStyle = 'rgba(55,75,140,0.28)'
      ctx.lineWidth   = 0.5
      geoPath(ctx, f, project)
      ctx.fill(); ctx.stroke()
    }

    // Target country (highlighted teal)
    for (const f of targetFeats) {
      ctx.fillStyle   = 'rgba(52,211,153,0.22)'
      ctx.strokeStyle = 'rgba(52,211,153,0.85)'
      ctx.lineWidth   = 1.8
      geoPath(ctx, f, project)
      ctx.fill(); ctx.stroke()
    }

    ctx.restore()

    // ── Airplane arcs (origin → each photo) ────────────────
    const [ox, oy] = project(originLng, originLat)
    for (const photo of photos) {
      const [px, py] = project(photo.lng, photo.lat)
      drawArc(ctx, ox, oy, px, py, arcT)
    }

    // ── Origin dot ─────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(ox, oy, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(239,68,68,0.95)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ox, oy, 8, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(239,68,68,0.40)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // ── Photo pins (always visible) ─────────────────────────
    for (const photo of photos) {
      const [px, py] = project(photo.lng, photo.lat)
      const r = 18

      ctx.save()
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.clip()
      const img = thumbs.get(photo.id)
      if (img?.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, px - r, py - r, r * 2, r * 2)
      } else {
        ctx.fillStyle = 'rgba(99,102,241,0.6)'
        ctx.fill()
      }
      ctx.restore()

      // White border
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Indigo glow
      ctx.beginPath()
      ctx.arc(px, py, r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // ── Labels ─────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font      = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(countryName, GIF_W - 10, GIF_H - 8)

    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font      = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('My Travel Map', 10, GIF_H - 8)

    frames.push(new Uint8ClampedArray(ctx.getImageData(0, 0, GIF_W, GIF_H).data))
    onProgress((i + 1) / FRAME_COUNT)

    if (i % 4 === 0) await new Promise(r => setTimeout(r, 0))
  }

  // ── Encode GIF ───────────────────────────────────────────
  const enc = GIFEncoder()
  for (const data of frames) {
    const palette = quantize(data, 256)
    const index   = applyPalette(data, palette)
    enc.writeFrame(index, GIF_W, GIF_H, { palette, delay: frameDelay })
  }
  enc.finish()
  return new Blob([enc.bytes().buffer as ArrayBuffer], { type: 'image/gif' })
}
