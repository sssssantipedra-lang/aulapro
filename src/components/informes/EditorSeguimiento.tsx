/**
 * El informe de seguimiento antes de guardarlo (20-11-2026): lo que han calculado las reglas, para que el
 * docente lo revise, cambie las frases, quite lo que no quiera entregar y escriba su observación. Debajo de
 * cada frase se ve de qué dato sale; eso se queda en la pantalla y nunca va al documento de la familia.
 */
import { useEffect, useRef, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import type { FraseSeguimiento, InformeSeguimiento, SeccionSeguimiento } from '../../types';
import { useI18n } from '../../i18n';
import { quitarFrase, seVe, seguimientoLimpio } from '../../lib/informeSeguimiento';
import { useBorrador } from '../../hooks/useBorrador';
import { leerBorrador, type TipoBorrador } from '../../services/borradores';
import { AvisoBorrador, EstadoBorrador } from '../AvisoBorrador';
import { cuerpoDeInformeHtml, type PartesDeInforme } from '../../lib/informeDocumento';
import { NOMBRE, normalizarValoracion, COLOR_VALORACION, type FilaCompetencia } from '../../lib/tablaCompetencias';

export interface BorradorDeSeguimiento {
  text: string; seguimiento: InformeSeguimiento; tabla: FilaCompetencia[];
  /**
   * La huella del informe guardado del que se partió (`huellaDeInforme`, `''` si no había): la copia sin
   * guardar solo se ofrece mientras el informe siga igual, para no pisar lo que se guardó después.
   */
  desde?: string;
}

interface Props {
  nombre: string;
  /** Dónde va su copia sin guardar (`borradorDeSeguimiento` de `lib/informeSeguimiento.ts`). */
  tipoBorrador: TipoBorrador;
  /** La evaluación del informe, ya escrita («1ª evaluación (del 1 sept 2026 al 31 dic 2026)»). */
  periodo: string;
  inicial: BorradorDeSeguimiento;
  /** Las notas, la asistencia y las competencias como saldrán, para verlas mientras se edita. */
  partes: (b: BorradorDeSeguimiento) => PartesDeInforme;
  etiquetaCompetencia: (clave: string) => string;
  /** `true` si el informe aún no existe: el botón dice «Guardar informe». */
  nuevo: boolean;
  onGuardar: (b: BorradorDeSeguimiento) => void;
  onCancelar: () => void;
}

/** Las líneas que necesita una frase para verse entera donde el campo no crece solo (`field-sizing`), contando con un móvil. */
const filasPara = (texto: string) => Math.min(7, Math.max(2, Math.ceil(texto.length / 38)));

const SECCIONES: { id: SeccionSeguimiento; nombre: string }[] = [
  { id: 'notas', nombre: 'Calificaciones' }, { id: 'asistencia', nombre: 'Asistencia' }, { id: 'competencias', nombre: 'Competencias clave' },
];

export function EditorSeguimiento({ nombre, tipoBorrador, periodo, inicial, partes, etiquetaCompetencia, nuevo, onGuardar, onCancelar }: Props) {
  const { t } = useI18n();
  const [b, setB] = useState<BorradorDeSeguimiento>(inicial);

  /* ── Autoguardado: lo que se cambia y no se ha guardado, por si se sale a medias ── */
  const [deInicio] = useState(() => JSON.stringify(inicial));
  // Si la pantalla lo abrió con la copia (desde el aviso del panel), no se ofrece otra vez: se sigue con ella
  const [copiaAbierta] = useState(() => JSON.stringify(leerBorrador<BorradorDeSeguimiento>(tipoBorrador)?.datos ?? null) === deInicio);
  const [retomado, setRetomado] = useState(copiaAbierta);
  // Al guardar o cancelar, primero se pinta sin nada pendiente (la copia se borra) y después se avisa a la
  // pantalla: si se cerrara antes, el autoguardado volcaría la copia al desmontarse. Si la pantalla no lo
  // cierra (un informe vacío no se guarda), el siguiente cambio vuelve a tener copia
  const accion = useRef<(() => void) | null>(null);
  const [cerrando, setCerrando] = useState<{ hoja: BorradorDeSeguimiento } | null>(null);
  const pendiente = cerrando?.hoja !== b && (retomado || JSON.stringify(b) !== deInicio) ? b : null;
  const borrador = useBorrador<BorradorDeSeguimiento>(tipoBorrador, pendiente, nombre);
  // Una copia de cuando el informe era otro (la IA lo redactó de nuevo, se eliminó…) no se ofrece: pisaría lo de ahora
  const copiaQueSirve = borrador.encontrado && !copiaAbierta && borrador.encontrado.datos.desde === inicial.desde ? borrador.encontrado : null;
  useEffect(() => {
    const hacer = accion.current;
    accion.current = null;
    hacer?.();
  }, [cerrando]);
  const salir = (hacer: () => void) => { accion.current = hacer; setCerrando({ hoja: b }); };
  const continuarCopia = () => {
    const d = borrador.continuar();
    if (d) { setB(d); setRetomado(true); }
  };
  const s = b.seguimiento;
  const cambiar = (x: Partial<InformeSeguimiento>) => setB(prev => ({ ...prev, seguimiento: { ...prev.seguimiento, ...x } }));

  const hay: Record<SeccionSeguimiento, boolean> = { notas: s.notas.length > 0, asistencia: !!s.asistencia, competencias: b.tabla.length > 0 };
  const alternar = (id: SeccionSeguimiento) => {
    const ocultar = new Set(s.ocultar ?? []);
    if (ocultar.has(id)) ocultar.delete(id); else ocultar.add(id);
    cambiar({ ocultar: [...ocultar] });
  };

  // Solo las partes de datos (sin frases, texto ni observación, que se editan abajo), tal como saldrán
  const p = partes({ ...b, text: '', seguimiento: { ...s, positivos: [], mejorar: [], observacion: '' }, tabla: [] });
  const datosHtml = cuerpoDeInformeHtml(p, t);

  const frases = (lado: 'positivos' | 'mejorar', titulo: string, vacio: string, ayuda: string) => {
    const lista = s[lado];
    const poner = (i: number, f: FraseSeguimiento | null) => (f
      ? cambiar({ [lado]: lista.map((x, k) => (k === i ? f : x)) })
      // Una frase de las reglas quitada se recuerda (`quitadas`): «Actualizar los datos» no la vuelve a poner
      : setB(prev => ({ ...prev, seguimiento: quitarFrase(prev.seguimiento, lado, i) })));
    return (
      <fieldset className="inf-frases">
        <legend>{t(titulo)}</legend>
        {lista.length === 0 && <p className="inf-vacio">{t(vacio)}</p>}
        {lista.map((f, i) => (
          <div className="inf-frase" key={i}>
            <div className="inf-frase-txt">
              <textarea className="finput" rows={filasPara(f.texto)} value={f.texto} aria-label={t('{titulo}: frase {n}', { titulo: t(titulo), n: i + 1 })}
                onChange={e => poner(i, { ...f, texto: e.target.value })} />
              <button type="button" className="ico-btn" title={t('Quitar esta frase')} aria-label={t('Quitar esta frase')} onClick={() => poner(i, null)}>
                <Trash2 size={15} />
              </button>
            </div>
            <p className="inf-origen">
              <Info size={12} aria-hidden="true" />
              {f.origen ? t('Sale de: {dato}', { dato: f.origen }) : t('Escrita por ti')}
            </p>
          </div>
        ))}
        <button type="button" className="btn-ghost sm" onClick={() => cambiar({ [lado]: [...lista, { texto: '' }] })}>
          <Plus size={13} />{t(ayuda)}
        </button>
      </fieldset>
    );
  };

  return (
    <div className="inf-editor">
      {copiaQueSirve && (
        <AvisoBorrador borrador={copiaQueSirve} queEra={t('un informe de seguimiento')} onContinuar={continuarCopia} onDescartar={borrador.descartar} />
      )}
      <p className="inf-intro">
        {t('AulaPro ha preparado este informe con tus datos de {periodo}, con reglas fijas y sin IA. Revísalo y cambia lo que quieras antes de guardarlo.', { periodo })}
        {' '}{t('Debajo de cada frase ves de qué dato sale: eso no se entrega a la familia.')}
      </p>

      <fieldset className="inf-partes">
        <legend>{t('Datos del periodo')}</legend>
        <div className="inf-casillas">
          {SECCIONES.map(x => (
            <label key={x.id} className={hay[x.id] ? '' : 'off'}>
              <input type="checkbox" checked={hay[x.id] && seVe(s, x.id)} disabled={!hay[x.id]} onChange={() => alternar(x.id)} />
              {t(x.nombre)}
              {!hay[x.id] && <span> · {t('sin datos en este periodo')}</span>}
            </label>
          ))}
        </div>
        {datosHtml
          ? <div className="inf-hoja" dangerouslySetInnerHTML={{ __html: datosHtml }} />
          : <p className="inf-vacio">{t('El informe no llevará tablas de datos: solo las frases y tu observación.')}</p>}
        <p className="inf-nota">{t('Los números salen del cuaderno, de la asistencia y de las evaluaciones: se cambian allí. Desmarca lo que no quieras entregar.')}</p>
      </fieldset>

      {b.tabla.length > 0 && seVe(s, 'competencias') && (
        <fieldset className="inf-comp">
          <legend>{t('Comentario de cada competencia (opcional)')}</legend>
          {b.tabla.map((f, i) => {
            const v = normalizarValoracion(f.valoracion);
            return (
              <label key={f.clave} className="inf-comp-fila">
                <span className="inf-comp-nombre"><strong>{f.clave}</strong> {etiquetaCompetencia(f.clave)}</span>
                <span className="inf-comp-val" style={{ color: COLOR_VALORACION[v] }}>{t(NOMBRE[v])}</span>
                <input className="finput" value={f.comentario} placeholder={t('Sin comentario')}
                  aria-label={t('Comentario de {competencia}', { competencia: f.clave })}
                  onChange={e => setB(prev => ({ ...prev, tabla: prev.tabla.map((x, k) => (k === i ? { ...x, comentario: e.target.value } : x)) }))} />
              </label>
            );
          })}
          <p className="inf-nota">{t('La valoración la fija la media de tus evaluaciones con rúbricas y dianas (sobre 4): excelente desde 3,5, bien desde 2,5.')}</p>
        </fieldset>
      )}

      {frases('positivos', 'Lo positivo', 'Las reglas no han encontrado nada que destacar en este periodo. Puedes escribirlo tú.', 'Añadir una frase')}
      {frases('mejorar', 'A mejorar', 'Las reglas no han encontrado nada que mejorar en este periodo. Puedes escribirlo tú.', 'Añadir una frase')}
      {(s.quitadas?.length ?? 0) > 0 && (
        <p className="inf-nota">
          {t(s.quitadas?.length === 1
            ? 'Has quitado 1 frase que sale de las reglas: no volverá al actualizar los datos.'
            : 'Has quitado {n} frases que salen de las reglas: no volverán al actualizar los datos.', { n: s.quitadas?.length ?? 0 })}
          {' '}
          <button type="button" className="btn-ghost sm" title={t('Las frases quitadas volverán a salir la próxima vez que actualices los datos, si sus datos siguen ahí.')}
            onClick={() => cambiar({ quitadas: [] })}>
            {t('Volver a ofrecerlas')}
          </button>
        </p>
      )}

      <div className="fgroup">
        <label className="flabel" htmlFor="inf-observacion">{t('Observaciones del docente')}</label>
        <textarea id="inf-observacion" className="finput" rows={4} value={s.observacion}
          placeholder={t('Lo que quieras decir a la familia con tus palabras: cómo le ves, qué le vendría bien en casa, cuándo hablar…')}
          onChange={e => cambiar({ observacion: e.target.value })} />
      </div>

      <div className="fgroup">
        <label className="flabel" htmlFor="inf-texto">{t('Texto de presentación (opcional)')}</label>
        <textarea id="inf-texto" className="finput" rows={b.text ? 7 : 3} value={b.text}
          placeholder={t('Un párrafo al principio del informe. Puedes dejarlo vacío, escribirlo tú o pedir a la IA que lo redacte cuando el informe esté guardado.')}
          onChange={e => setB(prev => ({ ...prev, text: e.target.value }))} />
      </div>

      <div className="inf-botones">
        <button type="button" className="btn-accent" onClick={() => {
          const limpio = { text: b.text.trim(), seguimiento: seguimientoLimpio(s), tabla: b.tabla.map(f => ({ ...f, comentario: f.comentario.trim() })) };
          salir(() => onGuardar(limpio));
        }}>
          {t(nuevo ? 'Guardar informe' : 'Guardar cambios')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => salir(onCancelar)}>{t('Cancelar')}</button>
        {pendiente && <EstadoBorrador guardadoEn={borrador.guardadoEn} />}
        <span className="inf-nota">{t('Informe de {nombre}. Nada de esto sale de tu dispositivo.', { nombre })}</span>
      </div>
    </div>
  );
}
