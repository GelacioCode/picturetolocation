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

// Try multiple property fields to find the right country feature
function matchesCountry(f: any, code: string): boolean {
  const p = f.properties
  if (!p) return false
  return (
    p.ISO_A2 === code ||
    p.ISO_A2_EH === code ||
    p.WB_A2 === code
  )
}

// Centered equirectangular projection → Three.js XY coordinates
function makeProject(west: number, east: number, south: number, north: number) {
  const maxSpan = Math.max(east - west, north - south) || 0.001
  const cLng = (west + east) / 2
  const cLat = (south + north) / 2
  return (lng: number, lat: number): [number, number] => [
    ((lng - cLng) / maxSpan) * 0.85,
    ((lat - cLat) / maxSpan) * 0.85,
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
      // White ring
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'
      ctx.lineWidth = 7
      ctx.stroke()
      // Teal outer glow ring
      ctx.beginPath()
      ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(52,211,153,0.7)'
      ctx.lineWidth = 5
      ctx.stroke()
      const tex = new THREE.CanvasTexture(canvas)
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(0.13, 0.13, 1)
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x06061a)
    container.appendChild(renderer.domElement)

    // ── Camera ───────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 100)
    camera.position.set(0, -0.08, 1.9)
    camera.lookAt(0, 0.05, 0)

    const setSize = () => {
      const w = container.clientWidth
      const h = container.clientHeight || 1
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene()

    // ── Lights ──────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x2040a0, 3.0))
    const dirLight = new THREE.DirectionalLight(0x8899ff, 3.5)
    dirLight.position.set(2, 2, 4)
    scene.add(dirLight)

    // ── Background stars ────────────────────────────────────
    const starCount = 400
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3]     = (Math.random() - 0.5) * 8
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 8
      starPos[i * 3 + 2] = -2
    }
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.009, transparent: true, opacity: 0.6 }),
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

    // ── Pulsing blob meshes (animated) ───────────────────────
    const pulseMeshes: THREE.Mesh[] = []

    // ── Load GeoJSON + pin sprites async ────────────────────
    Promise.all([
      getGeoJSON(),
      Promise.all(photos.map(p =>
        createPinSprite(p.thumbnailDataUrl).then(sprite => ({ sprite, photo: p })),
      )),
    ]).then(([geo, pins]) => {
      const targetFeats = (geo.features as any[]).filter(
        (f: any) => matchesCountry(f, countryCode),
      )

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

      const pLng = Math.max((maxLng - minLng) * 0.14, 2)
      const pLat = Math.max((maxLat - minLat) * 0.14, 2)
      const project = makeProject(minLng - pLng, maxLng + pLng, minLat - pLat, maxLat + pLat)

      // ── Surrounding countries (very dim) ──────────────────
      for (const f of geo.features as any[]) {
        if (matchesCountry(f, countryCode)) continue
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
            new THREE.MeshBasicMaterial({ color: 0x0d1240, transparent: true, opacity: 0.65, depthWrite: false }),
          )
          mesh.position.z = -0.006
          scene.add(mesh)

          // Faint border for surrounding countries
          const pts2 = shape.extractPoints(4).shape
          if (pts2.length > 1) {
            const verts2 = [...pts2, pts2[0]].map(p => new THREE.Vector3(p.x, p.y, -0.003))
            scene.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(verts2),
              new THREE.LineBasicMaterial({ color: 0x1e2a6e, transparent: true, opacity: 0.5 }),
            ))
          }
        }
      }

      // ── Target country: deep indigo fill + bright border ──
      for (const f of targetFeats) {
        const g = f.geometry
        const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
        for (const poly of polys) {
          const shape = new THREE.Shape()
          ;(poly[0] as [number, number][]).forEach(([lng, lat], i) => {
            const [x, y] = project(lng, lat)
            if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y)
          })
          for (let ri = 1; ri < poly.length; ri++) {
            const hole = new THREE.Path()
            ;(poly[ri] as [number, number][]).forEach(([lng, lat], i) => {
              const [x, y] = project(lng, lat)
              if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y)
            })
            shape.holes.push(hole)
          }

          const fillGeo = new THREE.ShapeGeometry(shape)

          // Deep blue-indigo base
          scene.add(new THREE.Mesh(fillGeo,
            new THREE.MeshLambertMaterial({
              color: 0x1a237e,
              emissive: 0x283593,
              transparent: true,
              opacity: 0.95,
            }),
          ))

          // Bright indigo overlay glow
          const glowMesh = new THREE.Mesh(fillGeo,
            new THREE.MeshBasicMaterial({ color: 0x5c6bc0, transparent: true, opacity: 0.30 }),
          )
          glowMesh.position.z = 0.002
          scene.add(glowMesh)

          // Bright cyan/indigo border
          const pts = shape.extractPoints(12).shape
          if (pts.length > 1) {
            const verts = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, 0.01))
            scene.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(verts),
              new THREE.LineBasicMaterial({ color: 0x818cf8 }),
            ))
          }
        }
      }

      // If no country found at all, just render pins and rings based on photo coords
      // (project is still valid because we used photo bbox)

      // ── Visited-area glowing blobs (per photo) ────────────
      for (const ph of photos) {
        const [x, y] = project(ph.lng, ph.lat)

        // Large outer halo (soft glow)
        const haloGeo = new THREE.CircleGeometry(0.075, 32)
        const haloMesh = new THREE.Mesh(haloGeo,
          new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.18,
          }),
        )
        haloMesh.position.set(x, y, 0.005)
        scene.add(haloMesh)

        // Medium bright disc
        const discGeo = new THREE.CircleGeometry(0.045, 32)
        const discMesh = new THREE.Mesh(discGeo,
          new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.65,
          }),
        )
        discMesh.position.set(x, y, 0.008)
        scene.add(discMesh)
        pulseMeshes.push(discMesh)

        // Inner bright core
        const coreGeo = new THREE.CircleGeometry(0.02, 32)
        scene.add(Object.assign(new THREE.Mesh(coreGeo,
          new THREE.MeshBasicMaterial({ color: 0xd1fae5, transparent: true, opacity: 0.9 }),
        ), { position: new THREE.Vector3(x, y, 0.012) }))
      }

      // ── Photo pin sprites (floating above blobs) ──────────
      for (const { sprite, photo: ph } of pins) {
        const [x, y] = project(ph.lng, ph.lat)
        sprite.position.set(x, y, 0.08)
        scene.add(sprite)
        pinSprites.push({ sprite, photo: ph })
      }

      // ── Animation loop ────────────────────────────────────
      let t = 0
      function animate() {
        animId = requestAnimationFrame(animate)
        t += 0.018

        // Slowly orbit directional light for subtle shimmer on indigo fill
        dirLight.position.x = Math.cos(t * 0.3) * 3
        dirLight.position.y = Math.sin(t * 0.2) * 1.5 + 2

        // Pulse the visited-area discs
        const pulse = 1 + Math.sin(t * 2.2) * 0.18
        for (const m of pulseMeshes) {
          m.scale.set(pulse, pulse, 1)
        }

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

  return <div ref={containerRef} className="w-full h-full" style={{ background: '#06061a' }} />
}
