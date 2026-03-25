import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying to https://<username>.github.io/<repo-name>/
// change base to '/<repo-name>/'
// If deploying to https://<username>.github.io/ leave as './'
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // Suppress expected large chunk warning for Three.js/globe.gl
    chunkSizeWarningLimit: 3000,
  },
})
