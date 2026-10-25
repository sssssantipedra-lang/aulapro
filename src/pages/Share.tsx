import { useMemo, useRef, useState } from 'react';
import {
  Users2, Copy, Check, Send, Inbox, ShieldCheck, AlertTriangle, KeyRound, RefreshCw, FileLock2, FolderOpen,
} from 'lucide-react';
import type { Class } from '../types';
import {
  buildBundle, bundleCounts,
  type MergeMode, type ShareScope, type SharedBundle, type SyncSource,
} from '../services/paquete';
import {
  cifrarCopia, descifrarCopia, esCopiaCifrada, generarContrasena, contrasenaValida,
  normalizarContrasena, CopiaError, LARGO_MINIMO_CONTRASENA, type ContenidoCompartido,
} from '../services/copiaCifrada';
import { DetalleEnvio } from '../components/compartir/DetalleEnvio';
import { downloadFile } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';
import { isoDate } from '../lib/utils';
import { useToast } from '../components/ui/toastContext';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  /** Lo propio, con la forma de un paquete: de aquí sale lo que se envía. */
  source: SyncSource;
  userName: string;
  /** Mezcla en los datos propios lo que ha enviado otro docente. */
  onImport: (bundle: SharedBundle, modo: MergeMode) => { clases: number; alumnos: number; evaluaciones: number };
}

const SIN_CLASES: ShareScope = { classIds: [], grades: true, rubrics: true, evaluations: true };

/** Un número con su etiqueta, para las vistas previas de lo que se envía y de lo que llega. */
function Recuento({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{valor}</div>
      <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginTop: 2 }}>{etiqueta}</div>
    </div>
  );
}

function Recuentos({ paquete }: { paquete: SharedBundle }) {
  const { t } = useI18n();
  const c = bundleCounts(paquete);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(96px,1fr))', gap: 8 }}>
      <Recuento etiqueta={t('Clases')} valor={c.classes} />
      <Recuento etiqueta={t('Alumnos')} valor={c.students} />
      <Recuento etiqueta={t('Calificaciones')} valor={c.grades} />
      <Recuento etiqueta={t('Rúbricas y dianas')} valor={c.rubrics} />
      <Recuento etiqueta={t('Evaluaciones')} valor={c.evaluations} />
    </div>
  );
}

const textoError = (e: unknown, t: (k: string) => string): string => {
  const codigo = e instanceof CopiaError ? e.codigo : null;
  switch (codigo) {
    case 'contrasena': return t('La contraseña no es correcta, o el archivo se ha modificado. Comprueba que la has escrito igual que te la dieron.');
    case 'version': return t('Este archivo lo ha creado una versión más nueva de AulaPro. Actualiza la aplicación y vuelve a abrirlo.');
    case 'sin-cripto': return t('Este equipo no permite abrir archivos cifrados.');
    case 'paquete': return t('El archivo se ha abierto, pero no contiene datos de AulaPro que se puedan importar.');
    default: return t('Este archivo no es una copia cifrada de AulaPro, o está dañado.');
  }
};

