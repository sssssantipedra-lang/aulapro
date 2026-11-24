import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, ClipboardPaste, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getApiKey, setApiKey } from '../services/gemini';
import { looksLikeKey } from '../lib/apiKey';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { usoIaAceptado, aceptarUsoIa } from '../lib/usoIA';
import { AceptarUsoIA, PanelUsoIA } from './AceptarUsoIA';
import { useHayClaveIA } from '../hooks/useClaveIA';

const AI_STUDIO_URL = 'https://aistudio.google.com/apikey';

type Check = { state: 'idle' | 'checking' | 'ok' | 'bad'; msg?: string };

/**
 * Comprueba la clave pidiendo la lista de modelos: no gasta nada del cupo de
 * generación y dice al instante si la clave vale.
 */
async function testKey(key: string): Promise<Check> {
  try {
    // La clave va en la cabecera, que sirve para todos los formatos de clave de Google
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
    if (res.ok) return { state: 'ok' };
    if (res.status === 400 || res.status === 401 || res.status === 403) return { state: 'bad', msg: 'Google no acepta esta clave. Cópiala de nuevo desde AI Studio.' };
    return { state: 'bad', msg: 'Google no responde ahora mismo. La clave se ha guardado; vuelve a probar en un rato.' };
  } catch {
    return { state: 'bad', msg: 'Sin conexión a internet. La clave se ha guardado; se probará al usarla.' };
  }
}

/**
 * La clave de Google para la IA, en tres pasos: abrir AI Studio, crear la clave y pegarla aquí con un botón. Al
 * guardarla se prueba sola. Son los mismos pasos en Configuración (`ApiKeySettings`) y en la ventana que se abre
 * sobre cualquier pantalla (`VentanaClaveIA`, 20-11-2026): por eso viven aparte.
 *
 * Sin aceptar el uso de la IA (`AceptarUsoIA`) no se consigue ni se guarda la clave, se abra desde donde se abra.
 * `onLista` avisa de que la clave se ha guardado y Google la ha aceptado.
 */
export function PasosClaveIA({ onLista }: { onLista?: () => void }) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [key, setKey] = useState(getApiKey());
  const [visible, setVisible] = useState(false);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [showManual, setShowManual] = useState(false);
  const [aceptado, setAceptado] = useState(usoIaAceptado());
  const [pregunta, setPregunta] = useState<null | (() => void)>(null);   // el recuadro de aceptar, con lo que se hace al aceptar
  const [panel, setPanel] = useState(false);
  // Sin aceptar el uso de la IA no se consigue ni se guarda la clave: sale el recuadro y, al aceptar, sigue lo que se iba a hacer
  const conAceptacion = (accion: () => void) => {
    if (aceptado) { accion(); return; }
    setPregunta(() => accion);
  };
  const aceptar = () => { aceptarUsoIa(); setAceptado(true); const seguir = pregunta; setPregunta(null); seguir?.(); };

  const hayClave = useHayClaveIA();
  const saved = hayClave ? getApiKey() : '';
  const dirty = key.trim() !== saved;

  async function save(k: string) {
    const v = k.trim();
    setKey(v);
    setApiKey(v);
    if (!v) { setCheck({ state: 'idle' }); toast(t('Clave eliminada')); return; }
    setCheck({ state: 'checking' });
    const r = await testKey(v);
    setCheck(r);
    toast(t(r.state === 'ok' ? '✅ Clave guardada: la IA ya funciona' : '✅ Clave guardada en este equipo'));
    if (r.state === 'ok') onLista?.();
  }

  async function pasteKey() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!looksLikeKey(text)) {
        setShowManual(true);
        setCheck({ state: 'bad', msg: 'Lo que tienes copiado no parece una clave de Google. Vuelve a copiarla en AI Studio o pégala abajo.' });
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
      // El tropiezo más probable: la cuenta del centro, que a menudo no deja crear claves
      nota: 'Si entras con la cuenta de tu centro y no te deja crear la clave, usa una cuenta personal de Google: no tiene que ser la misma con la que entras en AulaPro.',
      action: (
        <a href={AI_STUDIO_URL} target="_blank" rel="noreferrer" className="btn-accent ak-btn"
          onClick={e => { if (!aceptado) { e.preventDefault(); conAceptacion(() => window.open(AI_STUDIO_URL, '_blank', 'noopener,noreferrer')); } }}>
          {t('Abrir AI Studio')} <ExternalLink size={13} />
        </a>
      ),
    },
    {
      title: 'Crea y copia la clave',
      body: 'Pulsa el botón azul «Create API key» (o «Crear clave de API»). Si te pregunta por un proyecto, acepta el que propone. Después pulsa el icono de copiar junto a la clave.',
    },
    {
      title: 'Vuelve aquí y pégala',
      body: 'Un clic y listo: la aplicación la guarda y comprueba que funciona.',
      action: (
        <button type="button" className="btn-accent ak-btn" onClick={() => conAceptacion(pasteKey)} disabled={check.state === 'checking'}>
          {check.state === 'checking' ? <span className="spin" /> : <ClipboardPaste size={14} />}{t('Pegar mi clave')}
        </button>
      ),
    },
  ];

  return (
    <>
      {!saved || check.state === 'bad' ? (
        <ol className="ak-steps">
          {steps.map((s, i) => (
            <li key={i} className="ak-step">
              <span className="ak-n">{i + 1}</span>
              <div className="ak-body">
                <strong>{t(s.title)}</strong>
                <span>{t(s.body)}</span>
                {s.nota && <span className="ak-centro">{t(s.nota)}</span>}
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

      {aceptado && (
        <button type="button" className="ak-link" onClick={() => setPanel(true)}>{t('Cómo trata AulaPro lo que envías a la IA')}</button>
      )}
      <AceptarUsoIA open={pregunta !== null} onClose={() => setPregunta(null)} onAceptar={aceptar} />
      <PanelUsoIA open={panel} onClose={() => setPanel(false)} />

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
              placeholder={t('Pega aquí tu clave')}
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
          <button className="btn-accent" onClick={() => conAceptacion(() => save(key))} disabled={!dirty || check.state === 'checking'} style={{ height: 44 }}>
            {t('Guardar')}
          </button>
        </div>
      )}
    </>
  );
}
