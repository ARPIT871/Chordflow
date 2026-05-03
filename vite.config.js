import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Repo is served at https://arpit871.github.io/Chordflow/
// so all asset URLs need to be prefixed with /Chordflow/ in production.
export default defineConfig({
  plugins: [react()],
  base: '/Chordflow/',
  server: {
    port: 5173,
    open: true,
  },
})
