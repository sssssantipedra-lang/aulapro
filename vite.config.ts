import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Rutas relativas: necesarias para que Electron cargue la app con file://
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
