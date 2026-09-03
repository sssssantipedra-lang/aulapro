/**
 * Asistente de ayuda de la aplicación: el botón redondo de la esquina inferior
 * derecha, disponible en todas las pantallas.
 *
 * Responde a «¿cómo hago…?» sobre la propia aplicación, leyendo el manual de
 * `services/appHelp.ts`. NO ve los datos del docente —ni sus clases ni sus
 * notas—: para eso está la pestaña «Consulta IA» del Cuaderno, y a ella manda
 * a quien pregunte por sus alumnos.
 *
 * Si no hay clave API, lo primero que sale al abrirlo es la pantalla para
 * ponerla, con su enlace y su «Ahora no»: la clave hace falta para que esto
 * funcione, pero ponerla es decisión del docente, no un peaje obligatorio para
 * seguir usando la aplicación.
 */

import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, X, Send, Sparkles, ExternalLink, ArrowRight, Trash2 } from 'lucide-react';
import { callGemini, hasApiKey, setApiKey, type ChatTurn } from '../services/gemini';
import { helpSystemPrompt, splitJump, targetLabel } from '../services/appHelp';
import { RichText } from './ui/RichText';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';

interface HelpMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Pantalla a la que lleva la respuesta, si la IA propuso una. */
  target?: string;
}

/** Turnos que se reenvían como memoria. Ver el mismo tope en el Cuaderno. */
const MEMORY_TURNS = 10;

interface Props {
  /** Sección abierta ahora mismo, para dar contexto a la respuesta. */
  section: string;
  onNav: (s: string) => void;
}

export function HelpChat({ section, onNav }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState(hasApiKey());
  const [keyDraft, setKeyDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  /**
   * Al abrir se vuelve a mirar si hay clave: puede haberse puesto en Mi Perfil
   * mientras el panel estaba cerrado. Se hace aquí, al pulsar, y no en un
   * efecto sobre `open`, que provocaría un render de más en cada apertura.
   */
  function alternar() {
    const abrir = !open;
    if (abrir) setHasKey(hasApiKey());
    setOpen(abrir);
  }

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open]);

  const sectionLabel = targetLabel(section, lang);

  async function ask(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;

    const history: ChatTurn[] = messages.slice(-MEMORY_TURNS).map(m => ({ role: m.role, text: m.text }));
    const afterUser: HelpMessage[] = [...messages, { id: crypto.randomUUID(), role: 'user', text }];
    setMessages(afterUser);
    setQuestion('');

    const answer = await callGemini(
      helpSystemPrompt(lang, sectionLabel),
      text,
      [],
      { onStart: () => setLoading(true), onEnd: () => setLoading(false), onError: msg => toast(msg) },
      {
        history,
        maxOutputTokens: 2048,
        // No hay nada que razonar: la respuesta está en el manual que va en el
        // propio prompt. Lo que se le pide es localizarla y resumirla, y para
        // una duda de «¿dónde está tal botón?» lo que se agradece es que
        // conteste ya.
        thinkingLevel: 'minimal',
      },
    );
    if (answer === null) return;

    const { text: clean, target } = splitJump(answer);
    setMessages([...afterUser, { id: crypto.randomUUID(), role: 'model', text: clean, target }]);
  }

  function guardarClave() {
    const k = keyDraft.trim();
    if (!k) { toast(t('Pega la clave antes de guardar')); return; }
    setApiKey(k);
    setKeyDraft('');
    setHasKey(true);
    toast(t('✅ Clave guardada en este equipo'));
  }

  const sugerencias = [
    t('¿Por dónde empiezo?'),
    t('¿Cómo pongo las notas?'),
    t('¿Cómo hago copia de seguridad?'),
  ];

  return (
    <>
      <button
        className="help-fab"
        onClick={alternar}
        title={t('Ayuda de Aula Pro')}
        aria-label={t('Ayuda de Aula Pro')}
        aria-expanded={open}
        type="button"
      >
        {open ? <X size={22} /> : <MessageCircleQuestion size={23} />}
      </button>

      {open && (
        <div className="help-panel" role="dialog" aria-label={t('Ayuda de Aula Pro')}>
          <div className="help-hd">
            <div className="help-ttl">
              <Sparkles size={15} />
              {t('Ayuda de Aula Pro')}
            </div>
            {hasKey && messages.length > 0 && (
              <button className="help-ico" onClick={() => setMessages([])} title={t('Nueva conversación')} type="button">
                <Trash2 size={14} />
              </button>
            )}
            <button className="help-ico" onClick={() => setOpen(false)} title={t('Cerrar')} type="button">
              <X size={16} />
            </button>
          </div>

          {!hasKey ? (
            /* ── Puerta de la clave API ── */
            <div className="help-body" style={{ justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', padding: '4px 2px 14px' }}>
                <Sparkles size={26} color="var(--accent-d)" style={{ opacity: 0.55 }} />
                <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', margin: '10px 0 6px' }}>
                  {t('Para poder responderte hace falta una clave')}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0, lineHeight: 1.6 }}>
                  {t('Es gratuita, de Google, y se guarda solo en este ordenador. Se consigue en un par de minutos.')}
                </p>
              </div>

              <a
                className="btn-ghost"
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ justifyContent: 'center', gap: 7, fontSize: 12.5, textDecoration: 'none', marginBottom: 10 }}
              >
                {t('Conseguir mi clave gratuita')} <ExternalLink size={12} />
              </a>

              <input
                className="finput"
                type="password"
                placeholder={t('Pega aquí tu clave (AIza…)')}
                value={keyDraft}
                onChange={e => setKeyDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') guardarClave(); }}
                autoComplete="off"
                spellCheck={false}
                style={{ marginBottom: 10 }}
              />
              <button className="btn-accent" style={{ justifyContent: 'center' }} onClick={guardarClave} type="button">
                {t('Guardar y empezar')}
              </button>

              <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="help-link"
                  onClick={() => { onNav('profile'); setOpen(false); }}
                  type="button"
                >
                  {t('Ver la guía paso a paso')}
                </button>
                <span style={{ color: 'var(--text-3)' }}>·</span>
                <button className="help-link" onClick={() => setOpen(false)} type="button">
                  {t('Ahora no')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="help-body">
                {messages.length === 0 && !loading && (
                  <div style={{ margin: 'auto 0', textAlign: 'center', padding: '10px 4px' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 4px', fontWeight: 600 }}>
                      {t('¿Qué necesitas saber?')}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 14px', lineHeight: 1.55 }}>
                      {t('Pregúntame cómo funciona cualquier parte de Aula Pro.')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {sugerencias.map(s => (
                        <button key={s} className="help-chip" onClick={() => ask(s)} type="button">{s}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(m => (
                  <div key={m.id} className={m.role === 'user' ? 'help-msg-user' : 'help-msg-ai'}>
                    {m.role === 'user' ? m.text : <RichText text={m.text} />}
                    {m.target && (
                      <button
                        className="help-goto"
                        onClick={() => { onNav(m.target as string); setOpen(false); }}
                        type="button"
                      >
                        {t('Ir a {seccion}', { seccion: targetLabel(m.target, lang) })}
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                ))}

                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--text-2)', fontSize: 12.5 }}>
                    <span className="spin" /><span className="ia-generating">{t('Buscando…')}</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="help-foot">
                <input
                  className="finput"
                  placeholder={t('Escribe tu duda…')}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
                />
                <button
                  className="btn-accent"
                  onClick={() => ask(question)}
                  disabled={loading}
                  title={t('Enviar')}
                  aria-label={t('Enviar')}
                  type="button"
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
