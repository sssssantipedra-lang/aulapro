/**
 * La campana de los avisos y su panel (25-11-2026, petición del dueño). La campana va junto a «Buscar» en el menú
 * y junto a la lupa en la barra de arriba del móvil, con el número de avisos; el panel los enseña agrupados por
 * tipo, lo más urgente primero, cada uno con su porqué y con lo que se puede hacer: abrir donde vive, ocultarlo
 * («Ya lo he visto») o, una tarea, marcarla como hecha. Qué entra y en qué orden, en `lib/notificaciones.ts`.
 *
 * El panel es un diálogo (`role="dialog"` con `aria-modal`) con su botón «Cerrar»: se cierra con Escape, con la X,
 * tocando fuera y con el botón de atrás (`lib/loAbierto.ts`). Mientras está abierto, el foco no sale de él (Tab da
 * la vuelta dentro), y al ocultar un aviso o marcar una tarea pasa al aviso siguiente y se dice lo hecho. Nada
 * sale del dispositivo.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, BookOpen, CalendarDays, CheckCircle2, CheckSquare2, EyeOff, X } from 'lucide-react';
import { useI18n, eventTypeLabel, priorityLabel } from '../i18n';
import { agrupar, type Aviso, type TipoAviso } from '../lib/notificaciones';
import { textoDeDato } from '../lib/resumenAlumno';
import { fromIsoDate } from '../lib/utils';
import { MarcaCerca } from './MarcaCerca';

/** La campana, con el número de avisos (sin avisos, sin número). */
export function Campana({ n, abierto, onClick, className }: {
  n: number; abierto?: boolean; onClick: () => void; className?: string;
}) {
  const { t } = useI18n();
  const etiqueta = n === 0 ? t('Avisos: no hay nada pendiente') : t(n === 1 ? 'Avisos: 1 pendiente' : 'Avisos: {n} pendientes', { n });
  return (
    <button
      type="button" className={`ntf-campana${className ? ` ${className}` : ''}${n > 0 ? ' con' : ''}`} onClick={onClick}
      aria-label={etiqueta} title={etiqueta} aria-haspopup="dialog" aria-expanded={!!abierto}
    >
      <Bell size={17} aria-hidden="true" />
      {n > 0 && <span className="ntf-num" aria-hidden="true">{n > 99 ? '99+' : n}</span>}
    </button>
  );
}

const ICONO: Record<TipoAviso, typeof Bell> = { evento: CalendarDays, alumno: AlertTriangle, notas: BookOpen, tarea: CheckSquare2 };
const TITULO: Record<TipoAviso, string> = {
  evento: 'Eventos próximos', alumno: 'Alumnado que necesita atención', notas: 'Notas a medio poner', tarea: 'Tareas pendientes',
};
/** El porqué de cada grupo, en una línea. */
const PORQUE: Record<TipoAviso, string> = {
  evento: 'Los eventos de tu Agenda a los que les faltan 5 días o menos.',
  alumno: 'Lo que dicen sus datos de las últimas 4 semanas, como en «Necesitan atención» del Inicio.',
  notas: 'Actividades de esta evaluación que la mitad de la clase o más ya tiene calificadas y a las que les falta la nota de alguien.',
  tarea: 'Las tareas del Inicio que aún no has marcado como hechas.',
};

interface PanelProps {
  avisos: Aviso[];
  /** Los que el docente ha ocultado con «Ya lo he visto» y hoy seguirían saliendo. */
  ocultos: Aviso[];
  /** Con más de una clase se dice de cuál es cada cosa. */
  variasClases: boolean;
  onAbrir: (a: Aviso) => void;
  onOcultar: (a: Aviso) => void;
  onVolverAEnsenar: () => void;
  onTareaHecha: (id: string) => void;
  /** Si las tareas tienen dónde abrirse (el Inicio de tutoría y de EF; el de PT y AL no las enseña). */
  abrirTareas: boolean;
  onCerrar: () => void;
}

