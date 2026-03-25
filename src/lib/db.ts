import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Photo, OriginCountry } from '../types'

interface TravelMapDB extends DBSchema {
  photos: {
    key: string
    value: Photo
    indexes: { 'by-country': string }
  }
  settings: {
    key: string
    value: OriginCountry | string | number
  }
}

const DB_NAME = 'travel-map'
const DB_VERSION = 1

let _db: IDBPDatabase<TravelMapDB> | null = null

async function getDB(): Promise<IDBPDatabase<TravelMapDB>> {
  if (_db) return _db
  _db = await openDB<TravelMapDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('photos', { keyPath: 'id' })
      store.createIndex('by-country', 'countryCode')
      db.createObjectStore('settings')
    },
  })
  return _db
}

export async function savePhoto(photo: Photo): Promise<void> {
  const db = await getDB()
  await db.put('photos', photo)
}

export async function getAllPhotos(): Promise<Photo[]> {
  const db = await getDB()
  return db.getAll('photos')
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('photos', id)
}

export async function clearAllPhotos(): Promise<void> {
  const db = await getDB()
  await db.clear('photos')
}

export async function saveSetting(key: string, value: OriginCountry | string | number): Promise<void> {
  const db = await getDB()
  await db.put('settings', value, key)
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  return db.get('settings', key) as Promise<T | undefined>
}
