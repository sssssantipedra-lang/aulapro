import { useState } from 'react';
import { Eye, EyeOff, Sparkles, CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getApiKey, setApiKey, testApiKey } from '../services/gemini';
import { useToast } from './ui/Toast';

const GUIDE_STEPS = [
  { title: 'Abre Google AI Studio', body: 'Entra en aistudio.google.com/apikey con tu cuenta de Google (la misma del correo Gmail sirve).' },
  { title: 'Pulsa «Crear clave de API»', body: 'Es un botón azul en la parte superior. Si te pide elegir un proyecto, selecciona «Crear proyecto nuevo».' },
  { title: 'Copia la clave', body: 'Verás un código largo que empieza por «AIza…». Pulsa el icono de copiar.' },
  { title: 'Pégala aquí y prueba', body: 'Pega la clave en el campo de abajo, pulsa «Guardar» y luego «Probar conexión» para confirmar que funciona.' },
];

/**
 * Tarjeta de configuración de la clave API de Gemini:
 * guía paso a paso, campo con visibilidad conmutable y prueba de conexión.
 */
export function ApiKeySettings() {
  const { toast } = useToast();
  const [key, setKey]           = useState(getApiKey());
  const [visible, setVisible]   = useState(false);
  const [guideOpen, setGuideOpen] = useState(!getApiKey());
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const saved = getApiKey();
  const dirty = key.trim() !== saved;

  function handleSave() {
    setApiKey(key);
    setTestResult(null);
    toast(key.trim() ? '✅ Clave guardada en este equipo' : 'Clave eliminada');
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const res = await testApiKey(key);
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, msg: `Conexión correcta (modelo ${res.model})` });
      if (dirty) { setApiKey(key); toast('✅ Clave verificada y guardada'); }
    } else {
      setTestResult({ ok: false, msg: res.error ?? 'No se pudo conectar.' });
    }
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-hd">
        <div className="card-ttl"><Sparkles size={14} color="var(--accent-d)" />Asistente de IA (Google Gemini)</div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: saved ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
          color: saved ? '#047857' : '#b45309',
        }}>
          {saved ? 'Configurada ✓' : 'Sin configurar'}
        </span>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 14 }}>
        La IA (generar rúbricas, consultas pedagógicas…) funciona con una clave <strong>gratuita</strong> de
        Google. Se guarda solo en este equipo y nunca se comparte.
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
        ¿Cómo consigo mi clave gratuita? (2 minutos)
      </button>

      {guideOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 18 }}>
          {GUIDE_STEPS.map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 14px', border: '0.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-d)', color: 'white', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{s.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>{s.body}</div>
              {i === 0 && (
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--accent-d)', marginTop: 8, textDecoration: 'none' }}
                >
                  Abrir Google AI Studio <ExternalLink size={11} />
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
            placeholder="Pega aquí tu clave (AIza…)"
            value={key}
            onChange={e => { setKey(e.target.value); setTestResult(null); }}
            style={{ paddingRight: 42 }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="ico-btn"
            onClick={() => setVisible(v => !v)}
            title={visible ? 'Ocultar clave' : 'Mostrar clave'}
            style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)' }}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button className="btn-accent" onClick={handleSave} disabled={!dirty} style={{ height: 44 }}>
          Guardar
        </button>
        <button className="btn-ghost" onClick={handleTest} disabled={testing || !key.trim()} style={{ height: 44 }}>
          {testing ? <><span className="spin" />&nbsp;Probando…</> : 'Probar conexión'}
        </button>
      </div>

      {testResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
          padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: testResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
          color: testResult.ok ? '#047857' : '#dc2626',
        }}>
          {testResult.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {testResult.msg}
        </div>
      )}
    </div>
  );
}
