import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

export default defineConfig({
  // Rutas relativas: necesarias para que Electron cargue la app con file://
  base: './',
  // Para poder mostrar la versión en la interfaz (Sidebar) sin depender de
  // Electron: así funciona igual empaquetada, en `npm run dev` y en web.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
