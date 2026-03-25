# My Travel Map — Full Project Documentation

> **Who this is for:** Someone who understands what the project does and why, but wants to understand *how* the code works — line by line, concept by concept — well enough to rebuild it from scratch.

---

## Table of Contents

1. [What This Project Does (Big Picture)](#1-what-this-project-does-big-picture)
2. [Tech Stack — What Each Tool Is and Why We Use It](#2-tech-stack)
3. [Project Folder Structure — What Every File Does](#3-folder-structure)
4. [How Data Flows Through the App](#4-how-data-flows)
5. [Core Concepts Explained Simply](#5-core-concepts-explained)
6. [File-by-File Walkthrough](#6-file-by-file-walkthrough)
7. [How Each Feature Works End-to-End](#7-how-each-feature-works)
8. [How to Run, Build, and Deploy](#8-run-build-deploy)
9. [How to Extend or Modify the App](#9-how-to-extend)
10. [Common Problems and Fixes](#10-common-problems)

---

## 1. What This Project Does (Big Picture)

This is a **static website** (no server needed) that lets a person tell the story of where they've been in the world using their own photos.

### The User Journey
```
1. First visit        → App asks: "Where are you from?" (origin country)
2. Upload photos      → App reads GPS data baked into the photos
3. Automatic magic    → App figures out: what country, what city, what date
4. Globe updates      → Visited countries light up green, tiny photo thumbnails pin to the map
5. Cards update       → "You've visited 12 countries, most visits: Japan (3 trips)"
6. Share              → Click a button → animated GIF downloads to your computer
                        (GIF shows the globe with a flying airplane path from home to all destinations)
```

### What Makes It Special
- **100% runs in the browser** — no account, no server, no cloud storage
- **Photos never leave your computer** — GPS data is read locally
- **Persists between visits** — data is saved in your browser's local database
- **Shareable output** — the GIF can be posted anywhere

---

## 2. Tech Stack

Think of these as the building blocks. Each one solves a specific problem.

| Tool | What it is | Why we use it | Alternative |
|------|-----------|---------------|-------------|
| **React** | A JavaScript framework for building UIs | Keeps the UI in sync with data automatically | Vue, plain HTML |
| **TypeScript** | JavaScript but with types | Catches bugs before running the code | Plain JavaScript |
| **Vite** | A build tool | Bundles all files into one deployable website | Create React App, Webpack |
| **Tailwind CSS** | A CSS utility framework | Write styles directly in HTML/JSX without a separate CSS file | Plain CSS, Bootstrap |
| **react-globe.gl** | A 3D globe component | Renders a WebGL globe with countries, pins, and flying arcs | Leaflet, D3 |
| **three.js** | 3D rendering library | react-globe.gl is built on top of this | (required peer dependency) |
| **exifr** | EXIF metadata reader | Extracts GPS coordinates and date from JPG/HEIC files | exif-js |
| **idb** | IndexedDB wrapper | Stores photos and settings in the browser database cleanly | localStorage (too small for images) |
| **gifenc** | GIF encoder | Turns canvas frames into an animated GIF file | gif.js (older, needs web workers) |
| **Nominatim** | Free OpenStreetMap geocoding API | Converts GPS coordinates → country name + city | Google Maps API (costs money) |
| **GitHub Actions** | Automated CI/CD | Builds and deploys the site to GitHub Pages on every push | Manual upload |

---

## 3. Folder Structure

```
Map Project/
│
├── index.html                  ← The one HTML file the browser loads first
├── package.json                ← Lists all dependencies (like a shopping list for npm)
├── vite.config.ts              ← Tells Vite how to build the project
├── tsconfig.json               ← TypeScript settings
├── tailwind.config.js          ← Tailwind CSS settings
├── postcss.config.js           ← Needed for Tailwind to work
├── .gitignore                  ← Tells git which files NOT to upload to GitHub
│
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions: auto-build + deploy on every push
│
├── dist/                       ← [AUTO-GENERATED] Final built website (don't edit)
│
└── src/                        ← All the source code you actually write
    │
    ├── main.tsx                ← Entry point: starts the React app
    ├── App.tsx                 ← Root component: controls all modals and state
    ├── index.css               ← Global CSS styles + Tailwind imports
    │
    ├── types/
    │   ├── index.ts            ← TypeScript data shapes (what a "Photo" looks like)
    │   └── gifenc.d.ts         ← Type declarations for gifenc (it has no built-in types)
    │
    ├── lib/                    ← Pure utility functions (no UI, no React)
    │   ├── db.ts               ← Read/write to IndexedDB
    │   ├── exif.ts             ← Extract GPS + date from images
    │   ├── geocode.ts          ← GPS coordinates → country name
    │   ├── gifExport.ts        ← Capture canvas frames → animated GIF
    │   └── countries.ts        ← Static list of ~195 countries with coordinates
    │
    ├── hooks/
    │   └── usePhotos.ts        ← Central state manager (the brain of the app)
    │
    └── components/             ← UI pieces (each file = one visual element)
        ├── StatsCards.tsx      ← The 3 cards at the top (Countries | Most Visited | Origin)
        ├── GlobeView.tsx       ← The 3D interactive globe
        ├── OriginModal.tsx     ← "Where are you from?" first-time popup
        ├── UploadModal.tsx     ← Photo upload + processing flow
        ├── PhotoDetail.tsx     ← Click a pin → see photo details popup
        └── ShareButton.tsx     ← Button that creates and downloads the GIF
```

---

## 4. How Data Flows Through the App

This is the most important section to understand. Data travels in one direction: **down from parent to child**.

```
┌─────────────────────────────────────────────┐
│                  App.tsx                    │
│  (holds all state: photos, origin, modals)  │
└──────────┬──────────────────────────────────┘
           │ passes data as "props"
    ┌──────┼──────────────────────┐
    ▼      ▼                      ▼
StatsCards  GlobeView         ShareButton
(reads     (reads photos,     (reads stats,
 stats)     renders globe)    origin, dests)
```

### The usePhotos Hook

`usePhotos.ts` is the **central brain**. `App.tsx` calls it once, and gets back everything it needs:

```
const {
  photos,           ← array of all saved photos
  origin,           ← the user's home country
  loading,          ← true while reading from database
  stats,            ← computed: countries visited, most visited, etc.
  visitedCodes,     ← Set of country codes that have photos
  destinationPoints,← average GPS point per country (for GIF arcs)
  addPhotos,        ← function to save new photos
  removePhoto,      ← function to delete a photo
  setOrigin         ← function to save origin country
} = usePhotos()
```

### State vs Props — Simple Explanation

- **State** = data that can change, and when it changes, the screen updates
- **Props** = data passed from a parent component to a child component (read-only for the child)

Example: `App.tsx` has state `photos`. It passes it as a prop to `GlobeView`. When `App` adds a new photo to state, `GlobeView` automatically re-renders with the new pin.

---

## 5. Core Concepts Explained

### What is EXIF Data?

When you take a photo with a phone or camera, the device secretly stores extra information inside the image file. This is called **EXIF metadata**. It includes:

- GPS coordinates (latitude and longitude) — where you were
- Date and time — when you took it
- Camera model, lens, exposure settings

We use the `exifr` library to read this hidden data:

```typescript
// Simplified version of what exifr does
const data = await exifr.parse(imageFile)
// data.latitude = 35.6762     (Tokyo, Japan)
// data.longitude = 139.6503
// data.DateTimeOriginal = "2023-04-15T14:30:00"
```

**Important:** Not all photos have GPS data. iPhone/Android do by default (if location is enabled). DSLR cameras usually don't. That's why the app has a manual country selector as fallback.

---

### What is Reverse Geocoding?

Regular geocoding = "Tokyo, Japan" → coordinates (35.67, 139.65)
**Reverse** geocoding = coordinates (35.67, 139.65) → "Tokyo, Japan"

We send the GPS coordinates to OpenStreetMap's free Nominatim API:

```
Request: GET https://nominatim.openstreetmap.org/reverse?lat=35.67&lon=139.65&format=json
Response: { address: { country: "Japan", country_code: "jp", city: "Tokyo" } }
```

**Rate limiting:** Nominatim allows only 1 request per second. Our code waits 1.2 seconds between each request to be safe. If you upload 5 photos, it takes ~6 seconds to geocode all of them.

---

### What is IndexedDB?

Your browser has a built-in database that websites can use to store data. It's like a tiny SQLite database that lives in your browser.

We use it to store:
1. **Photos** — thumbnail (60px), preview (320px), GPS, country, date, filename
2. **Settings** — the origin country

Why not `localStorage`? Because localStorage has a ~5MB limit and can't store binary data well. IndexedDB supports storing large blobs and has much higher limits (usually hundreds of MB).

We use the `idb` library to make it easier to work with:

```typescript
// Without idb (raw IndexedDB) — verbose and confusing
const request = indexedDB.open('travel-map', 1)
request.onsuccess = (event) => { /* ... */ }

// With idb — clean and async/await friendly
const db = await openDB('travel-map', 1)
const photos = await db.getAll('photos')
```

---

### What is WebGL and Why Does the Globe Need It?

WebGL is a technology that lets browsers use the computer's GPU (graphics card) to render 3D graphics. The globe is a 3D sphere with textures, lighting, and animations — regular HTML/CSS can't do this. WebGL can.

`react-globe.gl` wraps the popular `three.js` library (a WebGL framework) into a React component. We just pass it data and it handles all the complex 3D rendering.

**`preserveDrawingBuffer: true`** — This is a WebGL setting we set on the globe. By default, WebGL clears its canvas after every frame (for performance). We need to read the canvas pixels to make the GIF, so we tell it to keep them: "preserve the drawing buffer."

---

### What is GIF Encoding?

A GIF is a series of images played in sequence, like a flipbook.

Our export process:
1. Start the arc animation on the globe
2. Every 100ms, **take a screenshot** of the WebGL canvas (35 total frames)
3. For each frame, **composite** it: draw a dark background, then draw the stats cards as text, then draw the globe canvas on top
4. After all frames are captured, **encode** them into a GIF file using `gifenc`

**Quantization** — GIF format only supports 256 colors per frame. `gifenc` automatically picks the best 256 colors to represent each frame (`quantize`), then maps every pixel to the closest color in that palette (`applyPalette`).

---

### What is GeoJSON?

GeoJSON is a data format for storing geographic shapes. The world map on the globe comes from a GeoJSON file that contains the borders of every country as a list of coordinate points.

```json
{
  "type": "Feature",
  "properties": {
    "ADMIN": "Japan",
    "ISO_A2": "JP"
  },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [[[139.76, 35.67], [139.80, 35.70], ...]]
  }
}
```

We fetch this file from a CDN when the globe loads, then tell react-globe.gl to color each country based on whether its `ISO_A2` code is in our `visitedCodes` set.

---

### What is a React Hook?

A hook is a function that lets you "hook into" React features like state and lifecycle. Hook names always start with `use`.

Common hooks we use:
- `useState` — creates a variable that, when changed, re-renders the component
- `useEffect` — runs code when the component loads or when a dependency changes
- `useRef` — creates a reference to a DOM element or value that persists without re-rendering
- `useMemo` — caches a computed result, recalculates only when its inputs change
- `useCallback` — caches a function, recreates only when its inputs change
- `useImperativeHandle` — lets a parent component call methods on a child component

---

## 6. File-by-File Walkthrough

### `src/types/index.ts` — The Data Shapes

Before any code runs, we define what shape our data takes. Think of these as "blueprints."

```typescript
// A Photo is an object with exactly these fields:
export interface Photo {
  id: string              // Unique ID like "1712345678-abc123"
  thumbnailDataUrl: string  // A 60px image encoded as a string (base64)
  previewDataUrl: string    // A 320px image encoded as a string
  lat: number             // GPS latitude  e.g. 35.6762
  lng: number             // GPS longitude e.g. 139.6503
  country: string         // "Japan"
  countryCode: string     // "JP"
  city: string            // "Tokyo"
  datetime: string | null // "2023-04-15T14:30:00Z" or null if unknown
  year: number | null     // 2023 or null
  month: number | null    // 4 (April) or null
  filename: string        // "IMG_1234.jpg"
}
```

TypeScript enforces these shapes. If you try to save a Photo without a `countryCode`, TypeScript will show a red error before you even run the code.

---

### `src/lib/db.ts` — The Database Layer

This file is the only place in the entire codebase that talks to IndexedDB. All other files call these functions instead of touching the database directly.

```typescript
// Database setup — runs once when first opened
const db = await openDB('travel-map', 1, {
  upgrade(db) {
    // Create a "photos" table with "id" as the primary key
    const store = db.createObjectStore('photos', { keyPath: 'id' })
    // Create an index so we can query by country code efficiently
    store.createIndex('by-country', 'countryCode')
    // Create a "settings" table for key-value pairs
    db.createObjectStore('settings')
  }
})
```

**The 5 exported functions you need to know:**

| Function | What it does |
|----------|-------------|
| `savePhoto(photo)` | Saves or updates one photo |
| `getAllPhotos()` | Returns all photos as an array |
| `deletePhoto(id)` | Removes one photo by its ID |
| `saveSetting(key, value)` | Saves a setting (e.g., `saveSetting('origin', {name: 'Japan', ...})`) |
| `getSetting(key)` | Reads a setting back |

---

### `src/lib/exif.ts` — Reading Photo Metadata

**`extractExif(file)`** — takes a File object (from file upload), returns GPS and date:

```typescript
const result = await extractExif(myImageFile)
// result = { latitude: 35.67, longitude: 139.65, datetime: Date object }
// OR if no GPS: { latitude: null, longitude: null, datetime: null }
```

**`createThumbnail(file, size=60)`** — creates a square crop of the image at 60px:

```
Original photo: 4000x3000 rectangle
                     ↓
Center-crop to: 3000x3000 square
                     ↓
Scale down to:    60x60 square
                     ↓
Return as:    "data:image/jpeg;base64,/9j/4AAQ..."
```

The "data URL" string is the entire image encoded as text. It can be used directly as an `<img src="...">` without any server.

**`createPreview(file, maxPx=320)`** — same idea but keeps aspect ratio, max 320px on longest side. Used in the detail view modal.

---

### `src/lib/geocode.ts` — GPS Coordinates → Country Name

```typescript
const result = await reverseGeocode(35.67, 139.65)
// result = { country: "Japan", countryCode: "JP", city: "Tokyo" }
```

**Two important mechanisms:**

**Rate limiting** — Nominatim says max 1 request/second. We track `lastRequestTime` and wait if needed:
```typescript
const elapsed = Date.now() - lastRequestTime
if (elapsed < 1200) await new Promise(r => setTimeout(r, 1200 - elapsed))
```

**Caching** — If the same GPS area is looked up twice, we return the stored result immediately without hitting the API again:
```typescript
const key = `${lat.toFixed(2)},${lng.toFixed(2)}`  // e.g. "35.67,139.65"
if (cache.has(key)) return cache.get(key)!          // return immediately
// ... fetch from API ...
cache.set(key, result)                               // store for next time
```

---

### `src/lib/countries.ts` — Static Country Data

A list of all ~195 countries with their ISO 2-letter code, English name, and approximate geographic center (centroid):

```typescript
const RAW: [string, string, number, number][] = [
  // [code,  name,           lat,    lng  ]
  ['JP', 'Japan',           36.20, 138.25],
  ['US', 'United States',   37.09, -95.71],
  ['PH', 'Philippines',     12.88, 121.77],
  // ... 192 more
]
```

This is used for:
1. The origin country dropdown (search from this list)
2. The arc animation — the origin country needs a lat/lng to draw arcs from

Note: Destination arcs use the **average GPS of your actual photos** in each country, not these centroids. Only the origin uses this list since you have no photos there.

---

### `src/lib/gifExport.ts` — Creating the Animated GIF

This is one of the most complex files. Here's the step-by-step process:

**Step 1: Set up a composite canvas (700×440px)**
```
┌────────────────────────────────────────────┐  ← 700px wide
│  [Countries: 12]  [Most: Japan]  [Origin]  │  ← 105px tall (cards)
│                                            │
│               🌍 Globe                    │  ← 335px tall
│         (copied from WebGL canvas)         │
│                                            │
└────────────────────────────────────────────┘  ← 440px tall
```

**Step 2: Capture 35 frames over 3.5 seconds**
```typescript
for (let i = 0; i < 35; i++) {
  await wait(100)                    // wait 100ms between frames = 10fps
  drawBackground(ctx)                // dark gradient
  drawStatsCards(ctx, stats)         // draw 3 card boxes with text
  ctx.drawImage(webglCanvas, ...)    // copy the live globe onto our canvas
  frames.push(getPixelData(ctx))     // save this frame
}
```

**Step 3: Encode all frames into a GIF**
```typescript
const enc = GIFEncoder()
for (const framePixels of frames) {
  const palette = quantize(framePixels, 256)     // find best 256 colors
  const indexed = applyPalette(framePixels, palette)  // map pixels to palette
  enc.writeFrame(indexed, 700, 440, { palette, delay: 100 })
}
enc.finish()
return new Blob([enc.bytes()])  // return as downloadable file
```

---

### `src/hooks/usePhotos.ts` — The Central State

This hook is loaded once in `App.tsx` and provides all data and actions to the entire app.

**On first load:**
```typescript
useEffect(() => {
  // Load from database when the component first mounts
  Promise.all([getAllPhotos(), getSetting('origin')]).then(([photos, origin]) => {
    setPhotos(photos)
    if (origin) setOrigin(origin)
    setLoading(false)
  })
}, [])  // ← empty array = "run this only once, when the component loads"
```

**`visitedCodes` — computed with `useMemo`:**
```typescript
// This recalculates ONLY when the photos array changes
const visitedCodes = useMemo(
  () => new Set(photos.map(p => p.countryCode)),
  [photos]
)
// Result: Set { "JP", "PH", "FR", "US" }
```
This Set is passed to the globe, which colors countries green if their code is in this set.

**Most Visited calculation:**
```typescript
// For each country's photos, count unique "year-month" combinations
// year-month = one trip instance
// Country with most trip instances = most visited

// Photos in Japan: Jan 2022, Jan 2022, Mar 2022, Aug 2023
// Unique year-months: "2022-1", "2022-3", "2023-8" → 3 trips

// Photos in France: Dec 2021
// Unique year-months: "2021-12" → 1 trip

// Most visited: Japan (3 trips)
```

---

### `src/components/GlobeView.tsx` — The 3D Globe

This component wraps `react-globe.gl` and adds custom behavior.

**Key props passed to the Globe:**

| Prop | What it does |
|------|-------------|
| `polygonsData` | The GeoJSON country shapes to draw |
| `polygonCapColor` | Function: given a country feature, return its fill color |
| `htmlElementsData` | Array of photo objects to pin |
| `htmlElement` | Function: given a photo, return an HTML DOM element for the pin |
| `arcsData` | Array of arc objects (start/end lat-lng pairs) |
| `arcDashAnimateTime` | How long one arc animation cycle takes (ms) |
| `rendererConfig` | `{ preserveDrawingBuffer: true }` — needed for GIF capture |

**The `forwardRef` pattern:**
```typescript
// Parent (App.tsx) holds a reference to the globe
const globeRef = useRef<GlobeHandle>(null)

// Child (GlobeView.tsx) exposes methods through that reference
useImperativeHandle(ref, () => ({
  startArcs(origin, dests) { ... },  // App can call this
  stopArcs() { ... },
  getCanvas() { ... },               // Returns the WebGL canvas element
  resetView() { ... },
}))
```
This lets `App.tsx` trigger arc animations and capture the canvas without passing callbacks through props.

**Empty state vs loaded state:**
```typescript
const isEmpty = props.photos.length === 0

// If empty: show the pulsing upload button overlay, disable rotation
// If loaded: show photo pins, color visited countries, enable rotation
```

---

### `src/components/UploadModal.tsx` — Photo Upload Flow

The upload process is sequential because Nominatim has a rate limit:

```
User drops 3 photos
        ↓
For photo 1:
  extractExif(photo1)        → { lat: 35.67, lng: 139.65, datetime: 2023-04-15 }
  reverseGeocode(35.67, 139.65) → { country: "Japan", countryCode: "JP", city: "Tokyo" }
  Update UI: "Tokyo, Japan ✓"
        ↓  (wait 1.2 seconds)
For photo 2:
  extractExif(photo2)        → { lat: null, lng: null, datetime: 2022-08-10 }
  No GPS! → Show country dropdown for this photo
  User selects "France"
        ↓  (no wait needed, no geocoding)
For photo 3:
  extractExif(photo3)        → { lat: 48.85, lng: 2.35, datetime: 2022-08-11 }
  reverseGeocode(48.85, 2.35) → { country: "France", countryCode: "FR", city: "Paris" }
  Update UI: "Paris, France ✓"
        ↓
User clicks "Add 3 Photos"
  createThumbnail(photo1)    → 60px base64 string
  createPreview(photo1)      → 320px base64 string
  Build Photo object
  Save to IndexedDB
  Repeat for photos 2 and 3
  Call onPhotosAdded([photo1, photo2, photo3])
  Close modal
```

---

### `src/components/ShareButton.tsx` — GIF Export Flow

```
User clicks "Share GIF"
        ↓
Call globeRef.current.startArcs(origin, destinations)
  → Arc animation begins on globe
  → Globe points of view moves to show origin country
        ↓
Wait 200ms for animation to start
        ↓
Call globeRef.current.getCanvas()
  → Returns the WebGL <canvas> DOM element
        ↓
Call exportTravelGIF(canvas, stats, onProgress)
  → Runs for 3.5 seconds capturing 35 frames
  → Shows progress bar: 0% → 100%
        ↓
GIF Blob returned
  → Create temporary download URL
  → Trigger browser download: "my-travel-map.gif"
  → Clean up URL
        ↓
Call globeRef.current.stopArcs()
Call globeRef.current.resetView()
Reset to idle state
```

---

### `src/App.tsx` — The Root Component

`App.tsx` is the orchestrator. It doesn't do any computation — it just:
1. Gets all data from `usePhotos()`
2. Manages which modals are open (`showUpload`, `showOrigin`)
3. Passes data down to all child components
4. Passes callback functions down so children can trigger actions

```typescript
// Everything the app needs comes from this one hook call
const { photos, origin, loading, stats, visitedCodes, destinationPoints,
        addPhotos, removePhoto, setOrigin } = usePhotos()

// App decides WHAT to show
if (loading) return <LoadingScreen />

return (
  <div>
    <Header />
    <StatsCards stats={stats} onUploadClick={() => setShowUpload(true)} />
    <GlobeView
      ref={globeRef}
      photos={photos}           // ← passes data down
      onUploadClick={...}       // ← passes action down
      onPhotoClick={...}        // ← passes action down
    />

    {/* Conditionally render modals */}
    {!origin && <OriginModal onConfirm={setOrigin} />}
    {showUpload && <UploadModal onPhotosAdded={addPhotos} />}
    {selectedPhoto && <PhotoDetail photo={selectedPhoto} onDelete={removePhoto} />}
  </div>
)
```

---

## 7. How Each Feature Works End-to-End

### Feature: First-Time Origin Setup

```
1. App loads → usePhotos() checks IndexedDB for saved origin
2. Nothing found → origin = null
3. App.tsx sees (!origin) is true → renders <OriginModal>
4. User types "Phil..." → filters COUNTRIES list to show Philippines
5. User clicks Philippines → selected = { name: "Philippines", code: "PH", lat: 12.88, lng: 121.77 }
6. User clicks "Set as My Origin" → calls onConfirm(selected)
7. App.tsx → calls setOrigin(selected) from usePhotos hook
8. usePhotos → calls saveSetting('origin', selected) → saved to IndexedDB
9. usePhotos → updates origin state variable
10. App.tsx re-renders → (!origin) is now false → OriginModal disappears
11. Next time app loads → step 1 finds the saved origin → skip modal entirely
```

### Feature: Uploading a Photo

See `UploadModal.tsx` walkthrough above.

### Feature: Globe Coloring Visited Countries

```
1. User adds photos from Japan and France
2. usePhotos computes visitedCodes = Set {"JP", "FR"}
3. App passes visitedCodes to GlobeView as prop
4. GlobeView passes it to react-globe.gl as:
   polygonCapColor={(countryFeature) => {
     const code = countryFeature.properties.ISO_A2  // e.g. "JP"
     return visitedCodes.has(code)
       ? 'rgba(74, 222, 128, 0.65)'  // bright green
       : 'rgba(18, 26, 58, 0.45)'    // dark blue
   }}
5. Globe re-renders, Japan and France glow green
```

### Feature: Most Visited Calculation

```
Photos:
  - Tokyo, Japan    (2022-04)
  - Kyoto, Japan    (2022-04)  ← same month as Tokyo = same trip
  - Osaka, Japan    (2023-08)  ← different year-month = new trip
  - Paris, France   (2021-12)

Group by country:
  Japan:  [2022-04, 2022-04, 2023-08] → unique year-months: {"2022-4", "2023-8"} = 2 trips
  France: [2021-12]                   → unique year-months: {"2021-12"}           = 1 trip

Winner: Japan (2 trips, 3 photos)
Display: "Most Visited: Japan • 2 trips"
```

### Feature: GIF Export

See `gifExport.ts` and `ShareButton.tsx` walkthroughs above.

---

## 8. Run, Build, and Deploy

### Run Locally

```bash
# 1. Open terminal in the project folder
cd "Map Project"

# 2. Install dependencies (only needed once after cloning)
npm install

# 3. Start development server
npm run dev

# 4. Open browser to http://localhost:5173
```

The dev server watches files and refreshes the browser automatically when you save changes.

### Build for Production

```bash
npm run build
```

This creates the `dist/` folder with:
- `dist/index.html` — the single HTML page
- `dist/assets/index-XXXXX.js` — all JavaScript bundled into one file (~2MB)
- `dist/assets/index-XXXXX.css` — all CSS bundled into one file

### Deploy to GitHub Pages

**One-time setup:**
1. Push the project to a GitHub repository
2. Go to **Settings → Pages → Source → GitHub Actions**

**Every subsequent push:**
The `.github/workflows/deploy.yml` automatically:
1. Installs dependencies (`npm ci`)
2. Builds the project (`npm run build`)
3. Uploads the `dist/` folder to GitHub Pages

Your site will be live at: `https://yourusername.github.io/repo-name/`

**Important:** If your repo name is not at the root (e.g., `github.io/picturetolocation`), update `vite.config.ts`:
```typescript
base: '/picturetolocation/',  // ← change this to your repo name
```

---

## 9. How to Extend or Modify

### Change the globe colors

In `src/components/GlobeView.tsx`, find `polygonCapColor`:
```typescript
// Visited countries color (currently green)
return visited.has(code) ? 'rgba(74, 222, 128, 0.65)' : 'rgba(18, 26, 58, 0.45)'
//                          ↑ change this color          ↑ change unvisited color
```

### Change the arc (airplane path) color

In `src/components/GlobeView.tsx`, find the `startArcs` function:
```typescript
color: ['rgba(245, 158, 11, 0.9)', 'rgba(245, 158, 11, 0.1)']
//       ↑ bright end of arc        ↑ faded end of arc
```

### Add a new stat card

1. Add a new computed value in `src/hooks/usePhotos.ts` inside the `useMemo` that computes `stats`
2. Add the field to `VisitStats` interface in `src/types/index.ts`
3. Add a new `<Card>` in `src/components/StatsCards.tsx`

### Change the GIF size or duration

In `src/lib/gifExport.ts`:
```typescript
const GIF_W = 700       // ← width in pixels
const GIF_H = 440       // ← height in pixels
const FPS = 10          // ← frames per second
const DURATION_MS = 3500  // ← total duration in milliseconds
// FRAME_COUNT is auto-calculated from FPS and DURATION_MS
```

Note: More frames = bigger file + longer encoding time.

### Upgrade storage to Firebase (future improvement)

Currently, all data is stored locally in IndexedDB — it only exists in your browser. To make data persistent across devices, replace the functions in `src/lib/db.ts` with Firebase Firestore calls. The rest of the app doesn't need to change because all other files call db.ts functions — they don't directly touch the database.

---

## 10. Common Problems and Fixes

### "Globe doesn't appear"

- Check browser console for errors (F12 → Console tab)
- Usually caused by WebGL not being supported in the browser
- Try Chrome or Edge (best WebGL support)
- On some machines, hardware acceleration needs to be enabled in browser settings

### "Photos aren't getting GPS location"

- iPhone: Make sure **Location Services** is enabled for the Camera app
- DSLR/Mirrorless cameras: Most don't have GPS — the manual country selector is the fallback
- Screenshots from Google Maps: These have GPS, but it might be the map center, not your actual location

### "Geocoding is very slow"

- This is expected — Nominatim allows 1 request/second
- 10 photos = ~12 seconds to geocode all of them
- The progress shows each photo being resolved one by one

### "GIF export is slow or crashes"

- Encoding 35 frames at 700×440px is CPU-intensive
- On slower devices, reduce `FRAME_COUNT` or `GIF_W/GIF_H` in `gifExport.ts`
- The browser tab may be unresponsive during encoding (5-30 seconds) — this is normal

### "GitHub Pages shows old version"

- GitHub Pages can take 1-3 minutes to update after a successful Action run
- Make sure the Action completed successfully (green checkmark in Actions tab)
- Hard-refresh the browser: `Ctrl + Shift + R`

### "Deploy fails with 404 error"

- GitHub Pages hasn't been enabled
- Go to repo **Settings → Pages → Source → GitHub Actions** → Save

### "node_modules showing in GitHub repo"

- This was fixed by the `.gitignore` file and running `git rm -r --cached node_modules`
- If it happens again, run those same commands and push again

---

## Glossary

| Term | Simple meaning |
|------|---------------|
| **Component** | A reusable piece of UI (like a button, card, or modal) |
| **Props** | Data passed from a parent component to a child |
| **State** | Data that, when changed, causes the UI to update |
| **Hook** | A function that plugs into React's state and lifecycle system |
| **EXIF** | Hidden metadata inside photo files (GPS, date, camera info) |
| **Base64** | A way to encode binary data (like an image) as a text string |
| **Data URL** | An image embedded directly in a string: `data:image/jpeg;base64,...` |
| **IndexedDB** | A built-in browser database for storing structured data |
| **Blob** | A raw binary data object (like a file, but in memory) |
| **GeoJSON** | A JSON format for storing geographic shapes (country borders) |
| **WebGL** | Browser technology for rendering 3D graphics using the GPU |
| **Reverse geocoding** | Converting GPS coordinates to a human-readable address |
| **Rate limiting** | Deliberately slowing down API requests to stay within allowed limits |
| **Centroid** | The geographic center point of a country |
| **ISO 3166-1 alpha-2** | The standard 2-letter country codes (JP, US, PH, FR...) |
| **Quantization** | Reducing the number of colors in an image (required for GIF format) |
| **Vite** | A tool that bundles source code into deployable files |
| **TypeScript** | JavaScript with type-checking — catches bugs before running |
| **Tailwind CSS** | Write CSS as class names: `text-white`, `bg-indigo-600`, `rounded-xl` |
| **forwardRef** | React pattern for letting a parent call methods on a child component |
| **useMemo** | Cache a computed value, recalculate only when inputs change |
| **CDN** | Content Delivery Network — serves files from fast servers worldwide |

---

*Documentation written for the `picturetolocation` project — a GitHub Pages travel map that visualizes your photos on a 3D globe.*
