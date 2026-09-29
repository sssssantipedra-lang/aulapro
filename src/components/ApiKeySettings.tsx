import { useState } from 'react';
import { Eye, EyeOff, Sparkles, ExternalLink, ShieldCheck, ClipboardPaste, CheckCircle2, AlertTriangle, Gauge } from 'lucide-react';
import { getApiKey, setApiKey, mainModelPausedUntil } from '../services/gemini';
import { looksLikeKey } from '../lib/apiKey';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

type Check = { state: 'idle' | 'checking' | 'ok' | 'bad'; msg?: string };

/**
 * Comprueba la clave pidiendo la lista de modelos: no gasta nada del cupo de
 * generación y dice al instante si la clave vale.
 */
async function testKey(key: string): Promise<Check> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`);
    if (res.ok) return { state: 'ok' };
    if (res.status === 400 || res.status === 403) return { state: 'bad', msg: 'Google no acepta esta clave. Cópiala de nuevo desde AI Studio.' };
    return { state: 'bad', msg: 'Google no responde ahora mismo. La clave se ha guardado; vuelve a probar en un rato.' };
  } catch {
    return { state: 'bad', msg: 'Sin conexión a internet. La clave se ha guardado; se probará al usarla.' };
  }
}

/**
 * La clave de Google para la IA, en tres pasos: abrir AI Studio, crear la
 * clave y pegarla aquí con un botón. Al guardarla se prueba sola.
 */
export function ApiKeySettings() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [key, setKey] = useState(getApiKey());
  const [visible, setVisible] = useState(false);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [showManual, setShowManual] = useState(false);

  const saved = getApiKey();
  const dirty = key.trim() !== saved;
  const paused = mainModelPausedUntil();

  async function save(k: string) {
    const v = k.trim();
    setKey(v);
    setApiKey(v);
    if (!v) { setCheck({ state: 'idle' }); toast(t('Clave eliminada')); return; }
    setCheck({ state: 'checking' });
    const r = await testKey(v);
    setCheck(r);
    toast(t(r.state === 'ok' ? '✅ Clave guardada: la IA ya funciona' : '✅ Clave guardada en este equipo'));
  }

  async function pasteKey() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!looksLikeKey(text)) {
        setShowManual(true);
        setCheck({ state: 'bad', msg: 'Lo que tienes copiado no parece una clave (empiezan por «AIza»). Vuelve a copiarla en AI Studio o pégala abajo.' });
        return;
      }
      await save(text);
    } catch {
      // Sin permiso para leer el portapapeles: que la pegue a mano
      setShowManual(true);
    }
  }

  const steps = [
    {
      title: 'Abre Google AI Studio',
      body: 'Entra con tu cuenta de Google (la del Gmail sirve). Es gratis y no pide tarjeta.',
      action: (
        <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer" className="btn-accent ak-btn">
          {t('Abrir AI Studio')} <ExternalLink size={13} />
        </a>
      ),
    },
    {
      title: 'Crea y copia la clave',
      body: 'Pulsa el botón azul «Create API key» (o «Crear clave de API»). Si te pregunta por un proyecto, acepta el que propone. Después pulsa el icono de copiar junto a la clave, que empieza por «AIza…».',
    },
    {
      title: 'Vuelve aquí y pégala',
      body: 'Un clic y listo: la aplicación la guarda y comprueba que funciona.',
      action: (
        <button type="button" className="btn-accent ak-btn" onClick={pasteKey} disabled={check.state === 'checking'}>
          {check.state === 'checking' ? <span className="spin" /> : <ClipboardPaste size={14} />}{t('Pegar mi clave')}
        </button>
      ),
    },
  ];

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-hd">
        <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />{t('Asistente de IA (Google Gemini)')}</div>
        <span className={`ak-status${saved ? ' ok' : ''}`}>{t(saved ? 'Configurada ✓' : 'Sin configurar')}</span>
      </div>

      <p className="ak-intro">
        {t('La IA (situaciones de aprendizaje, fichas, rúbricas, informes…) funciona con una clave')} <strong>{t('gratuita')}</strong>{t(' de Google. Se guarda solo en este equipo y nunca se comparte.')}
      </p>

      {!saved || check.state === 'bad' ? (
        <ol className="ak-steps">
          {steps.map((s, i) => (
            <li key={i} className="ak-step">
              <span className="ak-n">{i + 1}</span>
              <div className="ak-body">
                <strong>{t(s.title)}</strong>
                <span>{t(s.body)}</span>
                {s.action}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="ak-ok">
          <CheckCircle2 size={18} color="var(--ok)" />
          <span>{t('La IA está lista para usar en toda la aplicación.')}</span>
        </div>
      )}

      {check.state === 'bad' && check.msg && (
        <div className="ak-warn" role="alert"><AlertTriangle size={15} />{t(check.msg)}</div>
      )}

      <button type="button" className="ak-link" onClick={() => setShowManual(v => !v)} aria-expanded={showManual}>
        {t(saved ? 'Cambiar o quitar la clave' : 'Prefiero escribirla a mano')}
      </button>

      {showManual && (
        <div className="ak-manual">
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <input
              className="finput"
              type={visible ? 'text' : 'password'}
              placeholder={t('Pega aquí tu clave (AIza…)')}
              aria-label={t('Clave de Google')}
              value={key}
              onChange={e => { setKey(e.target.value); setCheck({ state: 'idle' }); }}
              style={{ paddingRight: 42 }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button" className="ico-btn"
              onClick={() => setVisible(v => !v)}
              title={t(visible ? 'Ocultar clave' : 'Mostrar clave')}
              aria-label={t(visible ? 'Ocultar clave' : 'Mostrar clave')}
              style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)' }}
            >
              {visible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <button className="btn-accent" onClick={() => save(key)} disabled={!dirty || check.state === 'checking'} style={{ height: 44 }}>
            {t('Guardar')}
          </button>
          {key.trim() !== '' && !looksLikeKey(key) && (
            <span className="ak-hint">{t('Las claves de Google empiezan por «AIza» y tienen 39 caracteres. Revisa que la has copiado entera.')}</span>
          )}
        </div>
      )}

      <div className="ak-plan">
        <Gauge size={16} color="var(--accent-d)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>{t('¿Cuánto da de sí el plan gratuito?')}</strong>
          <span>
            {t('Las tareas grandes (situaciones de aprendizaje, fichas, informes, rúbricas y dianas) usan Gemini 3.8 Flash, el mejor, que da para unas 20 al día. Todo lo demás usa Gemini 3.5 Flash-Lite, con unas 500 al día. Si un día se gastan las 20, la aplicación sigue sola con Flash-Lite. El cupo se renueva cada día a las 9:00.')}
          </span>
          {paused && (
            <span className="ak-paused">
              {t('Hoy ya se han gastado las del modelo grande: hasta las {h} las tareas grandes usan Flash-Lite.', {
                h: new Date(paused).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              })}
            </span>
          )}
        </div>
      </div>

      <p className="ak-privacy">
        <ShieldCheck size={15} color="var(--ok)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>{t('Los nombres de tu alumnado nunca salen de este equipo: antes de enviar nada a Google se cambian por códigos, y al recibir la respuesta se vuelven a poner. Solo se envían tal cual los archivos que adjuntes tú.')}</span>
      </p>
    </div>
  );
}
