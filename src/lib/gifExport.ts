import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { VisitStats } from '../types'

const GIF_W = 700
const GIF_H = 440
const CARD_H = 108
const FPS = 10
const DURATION_MS = 3500
const FRAME_COUNT = Math.round((FPS * DURATION_MS) / 1000) // 35

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
  const pad = 10
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
    {
      label: 'COUNTRY OF ORIGIN',
      value: stats.originCountry,
      sub: '',
    },
  ]

  cards.forEach((card, i) => {
    const x = pad + i * (cardW + pad)
    const y = pad

    // Card background
    ctx.fillStyle = 'rgba(22, 28, 72, 0.97)'
    roundRect(ctx, x, y, cardW, cardH, 8)
    ctx.fill()

    // Card border
    ctx.strokeStyle = 'rgba(99, 120, 220, 0.40)'
    ctx.lineWidth = 1
    roundRect(ctx, x, y, cardW, cardH, 8)
    ctx.stroke()

    const cx = x + cardW / 2
    ctx.textAlign = 'center'

    // Main value — auto-size font
    const fontSize = Math.min(24, Math.max(13, Math.floor((cardW - 20) / Math.max(card.value.length, 1) * 1.3)))
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillText(card.value, cx, y + cardH * 0.53, cardW - 16)

    // Sub line
    if (card.sub) {
      ctx.fillStyle = 'rgba(160, 180, 240, 0.9)'
      ctx.font = '10px sans-serif'
      ctx.fillText(card.sub, cx, y + cardH * 0.75)
    }

    // Label
    ctx.fillStyle = 'rgba(100, 120, 190, 0.75)'
    ctx.font = '9px sans-serif'
    ctx.fillText(card.label, cx, y + cardH * 0.92)

    ctx.textAlign = 'left'
  })
}

// Wait for the next rendered animation frame
function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}

export async function exportTravelGIF(
  webglCanvas: HTMLCanvasElement,
  stats: VisitStats,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const comp = document.createElement('canvas')
  comp.width = GIF_W
  comp.height = GIF_H
  const ctx = comp.getContext('2d')!

  const frameDelay = Math.round(1000 / FPS)
  const captureInterval = DURATION_MS / FRAME_COUNT
  const frames: Uint8ClampedArray[] = []

  for (let i = 0; i < FRAME_COUNT; i++) {
    // Wait for a rendered WebGL frame before capturing
    // Double-RAF ensures Three.js has completed its render call
    await nextFrame()
    await nextFrame()

    // Also spread captures over the duration so arcs animate visibly
    if (i > 0) {
      await new Promise(r => setTimeout(r, captureInterval * 0.7))
    }

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GIF_H)
    grad.addColorStop(0, '#07071a')
    grad.addColorStop(1, '#0d0d2b')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, GIF_W, GIF_H)

    // Stats cards
    drawCards(ctx, stats)

    // Globe canvas — centered below cards
    const gY = CARD_H + 4
    const avW = GIF_W - 16
    const avH = GIF_H - gY - 8
    const scale = Math.min(avW / webglCanvas.width, avH / webglCanvas.height, 1)
    const gW = webglCanvas.width * scale
    const gH = webglCanvas.height * scale
    const gX = (GIF_W - gW) / 2

    ctx.save()
    // Clip to a rounded rect for a cleaner look
    roundRect(ctx, gX - 2, gY + (avH - gH) / 2 - 2, gW + 4, gH + 4, 200)
    ctx.clip()
    ctx.drawImage(webglCanvas, gX, gY + (avH - gH) / 2, gW, gH)
    ctx.restore()

    // Watermark
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('My Travel Map', GIF_W - 8, GIF_H - 6)
    ctx.textAlign = 'left'

    frames.push(new Uint8ClampedArray(ctx.getImageData(0, 0, GIF_W, GIF_H).data))
    onProgress((i + 1) / FRAME_COUNT)
  }

  // Encode all frames as GIF
  const enc = GIFEncoder()
  for (const data of frames) {
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    enc.writeFrame(index, GIF_W, GIF_H, { palette, delay: frameDelay })
  }
  enc.finish()

  return new Blob([enc.bytes().buffer as ArrayBuffer], { type: 'image/gif' })
}
