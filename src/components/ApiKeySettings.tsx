import { Sparkles, Gauge } from 'lucide-react';
import { useI18n } from '../i18n';
import { CupoModelos } from './CupoModelos';
import { PasosClaveIA } from './PasosClaveIA';
import { useHayClaveIA } from '../hooks/useClaveIA';

/**
 * La clave de Google para la IA en Configuración: los tres pasos (`PasosClaveIA`, los mismos que la ventana que se
 * abre sobre cualquier pantalla con «Configurar la IA») y lo que da de sí el plan gratuito.
 */
export function ApiKeySettings() {
  const { t } = useI18n();
  const saved = useHayClaveIA();

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-hd">
        <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Asistente de IA (Google Gemini)')}</div>
        <span className={`ak-status${saved ? ' ok' : ''}`}>{t(saved ? 'Configurada ✓' : 'Sin configurar')}</span>
      </div>

      <p className="ak-intro">
        {t('La IA (situaciones de aprendizaje, fichas, rúbricas, informes…) funciona con una clave')} <strong>{t('gratuita')}</strong>{t(' de Google. Se guarda solo en este equipo y nunca se comparte.')}
      </p>

      <PasosClaveIA />

      <div className="ak-plan">
        <Gauge size={16} color="var(--accent-d)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>{t('¿Cuánto da de sí el plan gratuito?')}</strong>
          <span>
            {t('Las situaciones de aprendizaje usan Gemini 4 Hydrogen y, si se acaba su cupo, Gemini 3.8 Flash. Las demás tareas grandes (fichas, informes, rúbricas y dianas) usan Gemini 3.8 Flash, que da para unas 20 al día, y todo lo demás, Gemini 3.5 Flash-Lite, con unas 500 al día. Si un modelo gasta su cupo, la aplicación sigue sola con el siguiente. El cupo se renueva cada día a las 9:00.')}
          </span>
          {saved && <CupoModelos />}
        </div>
      </div>

    </div>
  );
}