export function PanelAvisos({ avisos, ocultos, variasClases, onAbrir, onOcultar, onVolverAEnsenar, onTareaHecha, abrirTareas, onCerrar }: PanelProps) {
  const { t, locale, lang } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; }, [onCerrar]);
  /** Lo último hecho desde el panel, para decirlo (lector de pantalla) y, una tarea, poder deshacerlo. */
  const [hecho, setHecho] = useState<{ texto: string; tarea?: { id: string; text: string } } | null>(null);
  /** Tras ocultar un aviso o marcar una tarea, el foco va al aviso que queda en su sitio (o al anterior, o al panel). */
  const focoEn = useRef<number | null>(null);

  // Escape cierra; al cerrar, el foco vuelve a la campana (o a lo que lo tenía). Tab no sale del panel.
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      const p = panel.current;
      if (!p || e.defaultPrevented) return;
      const dentro = p.contains(document.activeElement) || document.activeElement === document.body;
      // Si lo que tiene el foco es otra ventana abierta encima, Escape es suyo
      if (e.key === 'Escape' && dentro) { e.preventDefault(); cerrar.current(); return; }
      if (e.key !== 'Tab') return;
      const enfocables = [...p.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.hasAttribute('disabled'));
      if (!enfocables.length) return;
      const primero = enfocables[0], ultimo = enfocables[enfocables.length - 1];
      if (!dentro || (e.shiftKey && (document.activeElement === primero || document.activeElement === p))) { e.preventDefault(); (e.shiftKey ? ultimo : primero).focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    };
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('keydown', tecla);
      // Si la campana que abrió el panel ya no está (el menú del móvil se cerró), a la que se vea
      const destino = antes?.isConnected ? antes : [...document.querySelectorAll<HTMLElement>('.ntf-campana')].find(el => el.offsetParent !== null);
      destino?.focus();
    };
  }, []);

  useLayoutEffect(() => {
    if (focoEn.current === null || !panel.current) return;
    const filas = [...panel.current.querySelectorAll<HTMLElement>('.ntf-item')];
    const fila = filas[Math.min(focoEn.current, filas.length - 1)];
    (fila?.querySelector<HTMLElement>('.ntf-check, .ntf-abrir') ?? panel.current.querySelector<HTMLElement>('.ntf-deshacer') ?? panel.current).focus();
    focoEn.current = null;
  });
  /** La posición de la fila de un aviso entre todas (en el orden del panel, por grupos), para dejar el foco en la que ocupe su sitio. */
  const posicion = (clave: string) => agrupar(avisos).flatMap(g => g.avisos).findIndex(a => a.clave === clave);
  const ocultar = (a: Aviso, titulo: string) => {
    focoEn.current = posicion(a.clave);
    setHecho({ texto: t('Aviso ocultado: {aviso}', { aviso: titulo }) });
    onOcultar(a);
  };
  const tareaHecha = (a: Aviso & { tipo: 'tarea' }) => {
    focoEn.current = posicion(a.clave);
    setHecho({ texto: t('Tarea marcada como hecha: {tarea}', { tarea: a.tarea.text }), tarea: { id: a.tarea.id, text: a.tarea.text } });
    onTareaHecha(a.tarea.id);
  };
  const deshacerTarea = (tarea: { id: string; text: string }) => {
    setHecho({ texto: t('Tarea pendiente de nuevo: {tarea}', { tarea: tarea.text }) });
    onTareaHecha(tarea.id);
  };
  const verOcultos = () => {
    focoEn.current = 0;
    setHecho({ texto: t('Los avisos ocultos vuelven a la lista.') });
    onVolverAEnsenar();
  };

  const grupos = agrupar(avisos);
  const nombres = (lista: { name: string }[], max = 3) => {
    const n = lista.map(s => s.name);
    return n.length > max ? `${n.slice(0, max).join(', ')} ${t('y {n} más', { n: n.length - max })}` : n.join(', ');
  };
  const fecha = (iso: string) => fromIsoDate(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  const contenido = (a: Aviso) => {
    switch (a.tipo) {
      case 'evento': return {
        titulo: a.evento.name,
        detalle: [fecha(a.evento.date), a.evento.time, eventTypeLabel(a.evento.type, lang), a.clase?.name].filter(Boolean).join(' · '),
        // En el panel no late: ya laten en la Agenda y en el Inicio, y aquí son una lista que se lee
        marca: <MarcaCerca dias={a.dias} latido={false} />,
      };
      case 'alumno': return {
        titulo: a.student.name + (variasClases ? ` · ${a.cls.name}` : ''),
        detalle: textoDeDato(a.dato, t, locale) + (a.cuantos > 1 ? ` · ${t('y {n} más', { n: a.cuantos - 1 })}` : ''),
        marca: null,
      };
      case 'notas': return {
        titulo: [a.item.name, a.cls.name, (a.cls.subjects?.length ?? 0) > 1 ? a.asignatura : ''].filter(Boolean).join(' · '),
        detalle: t(a.faltan.length === 1 ? 'Falta la nota de {n} de {total}: {nombres}' : 'Faltan las notas de {n} de {total}: {nombres}',
          { n: a.faltan.length, total: a.total, nombres: nombres(a.faltan) }),
        marca: null,
      };
      case 'tarea': return { titulo: a.tarea.text, detalle: '', marca: a.tarea.priority === 'high' ? <span className="home-pill warn">{priorityLabel('high', lang)}</span> : null };
    }
  };
  const textoAbrir: Record<TipoAviso, string> = { evento: 'Abrir en la Agenda', alumno: 'Abrir su ficha', notas: 'Abrir el cuaderno', tarea: 'Abrir en el Inicio' };

  return (
    <div className="ntf-fondo" onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div ref={panel} className="ntf" role="dialog" aria-modal="true" aria-labelledby="ntf-ttl" aria-describedby="ntf-intro" tabIndex={-1}>
        <div className="ntf-hd">
          <Bell size={18} aria-hidden="true" />
          <h2 id="ntf-ttl" className="ntf-ttl">{t('Avisos@@campana')}</h2>
          {avisos.length > 0 && <span className="ntf-cuenta" aria-hidden="true">{avisos.length}</span>}
          <button type="button" className="ico-btn ntf-x" onClick={onCerrar} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={18} /></button>
        </div>
        <p id="ntf-intro" className="ntf-intro">{t('Lo que conviene mirar, calculado en tu dispositivo con tus datos y sin IA.')}</p>

        <div className="ntf-cuerpo">
          {avisos.length === 0 ? (
            <p className="ntf-vacio"><CheckCircle2 size={20} aria-hidden="true" />{t('No tienes nada pendiente.')}</p>
          ) : grupos.map(g => {
            const Icono = ICONO[g.tipo];
            return (
              <section key={g.tipo} className={`ntf-grupo ntf-${g.tipo}`} aria-labelledby={`ntf-g-${g.tipo}`}>
                <h3 id={`ntf-g-${g.tipo}`} className="ntf-g-ttl">
                  <Icono size={14} aria-hidden="true" />{t(TITULO[g.tipo])}
                  <span className="ntf-g-n" aria-hidden="true">{g.avisos.length}</span>
                  <span className="sr-only">{`, ${t(g.avisos.length === 1 ? '1 aviso@@campana' : '{n} avisos@@campana', { n: g.avisos.length })}`}</span>
                </h3>
                <p className="ntf-porque">{t(PORQUE[g.tipo])}</p>
                <ul className="ntf-lista">
                  {g.avisos.map(a => {
                    const c = contenido(a);
                    const abrible = a.tipo !== 'tarea' || abrirTareas;
                    return (
                      <li key={a.clave} className="ntf-item">
                        {a.tipo === 'tarea' && (
                          <label className="ntf-check-zona" title={t('Marcar como hecha')}>
                            <input type="checkbox" className="ntf-check" checked={false} onChange={() => tareaHecha(a)}
                              aria-label={t('Marcar como hecha: {tarea}', { tarea: a.tarea.text })} />
                          </label>
                        )}
                        {abrible ? (
                          <button type="button" className="ntf-abrir" onClick={() => onAbrir(a)} title={t(textoAbrir[a.tipo])}>
                            <span className="ntf-txt"><b>{c.titulo}</b>{c.detalle && <small>{c.detalle}</small>}</span>
                            {c.marca}
                          </button>
                        ) : (
                          <span className="ntf-abrir ntf-quieto"><span className="ntf-txt"><b>{c.titulo}</b></span>{c.marca}</span>
                        )}
                        {a.tipo !== 'tarea' && (
                          <button type="button" className="ntf-visto" onClick={() => ocultar(a, c.titulo)}
                            aria-label={t('Ya lo he visto: {aviso}', { aviso: c.titulo })} title={t('Ocultar este aviso. Vuelve si cambia el motivo.')}>
                            <EyeOff size={14} aria-hidden="true" /><span>{t('Ya lo he visto')}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Lo último hecho, dicho también al lector de pantalla; una tarea marcada se puede desmarcar aquí mismo */}
        <p className="ntf-hecho" role="status">
          {hecho && <>
            {hecho.texto}
            {hecho.tarea && <>{' '}<button type="button" className="ntf-link ntf-deshacer" onClick={() => deshacerTarea(hecho.tarea!)}>{t('Deshacer')}</button></>}
            {avisos.length === 0 && <span className="sr-only">{' '}{t('No tienes nada pendiente.')}</span>}
          </>}
        </p>

        {ocultos.length > 0 && (
          <p className="ntf-pie">
            {t(ocultos.length === 1 ? 'Has ocultado 1 aviso.' : 'Has ocultado {n} avisos.', { n: ocultos.length })}{' '}
            <button type="button" className="ntf-link" onClick={verOcultos}>{t('Volver a enseñarlos')}</button>
          </p>
        )}
      </div>
    </div>
  );
}