export function Share({ classes, source, userName, onImport }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();

  /* ── Enviar ── */
  const [scope, setScope] = useState<ShareScope>(SIN_CLASES);
  const [contrasena, setContrasena] = useState(() => generarContrasena());
  const [propia, setPropia] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [creando, setCreando] = useState(false);
  const [creado, setCreado] = useState<string | null>(null);

  const paquete = useMemo(() => buildBundle(source, scope), [source, scope]);
  const nadaElegido = scope.classIds.length === 0;
  const contrasenaOk = contrasenaValida(contrasena);

  function alternarClase(id: string) {
    setCreado(null);
    setScope(s => ({
      ...s,
      classIds: s.classIds.includes(id) ? s.classIds.filter(x => x !== id) : [...s.classIds, id],
    }));
  }

  function otraContrasena() {
    setContrasena(generarContrasena());
    setPropia(false);
    setCreado(null);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(normalizarContrasena(contrasena));
      setCopiada(true);
      setTimeout(() => setCopiada(false), 2000);
    } catch {
      toast(t('No se pudo copiar. Apúntala o díctala.'));
    }
  }

  async function crear() {
    setCreando(true);
    try {
      const contenido: ContenidoCompartido = { de: userName, creado: new Date().toISOString(), paquete };
      const texto = await cifrarCopia(contenido, contrasena);
      const blob = new Blob([texto], { type: 'application/json' });
      await downloadFile(blob, `aulapro-compartido-${isoDate()}.json`, CARPETAS.copias);
      setCreado(normalizarContrasena(contrasena));
      toast(t('✅ Archivo cifrado creado'));
    } catch (e) {
      toast(textoError(e, t));
    } finally {
      setCreando(false);
    }
  }

  /* ── Recibir ── */
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ nombre: string; texto: string } | null>(null);
  const [claveRecibida, setClaveRecibida] = useState('');
  const [abriendo, setAbriendo] = useState(false);
  const [abierto, setAbierto] = useState<ContenidoCompartido | null>(null);
  const [modo, setModo] = useState<MergeMode>('conservar');
  const [error, setError] = useState('');

  function reiniciarRecepcion() {
    setArchivo(null); setClaveRecibida(''); setAbierto(null); setModo('conservar'); setError('');
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    reiniciarRecepcion();
    const texto = await f.text();
    if (!esCopiaCifrada(texto)) {
      setError(t('Este archivo no es una copia cifrada de AulaPro, o está dañado. Si es una copia de seguridad tuya, se importa desde Mi Perfil.'));
      return;
    }
    setArchivo({ nombre: f.name, texto });
  }

  async function abrir() {
    if (!archivo) return;
    setAbriendo(true);
    setError('');
    try {
      setAbierto(await descifrarCopia(archivo.texto, claveRecibida));
    } catch (e) {
      setError(textoError(e, t));
    } finally {
      setAbriendo(false);
    }
  }

  function importar() {
    if (!abierto) return;
    const r = onImport(abierto.paquete, modo);
    toast(t('✅ Datos importados: {c} clases nuevas, {a} alumnos nuevos', { c: r.clases, a: r.alumnos }));
    reiniciarRecepcion();
  }

  const fechaCreado = abierto
    ? new Date(abierto.creado).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Compartir con otro docente')}</h1>
          <p className="pg-sub">{t('Un archivo cifrado con contraseña: lo envías por el medio que quieras y solo se abre con ella')}</p>
        </div>
      </div>

      <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Enviar ── */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Send size={16} color="var(--accent-d)" />{t('Enviar a otro docente')}</div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
              {t('Eliges las clases y lo que se comparte, y la app crea un archivo cifrado. Se lo mandas a tu compañero/a y, por otro medio, la contraseña.')}
            </p>

            {classes.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {t('Todavía no tienes clases que compartir. Crea una en «Mis Clases».')}
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {classes.map(c => {
                    const on = scope.classIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => alternarClase(c.id)}
                        aria-pressed={on}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 15px',
                          background: on ? c.color : 'var(--card)',
                          color: on ? 'white' : 'var(--text-2)',
                          border: `1.5px solid ${on ? c.color : 'var(--border)'}`,
                          borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font)',
                          fontSize: 13, fontWeight: on ? 700 : 500, transition: 'all 0.18s',
                        }}
                      >
                        {on && <Check size={13} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    { key: 'grades' as const,      label: t('Cuaderno de notas'), desc: t('Categorías, columnas y calificaciones') },
                    { key: 'rubrics' as const,     label: t('Rúbricas y dianas'), desc: t('Las que se usan en las clases elegidas') },
                    { key: 'evaluations' as const, label: t('Evaluaciones'),      desc: t('Los resultados ya guardados') },
                  ]).map(row => (
                    <label
                      key={row.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={scope[row.key]}
                        onChange={e => { setCreado(null); setScope(s => ({ ...s, [row.key]: e.target.checked })); }}
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-d)', width: 16, height: 16, flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.label}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)' }}>{row.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <DetalleEnvio source={source} scope={scope} onChange={s => { setCreado(null); setScope(s); }} />

                {!nadaElegido && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('Lo que va en el archivo')}</div>
                    <Recuentos paquete={paquete} />
                  </div>
                )}

                {/* Contraseña */}
                <div style={{ marginTop: 16, padding: '14px 14px 12px', borderRadius: 12, background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                    <KeyRound size={14} color="var(--accent-d)" />{t('Contraseña del archivo')}
                  </div>
                  {propia ? (
                    <>
                      <label className="flabel" htmlFor="share-pass">{t('Escribe una contraseña')}</label>
                      <input
                        id="share-pass" className="finput" value={contrasena} spellCheck={false} autoComplete="off"
                        onChange={e => { setContrasena(e.target.value); setCreado(null); }}
                        style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                      />
                      <p style={{ fontSize: 11.5, margin: '6px 0 0', color: contrasenaOk ? 'var(--text-3)' : 'var(--danger)' }}>
                        {t('Mínimo {n} caracteres. Mejor una frase larga que una palabra.', { n: LARGO_MINIMO_CONTRASENA })}
                      </p>
                    </>
                  ) : (
                    <div style={{
                      display: 'inline-block', padding: '10px 18px', borderRadius: 12,
                      background: 'var(--accent-l)', border: '1.5px solid rgba(var(--accent-rgb),0.35)',
                      fontSize: 22, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--accent-d)',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    }}>
                      {contrasena}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={copiar} disabled={!contrasenaOk}>
                      {copiada ? <><Check size={13} />{t('Copiada')}</> : <><Copy size={13} />{t('Copiar contraseña')}</>}
                    </button>
                    {!propia ? (
                      <>
                        <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={otraContrasena}>
                          <RefreshCw size={13} />{t('Otra')}
                        </button>
                        <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => { setPropia(true); setContrasena(''); setCreado(null); }}>
                          {t('Escribir la mía')}
                        </button>
                      </>
                    ) : (
                      <button className="btn-ghost" style={{ fontSize: 12.5 }} onClick={otraContrasena}>
                        {t('Usar una generada')}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  className="btn-accent"
                  style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
                  disabled={nadaElegido || !contrasenaOk || creando}
                  onClick={crear}
                >
                  {creando ? <><span className="spin" />{t('Cifrando…')}</> : <><FileLock2 size={14} />{t('Crear archivo cifrado')}</>}
                </button>

                {creado && (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '0.5px solid rgba(16,185,129,0.35)', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--text)' }}>{t('Archivo creado.')}</strong>{' '}
                    {t('Mándalo a tu compañero/a y dile la contraseña por otro medio, por ejemplo por teléfono:')}{' '}
                    <strong style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: 'var(--text)' }}>{creado}</strong>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Recibir ── */}
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Inbox size={16} color="var(--accent-d)" />{t('Recibir de otro docente')}</div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
              {t('Abres el archivo que te han mandado, escribes la contraseña y ves qué trae antes de importarlo. No se borra nada de lo que ya tienes.')}
            </p>

            <input ref={entrada} type="file" accept=".json,application/json" onChange={elegirArchivo} style={{ display: 'none' }} />

            {!archivo && !abierto && (
              <button className="btn-accent" style={{ width: '100%', justifyContent: 'center' }} onClick={() => entrada.current?.click()}>
                <FolderOpen size={14} />{t('Elegir el archivo recibido')}
              </button>
            )}

            {archivo && !abierto && (
              <div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
                  <FileLock2 size={13} style={{ verticalAlign: '-2px', marginRight: 5 }} />{archivo.nombre}
                </div>
                <label className="flabel" htmlFor="share-recibida">{t('Contraseña que te han dado')}</label>
                <input
                  id="share-recibida" className="finput" value={claveRecibida} spellCheck={false} autoComplete="off" autoFocus
                  onChange={e => { setClaveRecibida(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter' && claveRecibida.trim() && !abriendo) void abrir(); }}
                  placeholder="ABCD-EFGH-JKMN-PQRS"
                  style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} disabled={!claveRecibida.trim() || abriendo} onClick={abrir}>
                    {abriendo ? <><span className="spin" />{t('Abriendo…')}</> : t('Abrir')}
                  </button>
                  <button className="btn-ghost" onClick={reiniciarRecepcion}>{t('Cancelar')}</button>
                </div>
              </div>
            )}

            {abierto && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>
                  {t('De {name}', { name: abierto.de || t('un compañero/a') })}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 12px' }}>
                  {t('Creado el {fecha}', { fecha: fechaCreado })}
                </div>
                {abierto.paquete.classes.length > 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 10 }}>
                    {abierto.paquete.classes.map(c => c.name).join(', ')}
                  </div>
                )}
                <Recuentos paquete={abierto.paquete} />

                <div role="radiogroup" aria-label={t('Si algo ya existe')} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                  {([
                    { v: 'conservar' as const,  titulo: t('Conservar lo mío'),     desc: t('Entra lo que no tengo. Si algo ya existe, se queda como estaba.') },
                    { v: 'actualizar' as const, titulo: t('Actualizar con esto'),  desc: t('Entra lo que no tengo. Si algo ya existe, se sustituye por lo que llega.') },
                  ]).map(o => (
                    <label key={o.v} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', alignItems: 'flex-start' }}>
                      <input type="radio" name="modo-importar" checked={modo === o.v} onChange={() => setModo(o.v)} style={{ marginTop: 3, accentColor: 'var(--accent-d)' }} />
                      <span>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{o.titulo}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)' }}>{o.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={importar}>
                    <Inbox size={14} />{t('Importar')}
                  </button>
                  <button className="btn-ghost" onClick={reiniciarRecepcion}>{t('Cancelar')}</button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, padding: '11px 14px', borderRadius: 9, background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.3)', fontSize: 12.5, color: '#dc2626', lineHeight: 1.5 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral explicativo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><Users2 size={14} color="var(--accent-d)" />{t('Cómo funciona')}</div>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <li>{t('Quien envía elige las clases y lo que comparte, y crea el archivo cifrado.')}</li>
              <li>{t('Lo manda por correo, WhatsApp, Drive o como quiera, y la contraseña por otro medio.')}</li>
              <li>{t('Quien recibe abre el archivo con la contraseña, ve qué trae y decide si lo importa.')}</li>
            </ol>
          </div>

          <div className="card">
            <div className="card-hd">
              <div className="card-ttl"><ShieldCheck size={14} color="var(--ok)" />{t('Privacidad')}</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
              <li>{t('El archivo va cifrado de extremo a extremo: sin la contraseña no se puede leer, ni siquiera teniéndolo.')}</li>
              <li>{t('La contraseña no se guarda ni se envía a ningún sitio. Pásala por un medio distinto al del archivo.')}</li>
              <li>{t('Solo AulaPro sabe abrirlo, pero la seguridad está en la contraseña: quien tenga el archivo y la contraseña podría leerlo con otra herramienta.')}</li>
              <li>{t('Nunca se comparte tu perfil ni tu clave de la IA.')}</li>
              <li>{t('Compartes datos de alumnos: hazlo solo con docentes del centro que deban acceder a ellos.')}</li>
              <li>{t('Cuando ya no lo necesites, borra el archivo de tu carpeta de copias.')}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
