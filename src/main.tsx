import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { initApiKey } from './services/gemini'
import { applyAppearance, getAppearance } from './lib/utils'
import { restaurarTamanoLetra } from './lib/tamanoLetra'
import { AvisoPestanaPerdida, PestanaOcupada } from './components/PestanaOcupada'
import { tomarPestana } from './platform/unaPestana'

// Antes de pintar nada, para que el modo oscuro no parpadee en blanco al abrir
applyAppearance(getAppearance())

/**
 * En Android y en la versión web, lo primero es montar el puente con la parte
 * nativa (el mismo contrato que Electron en el escritorio): guardado, PDF y la
 * clave cifrada. En la web devuelve `false` si AulaPro ya está abierta en otra
 * pestaña (`platform/unaPestana.ts`): entonces no se monta nada.
 */
async function nativeBridge(opts: { pestanaReservada?: boolean } = {}): Promise<boolean> {
  // La versión web (aulapro.app/app/): solo en su compilación, `vite build --mode web`
  if (import.meta.env.MODE === 'web') {
    const { installWebBridge } = await import('./platform/web')
    return installWebBridge(opts)
  }
  // Capacitor inyecta `window.Capacitor` antes de cargar la página: así se sabe
  // sin cargar su código en el escritorio, donde no hace falta.
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  if (cap?.getPlatform?.() !== 'android') return true
  const { installAndroidBridge } = await import('./platform/android')
  installAndroidBridge()
  return true
}

let root: Root | null = null
const raiz = () => (root ??= createRoot(document.getElementById('root')!))

// La clave de la IA está cifrada en disco: se descifra una vez antes de pintar.
// El tamaño de letra elegido se pone cuando ya está el puente nativo (en Android, el zoom de texto)
async function arrancar(opts: { pestanaReservada?: boolean } = {}) {
  let libre = true
  try {
    libre = await nativeBridge(opts)
    if (libre) { await restaurarTamanoLetra(); await initApiKey() }
  } catch { /* la app se abre igual, como antes */ }
  if (!libre) {
    // Otra pestaña tiene AulaPro: aquí no se monta nada hasta que se pida «Usar aquí»
    raiz().render(
      <StrictMode>
        <I18nProvider><PestanaOcupada onUsarAqui={() => { void tomarPestana().then(() => arrancar({ pestanaReservada: true })) }} /></I18nProvider>
      </StrictMode>,
    )
    return
  }
  raiz().render(
    <StrictMode>
      <I18nProvider>
        <App />
        {/* En la web, si otra pestaña se queda la app, esta lo dice encima de cualquier pantalla */}
        {import.meta.env.MODE === 'web' && <AvisoPestanaPerdida />}
      </I18nProvider>
    </StrictMode>,
  )
}

void arrancar()
