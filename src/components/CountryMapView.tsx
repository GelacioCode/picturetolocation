import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Photo } from '../types'

interface Props {
  photos: Photo[]         // already filtered to this country
  onPhotoClick: (photo: Photo) => void
}

export default function CountryMapView({ photos, onPhotoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markersRef   = useRef<L.Marker[]>([])
  // Keep latest callback without re-creating markers
  const clickRef     = useRef(onPhotoClick)
  clickRef.current   = onPhotoClick

  // ── Init map once ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 2,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('© <a href="https://osm.org/copyright" target="_blank">OSM</a> © CARTO')
      .addTo(map)

    map.setView([20, 0], 2)
    mapRef.current = map

    // Handle container resize (e.g. orientation change on mobile)
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markersRef.current = []
    }
  }, [])

  // ── Update markers when photos change ──────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    if (photos.length === 0) return

    const bounds = L.latLngBounds([])

    photos.forEach(photo => {
      const icon = L.divIcon({
        html: `<div style="
            width:40px;height:40px;border-radius:50%;overflow:hidden;
            border:2px solid rgba(255,255,255,0.9);
            box-shadow:0 0 10px rgba(99,102,241,0.8),0 2px 8px rgba(0,0,0,0.5);
            cursor:pointer;
          ">
          <img src="${photo.thumbnailDataUrl}"
               style="width:100%;height:100%;object-fit:cover;display:block;" />
        </div>`,
        className: '',
        iconSize:   [40, 40],
        iconAnchor: [20, 20],
      })

      const marker = L.marker([photo.lat, photo.lng], { icon })
      marker.on('click', () => clickRef.current(photo))
      marker.addTo(map)
      markersRef.current.push(marker)
      bounds.extend([photo.lat, photo.lng])
    })

    map.fitBounds(bounds, { padding: [70, 70], maxZoom: 10, animate: true })
  }, [photos])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: '#1a1a2e' }}
    />
  )
}
