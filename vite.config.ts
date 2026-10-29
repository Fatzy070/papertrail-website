import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { writerPaginationZoom } from './build/writer-pagination-zoom.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [writerPaginationZoom(), react(), tailwindcss()],
})
