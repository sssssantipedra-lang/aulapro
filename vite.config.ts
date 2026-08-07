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
  server: {
    // Respeta PORT si viene del entorno; si no, Vite usa su puerto de siempre.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    watch: {
      // `release/` son los instaladores compilados, cientos de MB. Sin esto,
      // empaquetar con el servidor de desarrollo abierto lo mete en un bucle
      // de recargas que lo deja inservible.
      ignored: ['**/release/**', '**/dist/**'],
    },
  },
})
