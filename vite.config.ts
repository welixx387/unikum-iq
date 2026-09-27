import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — чтобы собранный сайт открывался из любой папки и любого хостинга.
export default defineConfig({
  base: './',
  plugins: [react()],
})
