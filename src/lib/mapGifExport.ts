import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { Photo, VisitStats } from '../types'

const GIF_W = 960
const GIF_H = 580
const CARD_H = 118
const FPS    = 12
const DURATION_MS = 4000
const FRAME_COUNT = Math.round((FPS * DURATION_MS) / 1000)

// ── Shared canvas helpers ─────────────────────────────────────
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

function drawCards(ctx: CanvasRenderingContext2D, stats: VisitStats) {
  const pad   = 10
  const cardW = (GIF_W - pad * 4) / 3
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

    const cx = x + cardW / 2
    ctx.textAlign = 'center'

    const fontSize = Math.min(24, Math.max(13, Math.floor((cardW - 20) / Math.max(card.value.length, 1) * 1.3)))
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillText(card.value, cx, y + cardH * 0.53, cardW - 16)

    if (card.sub) {
      ctx.fillStyle = 'rgba(160,180,240,0.9)'
      ctx.font = '10px sans-serif'
      ctx.fillText(card.sub, cx, y + cardH * 0.75)
    }

    ctx.fillStyle = 'rgba(100,120,190,0.75)'
    ctx.font = '9px sans-serif'
    ctx.fillText(card.label, cx, y + cardH * 0.92)
    ctx.textAlign = 'left'
  })
}

// ── GeoJSON cache ─────────────────────────────────────────────
let geoCache: any = null
async function getGeoJSON(): Promise<any> {
  if (geoCache) return geoCache
  const r = await fetch(
    'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
  )
  geoCache = await r.json()
  return geoCache
}

// ── Simple equirectangular projection ────────────────────────
function makeProject(
  west: number, east: number, south: number, north: number,
  W: number, H: number,
  offsetX: number, offsetY: number,
) {
  const lngSpan = east - west || 0.001
  const latSpan = north - south || 0.001
  return (lng: number, lat: number): [number, number] => [
    offsetX + ((lng - west) / lngSpan) * W,
    offsetY + ((north - lat) / latSpan) * H,
  ]
}

// Draw a GeoJSON Polygon / MultiPolygon onto a canvas path
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
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
  }
}

// Preload an image from a data URL
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise(res => {
    const img = new Image()
    img.onload  = () => res(img)
    img.onerror = () => res(img)
    img.src     = src
  })
}

// ── Main export ──────────────────────────────────────────────
export async function exportMapGIF(
  photos: Photo[],
  countryCode: string,
  countryName: string,
  stats: VisitStats | null,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  if (photos.length === 0) throw new Error('No photos to export')

  const geoJSON = await getGeoJSON()

  // Features for the target country
  const targetFeats = (geoJSON.features as any[]).filter(
    f => f.properties?.ISO_A2 === countryCode,
  )

  // Bounding box: start with photo coordinates, expand with country GeoJSON
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

  // Add 15% padding around bounding box
  const pLng = Math.max((maxLng - minLng) * 0.15, 1.5)
  const pLat = Math.max((maxLat - minLat) * 0.15, 1.5)
  const [west, east, south, north] = [minLng - pLng, maxLng + pLng, minLat - pLat, maxLat + pLat]

  // Map canvas area (below stats cards when stats available)
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
  comp.width  = GIF_W
  comp.height = GIF_H
  const ctx   = comp.getContext('2d')!

  const frameDelay  = Math.round(1000 / FPS)
  const revealEnd   = Math.floor(FRAME_COUNT * 0.45)  // pins reveal over first 45% of frames
  const frames: Uint8ClampedArray[] = []

  for (let i = 0; i < FRAME_COUNT; i++) {
    // ── Background ───────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, GIF_H)
    bg.addColorStop(0, '#07071a')
    bg.addColorStop(1, '#0d0d2b')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, GIF_W, GIF_H)

    // ── Stats cards ──────────────────────────────────────────
    if (hasStats) drawCards(ctx, stats!)

    // ── Map area background ──────────────────────────────────
    ctx.fillStyle = 'rgba(8,10,36,0.90)'
    roundRect(ctx, mapLeft, mapTop, mapW, mapH, 12)
    ctx.fill()

    // Clip all map content to the rounded rectangle
    ctx.save()
    roundRect(ctx, mapLeft, mapTop, mapW, mapH, 12)
    ctx.clip()

    // Draw surrounding countries (very faint, skip target)
    for (const f of geoJSON.features as any[]) {
      if (f.properties?.ISO_A2 === countryCode) continue
      ctx.fillStyle   = 'rgba(28,36,80,0.55)'
      ctx.strokeStyle = 'rgba(55,75,140,0.30)'
      ctx.lineWidth   = 0.5
      geoPath(ctx, f, project)
      ctx.fill()
      ctx.stroke()
    }

    // Draw target country (highlighted teal)
    for (const f of targetFeats) {
      ctx.fillStyle   = 'rgba(52,211,153,0.22)'
      ctx.strokeStyle = 'rgba(52,211,153,0.85)'
      ctx.lineWidth   = 1.8
      geoPath(ctx, f, project)
      ctx.fill()
      ctx.stroke()
    }

    ctx.restore()

    // ── Photo pins (reveal animation) ───────────────────────
    const pinsVisible = i < revealEnd
      ? Math.ceil(photos.length * ((i + 1) / revealEnd))
      : photos.length

    for (let pi = 0; pi < pinsVisible; pi++) {
      const photo = photos[pi]
      const [cx, cy] = project(photo.lng, photo.lat)
      const r = 20

      // Clip to circle and draw thumbnail
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()
      const img = thumbs.get(photo.id)
      if (img?.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
      } else {
        ctx.fillStyle = 'rgba(99,102,241,0.6)'
        ctx.fill()
      }
      ctx.restore()

      // White border ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.88)'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Indigo glow
      ctx.beginPath()
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.38)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // ── Labels ───────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(countryName, GIF_W - 10, GIF_H - 8)

    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('My Travel Map', 10, GIF_H - 8)
    ctx.textAlign = 'left'

    frames.push(new Uint8ClampedArray(ctx.getImageData(0, 0, GIF_W, GIF_H).data))
    onProgress((i + 1) / FRAME_COUNT)

    // Yield so the browser stays responsive
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
