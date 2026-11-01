import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'crypto'
import { copyFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))
const WEB_APP = fileURLToPath(new URL('./web/app/', import.meta.url))

/**
 * Versión web (`npm run build:web`, aulapro.app/app/): lo que la hace
 * instalable y usable sin conexión. Añade a la página el manifiesto y los
 * iconos, y al terminar escribe el service worker (`web/app/sw.js`) con la
 * lista de todo lo compilado, para guardarlo entero en el dispositivo.
 */
/**
 * Lo que necesita la pantalla de entrada antes de tener licencia, además de lo que carga la página: el puente
 * web (`main.tsx` lo importa aparte) y lo que este importa al entrar con Google o Microsoft. Lo demás del
 * código solo sale de /app/assets/ con sesión (`web/funciones/api/_puerta.js`).
 */
const ANTES_DE_LA_LICENCIA = /src[\\/]platform[\\/](web|carpetaWeb|cuentaWeb|googleDrive|microsoft)\.ts$/

function appWeb(): Plugin {
  let salida = ''
  let publicos: string[] = []
  return {
    name: 'aulapro-app-web',
    apply: 'build',
    configResolved(c) { salida = c.build.outDir },
    generateBundle(_opts, bundle) {
      // Los bloques que carga la página al abrir (sus importaciones fijas) y los que se piden antes de la licencia
      const chunks = Object.values(bundle).filter(b => b.type === 'chunk')
      const porNombre = new Map(chunks.map(c => [c.fileName, c]))
      const vistos = new Set<string>()
      const pendientes = chunks.filter(c => c.isEntry || (c.facadeModuleId && ANTES_DE_LA_LICENCIA.test(c.facadeModuleId))).map(c => c.fileName)
      while (pendientes.length) {
        const f = pendientes.pop()!
        if (vistos.has(f)) continue
        vistos.add(f)
        for (const i of porNombre.get(f)?.imports ?? []) pendientes.push(i)
      }
      publicos = [...vistos].filter(f => /\.m?js$/.test(f)).sort()
    },
    transformIndexHtml(html) {
      return html.replace('</head>', [
        '<link rel="manifest" href="./manifest.webmanifest" />',
        '<link rel="icon" type="image/svg+xml" href="./favicon-mini.svg" />',
        '<link rel="apple-touch-icon" href="./icono-180.png" />',
        '<meta name="apple-mobile-web-app-capable" content="yes" />',
        '<meta name="mobile-web-app-capable" content="yes" />',
        '<meta name="apple-mobile-web-app-title" content="AulaPro" />',
        '</head>',
      ].join('\n    '))
    },
    closeBundle() {
      for (const f of ['icono-180.png', 'icono-192.png', 'icono-512.png', 'icono-mascara-512.png']) copyFileSync(join(WEB_APP, f), join(salida, f))
      writeFileSync(join(salida, 'manifest.webmanifest'), JSON.stringify({
        id: '/app/',
        name: 'AulaPro',
        short_name: 'AulaPro',
        description: 'Cuaderno docente para Primaria y Secundaria',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f1e9',
        theme_color: '#0c2340',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icono-mascara-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      }, null, 2))
      writeFileSync(join(salida, 'version.json'), JSON.stringify({ version: pkg.version }))
      // Para la puerta de /app/assets/ (web/app/publico.mjs la copia a web/funciones/_publico.js al publicar)
      writeFileSync(join(salida, 'publico.json'), JSON.stringify(publicos))

      const todos: string[] = []
      const recorrer = (dir: string) => {
        for (const n of readdirSync(dir)) {
          const ruta = join(dir, n)
          if (statSync(ruta).isDirectory()) recorrer(ruta)
          else todos.push(relative(salida, ruta).split('\\').join('/'))
        }
      }
      recorrer(salida)
      // La página va como './': Cloudflare redirige index.html a la carpeta (ver web/app/sw.js)
      const todo = todos.filter(f => !['sw.js', 'version.json', 'publico.json'].includes(f) && !f.endsWith('.map'))
        .map(f => (f === 'index.html' ? './' : f)).sort()
      // Lo imprescindible se instala antes de activar; los dibujos, los pictogramas y el lector de PDF, después (ver web/app/sw.js)
      const esExtra = (f: string) => f.startsWith('ilustraciones/') || f.startsWith('pictos/') || /pdf\.worker/.test(f)
      // El código que pide sesión va aparte: sin suscripción no se guarda en el dispositivo (ver web/app/sw.js)
      const conSesion = (f: string) => /^assets\/.+\.m?js$/.test(f) && !publicos.includes(f)
      const lista = todo.filter(f => !esExtra(f) && !conSesion(f))
      const privado = todo.filter(f => !esExtra(f) && conSesion(f))
      const extra = todo.filter(esExtra)
      // El nombre de la caché cambia con cualquier cambio de contenido: una versión no se mezcla con otra
      const huella = createHash('sha256')
      for (const f of todo) huella.update(f).update(readFileSync(join(salida, f === './' ? 'index.html' : f)))
      const sw = readFileSync(join(WEB_APP, 'sw.js'), 'utf8')
        .replace("'__CACHE__'", `'aulapro-${pkg.version}-${huella.digest('hex').slice(0, 10)}'`)
        .replace('= __PRECARGA__;', `= ${JSON.stringify(lista)};`)
        .replace('= __PRIVADO__;', `= ${JSON.stringify(privado)};`)
        .replace('= __EXTRA__;', `= ${JSON.stringify(extra)};`)
      writeFileSync(join(salida, 'sw.js'), sw)
    },
  }
}

export default defineConfig(({ mode }) => ({
  // Rutas relativas: necesarias para que Electron cargue la app con file://
  base: './',
  // Para poder mostrar la versión en la interfaz (Sidebar) sin depender de
  // Electron: así funciona igual empaquetada, en `npm run dev` y en web.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Cuándo se compiló: Configuración › Licencia lo enseña para saber qué versión abre el navegador (la nueva entra a la segunda apertura)
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'web' ? [appWeb()] : []),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Bloques aparte para lo que pesa y casi nunca cambia: así ninguno
        // pasa de 500 KB y una actualización no obliga a recargar React ni el
        // currículo oficial (cientos de KB de JSON) si no han cambiado.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'iconos', test: /node_modules[\\/]lucide-react[\\/]/ },
            { name: 'curriculo-primaria', test: /src[\\/]lib[\\/]curriculum[\\/]data[\\/]primaria\.json/ },
            { name: 'curriculo-eso', test: /src[\\/]lib[\\/]curriculum[\\/]data[\\/]eso\.json/ },
          ],
        },
      },
    },
  },
  server: {
    // Versión web en desarrollo (`vite --mode web`): la licencia va a Lemon
    // Squeezy como en aulapro.app, donde la pasa web/funciones/
    proxy: {
      '/api/licencia': {
        target: 'https://api.lemonsqueezy.com',
        changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/api\/licencia/, '/v1/licenses'),
      },
    },
    // Respeta PORT si viene del entorno; si no, Vite usa su puerto de siempre.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    watch: {
      // `release/` son los instaladores compilados, cientos de MB. Sin esto,
      // empaquetar con el servidor de desarrollo abierto lo mete en un bucle
      // de recargas que lo deja inservible.
      // `android/` lleva una copia de la web compilada (npx cap sync).
      ignored: ['**/release/**', '**/dist/**', '**/dist-web/**', '**/android/**'],
    },
  },
}))
