/**
 * «Calificar esta actividad» (22-11-2026): el alumnado en una lista vertical con una casilla grande por nota,
 * pensada para la tableta y el móvil, donde apuntar a las celdas de la tabla cuesta. «Siguiente» en el teclado
 * (o Intro) pasa al alumno de debajo; cada nota se guarda al salir de su casilla, como en la tabla. Se abre desde
 * el menú de la columna y, en una pantalla táctil, al crear una actividad.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Check, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { esBloque, leerNota, leerPegado } from '../../lib/pegarNotas';
import { loAbierto } from '../../lib/loAbierto';
import type { GradeItem, Student } from '../../types';

interface Props {
  item: GradeItem;
  /** La categoría y la fecha, ya escritas. */
  detalle: string;
  /** Las actividades donde se puede escribir, por categoría, para pasar de una a otra sin cerrar. */
  grupos: { categoria: string; items: GradeItem[] }[];
  alumnado: Student[];
  notas: Record<string, number | null> | undefined;
  /** La marca que acompaña al nombre (la adaptación curricular). */
  marca?: (s: Student) => ReactNode;
  onNota: (studentId: string, valor: number | null) => void;
  onCambiar: (itemId: string) => void;
  /** Un bloque pegado sobre la casilla de un alumno: lo enseña la vista previa del cuaderno. */
  onPegar?: (filas: string[][], studentId: string) => void;
  onClose: () => void;
}

function notaColor(n: number | null): string {
  if (n === null) return 'var(--text)';
  if (n < 5) return 'var(--grade-bad)';
  if (n < 7) return 'var(--grade-mid)';
  return 'var(--grade-good)';
}

function Casilla({ alumno, itemId, valor, ultimo, activo, marca, onNota, onFoco, onPegar }: {
  alumno: Student; itemId: string; valor: number | null; ultimo: boolean; activo: boolean; marca?: ReactNode;
  onNota: (v: number | null) => void; onFoco: () => void; onPegar?: (filas: string[][]) => void;
}) {
  const { t, lang } = useI18n();
  const id = useId();
  const [texto, setTexto] = useState<string | null>(null); // null = sin editar
  const escrito = valor !== null ? (lang !== 'en' ? String(valor).replace('.', ',') : String(valor)) : '';
  const mal = texto !== null && leerNota(texto).tipo === 'mal';

  /**
   * Lo escrito y aún sin guardar. La nota se guarda al salir de la casilla, pero la lista también se cierra sin
   * que la casilla pierda el foco: con el botón de atrás del móvil, al pasar a otra actividad o, en el iPhone,
   * al tocar «Hecho» (allí tocar un botón no saca el foco del campo). Al desmontarse, la casilla guarda lo suyo.
   */
  const sinGuardar = useRef<{ texto: string | null; onNota: (v: number | null) => void }>({ texto: null, onNota });
  useEffect(() => { sinGuardar.current.onNota = onNota; });
  function escribir(v: string | null) { sinGuardar.current.texto = v; setTexto(v); }
  useEffect(() => {
    const pendiente = sinGuardar.current;
    return () => {
      if (pendiente.texto === null) return;
      const leida = leerNota(pendiente.texto);
      pendiente.texto = null;
      if (leida.tipo !== 'mal') pendiente.onNota(leida.tipo === 'nota' ? leida.valor : null);
    };
  }, []);

  function guardar() {
    if (texto === null) return;
    const leida = leerNota(texto);
    if (leida.tipo === 'mal') return; // se queda escrito y señalado: no se guarda
    onNota(leida.tipo === 'nota' ? leida.valor : null);
    escribir(null);
  }
  /** La casilla del alumno de debajo (o de arriba). */
  function vecina(desde: HTMLElement, paso: 1 | -1): HTMLInputElement | null {
    const fila = desde.closest('li');
    const otra = paso > 0 ? fila?.nextElementSibling : fila?.previousElementSibling;
    return otra?.querySelector<HTMLInputElement>('input.pn-cal-nota') ?? null;
  }
  function pasar(desde: HTMLElement, paso: 1 | -1, soltar: boolean) {
    const otra = vecina(desde, paso);
    if (otra) otra.focus(); else if (soltar) (desde.closest('li')?.querySelector<HTMLInputElement>('input.pn-cal-nota') ?? desde).blur();
  }

  return (
    <li className={`pn-cal-fila${activo ? ' activa' : ''}${valor !== null ? ' con-nota' : ''}`}>
      <label htmlFor={id} className="pn-cal-nombre">{alumno.name}{marca}</label>
      <input
        id={id} className="pn-cal-nota" type="text" inputMode="decimal" autoComplete="off"
        enterKeyHint={ultimo ? 'done' : 'next'}
        data-item={itemId} data-alumno={alumno.id}
        value={texto ?? escrito} placeholder="·" aria-invalid={mal}
        style={{ color: mal ? 'var(--grade-bad)' : notaColor(valor) }}
        onChange={e => escribir(e.target.value)}
        onFocus={e => { onFoco(); e.target.select(); e.target.scrollIntoView?.({ block: 'nearest' }); }}
        onBlur={guardar}
        onPaste={e => {
          if (!onPegar) return;
          const filas = leerPegado(e.clipboardData.getData('text/plain'));
          if (!esBloque(filas)) return;
          e.preventDefault();
          escribir(null);
          onPegar(filas);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            pasar(e.currentTarget, e.key === 'ArrowUp' ? -1 : 1, e.key === 'Enter');
          }
          // Escape deshace lo escrito en la casilla; la ventana se cierra con el segundo
          if (e.key === 'Escape' && texto !== null) { e.stopPropagation(); escribir(null); }
        }}
      />
      {/* «Siguiente» a la vista junto a la casilla: el teclado de números del iPhone no trae esa tecla */}
      {activo && !ultimo && (
        <button
          type="button" className="pn-cal-sig" aria-label={t('Siguiente alumno')} title={t('Siguiente alumno')}
          onMouseDown={e => e.preventDefault()}
          onClick={e => pasar(e.currentTarget, 1, false)}
        >
          <ArrowDown size={18} aria-hidden="true" />
        </button>
      )}
      {mal && <p className="pn-error" role="alert">{t('No es una nota de 0 a 10: no se ha guardado.')}</p>}
    </li>
  );
}

