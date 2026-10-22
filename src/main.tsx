import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { initApiKey } from './services/gemini'
import { codeFromShareUrl } from './services/p2p'
import { requestShareCode } from './lib/shareNav'
import { applyAppearance, getAppearance } from './lib/utils'
import { restaurarTamanoLetra } from './lib/tamanoLetra'

// Antes de pintar nada, para que el modo oscuro no parpadee en blanco al abrir
applyAppearance(getAppearance())

/**
 * En Android, lo primero es montar el puente con la parte nativa (el mismo
 * contrato que Electron en el escritorio): guardado, PDF y la clave cifrada.
 */
async function nativeBridge() {
  // Capacitor inyecta `window.Capacitor` antes de cargar la página: así se sabe
  // sin cargar su código en el escritorio, donde no hace falta.
  const cap = (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  if (cap?.getPlatform?.() !== 'android') return
  const { installAndroidBridge } = await import('./platform/android')
  installAndroidBridge()

  // Un enlace aulapro://c/XXXXXX abre la app y la lleva a «Trabajo compartido»
  // con el código ya puesto, listo para unirse como invitado.
  const { App: CapApp } = await import('@capacitor/app')
  CapApp.addListener('appUrlOpen', ({ url }) => {
    const code = codeFromShareUrl(url)
    if (!code) return
    requestShareCode(code)
    window.dispatchEvent(new CustomEvent('aulapro:open-share'))
  })
}

// La clave de la IA está cifrada en disco: se descifra una vez antes de pintar.
// El tamaño de letra elegido se pone cuando ya está el puente nativo (en Android, el zoom de texto)
nativeBridge().then(restaurarTamanoLetra).then(initApiKey).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider><App /></I18nProvider>
    </StrictMode>,
  )
})
