import * as exifr from 'exifr'

export interface ExifResult {
  latitude: number | null
  longitude: number | null
  datetime: Date | null
}

export async function extractExif(file: File): Promise<ExifResult> {
  try {
    const data = await exifr.parse(file, {
      gps: true, tiff: true, exif: true, xmp: true, iptc: false, icc: false,
    })
    if (!data) return { latitude: null, longitude: null, datetime: null }

    // Standard exifr GPS fields
    let latitude: number | null  = typeof data.latitude  === 'number' ? data.latitude  : null
    let longitude: number | null = typeof data.longitude === 'number' ? data.longitude : null

    // Some Xiaomi / Android devices write raw GPS IFD fields instead
    if (latitude == null && data.GPSLatitude != null && data.GPSLatitudeRef != null) {
      const [d, m, s] = Array.isArray(data.GPSLatitude) ? data.GPSLatitude : [data.GPSLatitude, 0, 0]
      let v = (d as number) + (m as number) / 60 + (s as number) / 3600
      if (data.GPSLatitudeRef === 'S') v = -v
      latitude = v
    }
    if (longitude == null && data.GPSLongitude != null && data.GPSLongitudeRef != null) {
      const [d, m, s] = Array.isArray(data.GPSLongitude) ? data.GPSLongitude : [data.GPSLongitude, 0, 0]
      let v = (d as number) + (m as number) / 60 + (s as number) / 3600
      if (data.GPSLongitudeRef === 'W') v = -v
      longitude = v
    }

    let datetime: Date | null = null
    const raw = data.DateTimeOriginal ?? data.CreateDate ?? data.DateTime
    if (raw) {
      const d = new Date(raw)
      if (!isNaN(d.getTime())) datetime = d
    }

    return { latitude, longitude, datetime }
  } catch {
    return { latitude: null, longitude: null, datetime: null }
  }
}

export async function createThumbnail(file: File, size = 60): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!

      // Crop to square center
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}

export async function createPreview(file: File, maxPx = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')) }
    img.src = url
  })
}
