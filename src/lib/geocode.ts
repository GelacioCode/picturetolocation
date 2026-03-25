const cache = new Map<string, { country: string; countryCode: string; city: string }>()
let lastRequestTime = 0

async function rateLimit() {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  if (elapsed < 1200) await new Promise(r => setTimeout(r, 1200 - elapsed))
  lastRequestTime = Date.now()
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  country: string
  countryCode: string
  city: string
}> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  if (cache.has(key)) return cache.get(key)!

  await rateLimit()

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'TravelMapApp/1.0' },
    })
    if (!res.ok) throw new Error('geocode failed')
    const data = await res.json()
    const addr = data.address ?? {}
    const result = {
      country: addr.country ?? 'Unknown',
      countryCode: (addr.country_code ?? '').toUpperCase(),
      city: addr.city ?? addr.town ?? addr.village ?? addr.state ?? '',
    }
    cache.set(key, result)
    return result
  } catch {
    return { country: 'Unknown', countryCode: '', city: '' }
  }
}
