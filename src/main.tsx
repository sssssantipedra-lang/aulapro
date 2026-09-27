import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'
import { initApiKey } from './services/gemini'
import { applyAppearance, getAppearance } from './lib/utils'

// Antes de pintar nada, para que el modo oscuro no parpadee en blanco al abrir
applyAppearance(getAppearance())

// La clave de la IA está cifrada en disco: se descifra una vez antes de pintar.
initApiKey().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider><App /></I18nProvider>
    </StrictMode>,
  )
})