export function CalificarActividad({ item, detalle, grupos, alumnado, notas, marca, onNota, onCambiar, onPegar, onClose }: Props) {
  const { t } = useI18n();
  const tituloId = useId();
  const lista = useRef<HTMLUListElement>(null);
  const fondo = useRef<HTMLDivElement>(null);
  /** El alumno en cuya casilla se está: lleva el botón «Siguiente» al lado. */
  const [activo, setActivo] = useState<string | null>(null);
  const conNota = alumnado.filter(s => typeof notas?.[s.id] === 'number').length;
  const varias = grupos.reduce((n, g) => n + g.items.length, 0) > 1;

  // Al abrir y al pasar de actividad, el foco va al primer alumno sin nota (o al primero)
  useEffect(() => {
    const casillas = [...(lista.current?.querySelectorAll<HTMLInputElement>('input.pn-cal-nota') ?? [])];
    (casillas.find(c => c.value === '') ?? casillas[0])?.focus();
  }, [item.id]);

  useEffect(() => {
    // Con la vista previa de pegar abierta encima, Escape cierra esa y no esta
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && loAbierto(document) === fondo.current) onClose(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onClose]);

  return (
    <div className="modal-overlay open pn-cal-fondo" ref={fondo} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal pn-cal" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <div className="pn-cal-cab">
          <div className="pn-cal-titulo">
            <span className="pn-cal-ante" id={tituloId}>{t('Calificar esta actividad')}</span>
            {varias ? (
              <select className="finput pn-cal-sel" value={item.id} aria-label={t('Actividad')} onChange={e => onCambiar(e.target.value)}>
                {grupos.map(g => (
                  <optgroup key={g.categoria} label={g.categoria}>
                    {g.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : <strong className="pn-cal-unica">{item.name}</strong>}
            <span className="pn-cal-detalle">{detalle}</span>
          </div>
          <button type="button" className="ico-btn" onClick={onClose} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={19} /></button>
        </div>
        <div className="pn-cal-cuenta" role="status">
          <span><strong>{conNota}</strong> {t('de {total} con nota', { total: alumnado.length })}</span>
          <span className="pn-barra" aria-hidden="true"><span style={{ width: `${alumnado.length ? (conNota / alumnado.length) * 100 : 0}%` }} /></span>
        </div>
        <ul className="pn-cal-lista" ref={lista}>
          {alumnado.map((s, k) => (
            <Casilla
              key={`${item.id}:${s.id}`} alumno={s} itemId={item.id} marca={marca?.(s)}
              valor={typeof notas?.[s.id] === 'number' ? (notas[s.id] as number) : null}
              ultimo={k === alumnado.length - 1} activo={activo === s.id}
              onNota={v => onNota(s.id, v)} onFoco={() => setActivo(s.id)}
              onPegar={onPegar ? filas => onPegar(filas, s.id) : undefined}
            />
          ))}
        </ul>
        <div className="pn-cal-pie">
          <span className="sda-note">{t('Cada nota se guarda al salir de su casilla.')}</span>
          <button type="button" className="btn-accent" onClick={onClose}><Check size={15} aria-hidden="true" />{t('Hecho')}</button>
        </div>
      </div>
    </div>
  );
}
