import { useEffect, useRef } from 'react'
import * as THREE from 'three'
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

// Centered equirectangular projection → Three.js XY coordinates (~0.9 units wide)
function makeProject(west: number, east: number, south: number, north: number) {
  const maxSpan = Math.max(east - west, north - south) || 0.001
  const cLng = (west + east) / 2
  const cLat = (south + north) / 2
  return (lng: number, lat: number): [number, number] => [
    ((lng - cLng) / maxSpan) * 0.9,
    ((lat - cLat) / maxSpan) * 0.9,
  ]
}

// Create a circular thumbnail sprite from a data URL
function createPinSprite(dataUrl: string): Promise<THREE.Sprite> {
  return new Promise(resolve => {
    const S = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = S
    const ctx = canvas.getContext('2d')!

    function finish() {
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.lineWidth = 7
      ctx.stroke()
      // Indigo outer glow
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(99,102,241,0.5)'
      ctx.lineWidth = 4
      ctx.stroke()
      const tex = new THREE.CanvasTexture(canvas)
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.11, 0.11, 1)
      resolve(sprite)
    }

    const img = new Image()
    img.onload = () => {
      ctx.save()
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, 14, 14, S - 28, S - 28)
      ctx.restore()
      finish()
    }
    img.onerror = () => {
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 14, 0, Math.PI * 2)
      ctx.fillStyle = '#6366f1'
      ctx.fill()
      finish()
    }
    img.src = dataUrl
  })
}

interface Props {
  photos: Photo[]
  countryCode: string
  onPhotoClick: (photo: Photo) => void
}

export default function CountryThreeView({ photos, countryCode, onPhotoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clickRef = useRef(onPhotoClick)
  clickRef.current = onPhotoClick

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let animId = 0

    // ── Renderer ────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const setSize = () => {
      const w = container.clientWidth
      const h = container.clientHeight || 1
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    // ── Camera ───────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(48, 1, 0.01, 100)
    camera.position.set(0, -0.10, 2.0)
    camera.lookAt(0, 0.05, 0)

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x07071a)

    // ── Lights ──────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x304070, 2.2))
    const dirLight = new THREE.DirectionalLight(0x88aaff, 2.8)
    dirLight.position.set(1, 1.5, 3)
    scene.add(dirLight)

    // ── Background stars ────────────────────────────────────
    const starPos = new Float32Array(300 * 3)
    for (let i = 0; i < 300; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 6
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 6
      starPos[i * 3 + 2] = -1
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.007, transparent: true, opacity: 0.45 }),
    ))

    // ── Raycaster for pin clicks ─────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const pinSprites: Array<{ sprite: THREE.Sprite; photo: Photo }> = []

    function handlePointerUp(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(pinSprites.map(p => p.sprite))
      if (hits.length > 0) {
        const item = pinSprites.find(p => p.sprite === hits[0].object)
        if (item) clickRef.current(item.photo)
      }
    }
    renderer.domElement.addEventListener('pointerup', handlePointerUp)

    // ── Resize ───────────────────────────────────────────────
    const ro = new ResizeObserver(setSize)
    ro.observe(container)
    setSize()

    // ── Load GeoJSON + pin sprites async ────────────────────
    Promise.all([
      getGeoJSON(),
      Promise.all(photos.map(p =>
        createPinSprite(p.thumbnailDataUrl).then(sprite => ({ sprite, photo: p })),
      )),
    ]).then(([geo, pins]) => {
      const targetFeats = (geo.features as any[]).filter(
        (f: any) => f.properties?.ISO_A2 === countryCode,
      )

      // Compute bounding box
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

      const pLng = Math.max((maxLng - minLng) * 0.12, 1.5)
      const pLat = Math.max((maxLat - minLat) * 0.12, 1.5)
      const project = makeProject(minLng - pLng, maxLng + pLng, minLat - pLat, maxLat + pLat)

      // ── Surrounding countries (faint navy) ────────────────
      for (const f of geo.features as any[]) {
        if (f.properties?.ISO_A2 === countryCode) continue
        const g = f.geometry
        if (!g) continue
        const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
        for (const poly of polys) {
          const shape = new THREE.Shape()
          ;(poly[0] as [number, number][]).forEach(([lng, lat], i) => {
            const [x, y] = project(lng, lat)
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
          })
          const mesh = new THREE.Mesh(
            new THREE.ShapeGeometry(shape),
            new THREE.MeshLambertMaterial({ color: 0x1a2258, transparent: true, opacity: 0.50, depthWrite: false }),
          )
          mesh.position.z = -0.005
          scene.add(mesh)
        }
      }

      // ── Target country: fill + border + glow ─────────────
      for (const f of targetFeats) {
        const g = f.geometry
        const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
        for (const poly of polys) {
          const shape = new THREE.Shape()
          ;(poly[0] as [number, number][]).forEach(([lng, lat], i) => {
            const [x, y] = project(lng, lat)
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
          })
          // Holes
          for (let ri = 1; ri < poly.length; ri++) {
            const hole = new THREE.Path()
            ;(poly[ri] as [number, number][]).forEach(([lng, lat], i) => {
              const [x, y] = project(lng, lat)
              if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y)
            })
            shape.holes.push(hole)
          }

          const fillGeo = new THREE.ShapeGeometry(shape)

          // Main fill
          scene.add(new THREE.Mesh(fillGeo,
            new THREE.MeshLambertMaterial({ color: 0x1d7a54, emissive: 0x0a3825, transparent: true, opacity: 0.88 }),
          ))

          // Emissive glow overlay
          const glowMesh = new THREE.Mesh(fillGeo,
            new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.09 }),
          )
          glowMesh.position.z = 0.002
          scene.add(glowMesh)

          // Bright border line
          const pts = shape.extractPoints(8).shape
          if (pts.length > 1) {
            const verts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, 0.008))
            scene.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(verts),
              new THREE.LineBasicMaterial({ color: 0x34d399 }),
            ))
          }
        }
      }

      // ── Visited-area glow rings ───────────────────────────
      for (const ph of photos) {
        const [x, y] = project(ph.lng, ph.lat)
        const ringGeo = new THREE.RingGeometry(0.04, 0.065, 32)
        scene.add(new THREE.Mesh(ringGeo,
          new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
        ))
        const ring = scene.children[scene.children.length - 1] as THREE.Mesh
        ring.position.set(x, y, 0.012)
      }

      // ── Photo pin sprites ─────────────────────────────────
      for (const { sprite, photo: ph } of pins) {
        const [x, y] = project(ph.lng, ph.lat)
        sprite.position.set(x, y, 0.06)
        scene.add(sprite)
        pinSprites.push({ sprite, photo: ph })
      }

      // ── Animation loop ────────────────────────────────────
      let t = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        t += 0.006
        dirLight.position.x = Math.cos(t) * 2.5
        dirLight.position.y = Math.sin(t * 0.6) * 1.2 + 1.5
        renderer.render(scene, camera)
      }
      animate()
    })

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [countryCode, photos])

  return <div ref={containerRef} className="w-full h-full" style={{ background: '#07071a' }} />
}
