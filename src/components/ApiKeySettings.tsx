import { useState } from 'react';
import { Eye, EyeOff, Sparkles, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getApiKey, setApiKey } from '../services/gemini';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';

const GUIDE_STEPS = [
  { title: 'Abre Google AI Studio', body: 'Entra en aistudio.google.com/apikey con tu cuenta de Google (la misma del correo Gmail sirve).' },
  { title: 'Pulsa «Crear clave de API»', body: 'Es un botón azul en la parte superior. Si te pide elegir un proyecto, selecciona «Crear proyecto nuevo».' },
  { title: 'Copia la clave', body: 'Verás un código largo que empieza por «AIza…». Pulsa el icono de copiar.' },
  { title: 'Pégala aquí y guarda', body: 'Pega la clave en el campo de abajo y pulsa «Guardar». Ya puedes usar la IA en cualquier parte de la aplicación.' },
];

/**
 * Tarjeta de configuración de la clave API de Gemini: guía paso a paso y
 * campo con visibilidad conmutable.
 *
 * Sin botón de «Probar conexión»: si la clave falla, se entera en cuanto la
 * use de verdad (rúbrica, informe, chat…), con el mismo mensaje de error
 * legible que ya da cualquier llamada fallida — no hace falta una prueba
 * aparte antes de dejarle usar la aplicación.
 */
export function ApiKeySettings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [key, setKey]           = useState(getApiKey());
  const [visible, setVisible]   = useState(false);
  const [guideOpen, setGuideOpen] = useState(!getApiKey());

  const saved = getApiKey();
  const dirty = key.trim() !== saved;

  function handleSave() {
    setApiKey(key);
    toast(t(key.trim() ? '✅ Clave guardada en este equipo' : 'Clave eliminada'));
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-hd">
        <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Asistente de IA (Google Gemini)')}</div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: saved ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
          color: saved ? '#047857' : '#b45309',
        }}>
          {t(saved ? 'Configurada ✓' : 'Sin configurar')}
        </span>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
        {t('La IA (generar rúbricas, consultas pedagógicas…) funciona con una clave')} <strong>{t('gratuita')}</strong>{t(' de Google. Se guarda solo en este equipo y nunca se comparte.')}
      </p>

      {/* Guía paso a paso plegable */}
      <button
        type="button"
        onClick={() => setGuideOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'var(--font)', fontSize: 12.5, fontWeight: 700,
          color: 'var(--accent-d)', padding: 0, marginBottom: guideOpen ? 12 : 16,
        }}
      >
        {guideOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {t('¿Cómo consigo mi clave gratuita? (2 minutos)')}
      </button>

      {guideOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 18 }}>
          {GUIDE_STEPS.map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-d)', color: 'white', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{t(s.title)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{t(s.body)}</div>
              {i === 0 && (
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--accent-d)', marginTop: 8, textDecoration: 'none' }}
                >
                  {t('Abrir Google AI Studio')} <ExternalLink size={11} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Campo de clave */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <input
            className="finput"
            type={visible ? 'text' : 'password'}
            placeholder={t('Pega aquí tu clave (AIza…)')}
            value={key}
            onChange={e => setKey(e.target.value)}
            style={{ paddingRight: 42 }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="ico-btn"
            onClick={() => setVisible(v => !v)}
            title={t(visible ? 'Ocultar clave' : 'Mostrar clave')}
            style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)' }}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button className="btn-accent" onClick={handleSave} disabled={!dirty} style={{ height: 44 }}>
          {t('Guardar')}
        </button>
      </div>
    </div>
  );
}
