import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAllPhotos, savePhoto, deletePhoto, getSetting, saveSetting } from '../lib/db'
import type { Photo, OriginCountry, VisitStats } from '../types'

export function usePhotos() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [origin, setOriginState] = useState<OriginCountry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getAllPhotos(), getSetting<OriginCountry>('origin')]).then(
      ([storedPhotos, storedOrigin]) => {
        setPhotos(storedPhotos)
        if (storedOrigin) setOriginState(storedOrigin)
        setLoading(false)
      },
    )
  }, [])

  const addPhotos = useCallback(async (incoming: Photo[]) => {
    for (const p of incoming) await savePhoto(p)
    setPhotos(prev => [...prev, ...incoming])
  }, [])

  const removePhoto = useCallback(async (id: string) => {
    await deletePhoto(id)
    setPhotos(prev => prev.filter(p => p.id !== id))
  }, [])

  const setOrigin = useCallback(async (o: OriginCountry) => {
    await saveSetting('origin', o)
    setOriginState(o)
  }, [])

  const visitedCodes = useMemo(
    () => new Set(photos.map(p => p.countryCode).filter(Boolean)),
    [photos],
  )

  // Destination centroids: average lat/lng per country
  const destinationPoints = useMemo(() => {
    const map = new Map<string, { lats: number[]; lngs: number[]; country: string }>()
    for (const p of photos) {
      if (!p.countryCode) continue
      if (!map.has(p.countryCode)) map.set(p.countryCode, { lats: [], lngs: [], country: p.country })
      map.get(p.countryCode)!.lats.push(p.lat)
      map.get(p.countryCode)!.lngs.push(p.lng)
    }
    return Array.from(map.entries()).map(([code, v]) => ({
      code,
      country: v.country,
      lat: v.lats.reduce((a, b) => a + b, 0) / v.lats.length,
      lng: v.lngs.reduce((a, b) => a + b, 0) / v.lngs.length,
    }))
  }, [photos])

  const stats: VisitStats | null = useMemo(() => {
    if (!origin) return null

    // Group photos by country
    const byCountry = new Map<string, Photo[]>()
    for (const p of photos) {
      if (!byCountry.has(p.countryCode)) byCountry.set(p.countryCode, [])
      byCountry.get(p.countryCode)!.push(p)
    }

    // Most visited: most unique year-month trips
    let mostCountry = ''
    let mostVisits = 0
    let mostPhotos = 0

    for (const [, cPhotos] of byCountry) {
      const trips = new Set<string>()
      for (const p of cPhotos) {
        if (p.year && p.month) trips.add(`${p.year}-${p.month}`)
        else if (p.year) trips.add(`${p.year}`)
        else trips.add(`nodate-${p.id}`)
      }
      const tripCount = trips.size
      if (
        tripCount > mostVisits ||
        (tripCount === mostVisits && cPhotos.length > mostPhotos)
      ) {
        mostVisits = tripCount
        mostPhotos = cPhotos.length
        mostCountry = cPhotos[0].country
      }
    }

    return {
      countriesVisited: byCountry.size,
      mostVisitedCountry: mostCountry,
      mostVisitedVisits: mostVisits,
      mostVisitedPhotos: mostPhotos,
      originCountry: origin.name,
      originCountryCode: origin.code,
      originLat: origin.lat,
      originLng: origin.lng,
      totalPhotos: photos.length,
    }
  }, [photos, origin])

  return { photos, origin, loading, stats, visitedCodes, destinationPoints, addPhotos, removePhoto, setOrigin }
}
