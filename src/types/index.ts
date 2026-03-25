export interface Photo {
  id: string
  thumbnailDataUrl: string  // 60px circle for globe pin
  previewDataUrl: string    // 300px for detail view
  lat: number
  lng: number
  country: string
  countryCode: string       // ISO 2-letter
  city: string
  datetime: string | null   // ISO date string
  year: number | null
  month: number | null
  filename: string
}

export interface OriginCountry {
  name: string
  code: string
  lat: number
  lng: number
}

export interface VisitStats {
  countriesVisited: number
  mostVisitedCountry: string
  mostVisitedVisits: number
  mostVisitedPhotos: number
  originCountry: string
  originCountryCode: string
  originLat: number
  originLng: number
  totalPhotos: number
}

export interface CountryInfo {
  code: string
  name: string
  lat: number
  lng: number
}

export interface ArcData {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  color: string[]
}

export interface ProcessedImage {
  file: File
  previewUrl: string
  lat: number | null
  lng: number | null
  country: string | null
  countryCode: string | null
  city: string | null
  datetime: Date | null
  geocoding: 'pending' | 'done' | 'failed' | 'manual'
}
