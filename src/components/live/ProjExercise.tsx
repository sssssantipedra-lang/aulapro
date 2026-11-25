/**
 * Un ejercicio de una ficha en grande, para leerlo desde el fondo del aula. Lo usan la proyección de
 * un escape room (todos los ejercicios de una sala a la vista, `ChallengePresenter`) y la de una ficha
 * de ejercicios o de una comprensión lectora, un ejercicio por pantalla (`ProyeccionEjercicios`).
 *
 * Cada tipo de ejercicio se pinta con lo que hace falta para hacerlo en la pizarra: los dibujos que se
 * cuentan, las pizzas de las fracciones con sus trozos exactos, la sopa de letras con sus letras, el
 * crucigrama con sus casillas, un recuadro donde dibujar… En la proyección de un ejercicio por pantalla
 * todo va en `em`, para que crezca con la letra que lo hace caber (`proyeccion.css`).
 */
import type { ReactNode } from 'react';
import type { FichaExercise } from '../../services/resources';
import { buildFigureSvg } from '../../lib/geometryFigures';
import { urlPicto } from '../../lib/pictos';
import { dibujosEnOrden } from '../../lib/pictosFicha';
import { urlIlustracion, nombreIlustracion } from '../../lib/ilustraciones';
import { bancoClasificar } from '../../lib/dibujosEjercicio';
import { fraccionSvg, fraccionTexto, letraFraccion, ordenUnir, tieneDecimalExacto, valorUnir } from '../../lib/fraccionesDibujo';
import { crosswordCells } from '../../lib/crossword';
import { useI18n } from '../../i18n';
import './proyeccion.css';

/** Un dibujo del catálogo (hilo conductor), tal como va dentro de la aplicación. */
export const Ilus = ({ id, className }: { id: string; className?: string }) =>
  <img className={className} src={`${import.meta.env.BASE_URL}${urlIlustracion(id)}`} alt="" />;

/** Los dibujos del catálogo de un ejercicio, en grande: lo que hay que contar, rotular o clasificar. */
function ProjDibujos({ ex }: { ex: FichaExercise }) {
  const { lang } = useI18n();
  const dibujos = (ex.dibujos ?? []).filter(d => d.ilustracion);
  if (ex.tipo === 'clasificar') {
    return (
      <>
        <div className="cp-ilus">{bancoClasificar(ex.categorias).map((d, i) => (
          <span key={i} className="cp-ilus-c"><b>{i + 1}</b><Ilus id={d.id} /><small>{nombreIlustracion(d.id, lang)}</small></span>
        ))}</div>
        <div className="cp-items">{(ex.categorias ?? []).map((c, i) => <span key={i} className="cp-item"><b>{c.nombre}</b></span>)}</div>
      </>
    );
  }
  if (!dibujos.length || ex.tipo === 'relacionar' || ex.tipo === 'tabla_rellenar') return null;
  if (ex.tipo === 'contar') {
    return (
      <div className="cp-contar">{dibujos.map((d, i) => (
        <div key={i} className="cp-ilus">{Array.from({ length: Math.max(1, Math.min(10, d.cantidad ?? 1)) }, (_, k) => <Ilus key={k} id={d.ilustracion} />)}</div>
      ))}</div>
    );
  }
  const banco = ex.tipo === 'etiquetar' && ex.banco
    ? dibujos.map(d => nombreIlustracion(d.ilustracion, lang) ?? '').filter(Boolean).sort((a, b) => a.localeCompare(b))
    : [];
  return (
    <>
      {banco.length > 0 && <div className="cp-items cp-banco">{banco.map((p, i) => <span key={i} className="cp-item">{p}</span>)}</div>}
      <div className="cp-ilus">{dibujos.flatMap((d, i) => Array.from({ length: ex.tipo === 'etiquetar' ? 1 : Math.max(1, Math.min(10, d.cantidad ?? 1)) }, (_, k) => (
        <span key={`${i}-${k}`} className="cp-ilus-c">{ex.tipo === 'etiquetar' && <b>{i + 1}</b>}<Ilus id={d.ilustracion} /></span>
      )))}</div>
    </>
  );
}

/** Una pizza o una tarta dibujada por el código, con sus trozos exactos. */
const Pizza = ({ svg }: { svg: string }) => <span className="cp-fr-img" dangerouslySetInnerHTML={{ __html: svg }} />;

/** El ejercicio «fracciones» (leer, colorear o unir) y las pizzas de las que habla otro tipo de ejercicio. */
function ProjFracciones({ ex, uid, solo }: { ex: FichaExercise; uid: string; solo: boolean }) {
  const { t, lang } = useI18n();
  const fr = ex.fracciones ?? [];
  if (!fr.length) return null;
  const svg = (i: number, vacia = false) => fraccionSvg(fr[i], { cogidos: ex.cogidos, vacia, uid: `${uid}-${i}` });
  if (ex.tipo !== 'fracciones') {
    // Una sola pizza no lleva letra: el enunciado habla de «esta pizza»
    return <div className="cp-fr">{fr.map((_, i) => <span key={i} className="cp-fr-card">{fr.length > 1 && <b>{letraFraccion(i)}</b>}<Pizza svg={svg(i)} /></span>)}</div>;
  }
  const modo = ex.modo ?? 'leer';
  const decimal = !!ex.decimal && fr.every(tieneDecimalExacto);
  if (modo === 'unir' && fr.length >= 2) {
    const orden = ordenUnir(fr);
    // Un ejercicio por pantalla: las pizzas en fila, grandes para contar sus trozos, y los valores debajo
    if (solo) {
      return (
        <div className="cp-fr-unir-uno">
          <div className="cp-fr">{fr.map((_, i) => <span key={i} className="cp-fr-card"><b>{letraFraccion(i)}</b><Pizza svg={svg(i)} /></span>)}</div>
          <div className="cp-items">{orden.map((k, i) => <span key={i} className="cp-item"><b>{i + 1}.</b> {valorUnir(fr[k], decimal, lang)}</span>)}</div>
        </div>
      );
    }
    return (
      <div className="cp-two cp-fr-unir">
        <div>{fr.map((_, i) => <div key={i} className="cp-row"><b>{letraFraccion(i)}</b><Pizza svg={svg(i)} /></div>)}</div>
        <div>{orden.map((k, i) => <div key={i} className="cp-row"><b>{i + 1}.</b> {valorUnir(fr[k], decimal, lang)}</div>)}</div>
      </div>
    );
  }
  return (
    <div className="cp-fr">{fr.map((f, i) => (
      <span key={i} className="cp-fr-card">
        <b>{letraFraccion(i)}</b>
        <Pizza svg={svg(i, modo === 'colorear')} />
        {modo === 'colorear'
          ? <span className="cp-fr-lbl">{fraccionTexto(f)}</span>
          : <span className="cp-fr-resp" aria-label={t('Respuesta')}><span className="cp-frac"><i /><i className="raya" /><i /></span>{decimal && <><em>=</em><i className="dec" /></>}</span>}
      </span>
    ))}</div>
  );
}

/** La sopa de letras con sus letras, para rodear las palabras con el lápiz. */
function ProjSopa({ ex }: { ex: FichaExercise }) {
  const { t } = useI18n();
  const rej = ex.rejilla ?? [];
  if (!rej.length) return <div className="cp-note">📄 {t('Resuélvelo en tu hoja')}</div>;
  return (
    <div className="cp-rejilla-wrap">
      <div className="cp-sopa" style={{ gridTemplateColumns: `repeat(${rej[0]?.length ?? 1}, 1.6em)` }}>
        {rej.flatMap((fila, r) => fila.map((l, c) => <span key={`${r}-${c}`}>{l}</span>))}
      </div>
      {!!ex.palabras?.length && <div className="cp-items cp-sopa-palabras">{ex.palabras.map((p, i) => <span key={i} className="cp-item">{p}</span>)}</div>}
    </div>
  );
}

/** El crucigrama con sus casillas en blanco y las pistas. */
function ProjCrucigrama({ ex }: { ex: FichaExercise }) {
  const { t } = useI18n();
  const cw = ex.crucigrama;
  if (!cw?.entradas?.length) return <div className="cp-note">📄 {t('Resuélvelo en tu hoja')}</div>;
  const celdas = crosswordCells(cw);
  const pistas = [...cw.entradas].sort((a, b) => a.numero - b.numero || a.dir.localeCompare(b.dir));
  return (
    <div className="cp-rejilla-wrap">
      <div className="cp-cruci" style={{ gridTemplateColumns: `repeat(${cw.columnas}, 1.5em)` }}>
        {celdas.flatMap((fila, r) => fila.map((c, k) => (
          <span key={`${r}-${k}`} className={c ? 'casilla' : 'negra'}>{c?.numero ? <small>{c.numero}</small> : null}</span>
        )))}
      </div>
      <div className="cp-list cp-pistas">{pistas.map((e, i) => (
        <div key={i} className="cp-row"><b>{e.numero}{e.dir === 'H' ? '→' : '↓'}</b> {e.pista}</div>
      ))}</div>
    </div>
  );
}

export interface ProjExerciseProps {
  ex: FichaExercise;
  /** La marca del ejercicio, como en la hoja (1, 2… o A, B…); sin ella, el recuadro no sale. */
  n: number | string | null;
  /** Si se ve la solución. */
  showSol: boolean;
  color: string;
  /**
   * Un ejercicio por pantalla. La solución no va aquí: la enseña encima `ProyeccionEjercicios`, en una
   * franja que no ocupa sitio, para que no encoja la letra ni descoloque lo escrito con el lápiz. La
   * sopa de letras y el crucigrama se pintan enteros (en una sala de escape room se resuelven en la hoja),
   * y las pizzas de «unir» van en fila.
   */
  solo?: boolean;
  /** El texto de una comprensión lectora, debajo del enunciado («Rodea en el texto…»). */
  texto?: ReactNode;
  /** Para que los ids de las pizzas no choquen con los de otro ejercicio en pantalla. */
  uid?: string;
}

/** Un ejercicio en grande, para leerlo desde el fondo del aula. */
export function ProjExercise({ ex, n, showSol, color, solo = false, texto, uid = `p${n}` }: ProjExerciseProps) {
  const { t } = useI18n();
  const letra = (i: number) => String.fromCharCode(97 + i);
  const sol = (ex.solucion ?? '').trim();
  return (
    <div className="cp-ex">
      <div className="cp-ex-q">
        {n != null && <span className="cp-ex-n" style={{ background: color }}>{n}</span>}
        {ex.consigna && <img className="cp-consigna" src={urlPicto(ex.consigna)} alt="" />}
        <span className="cp-ex-txt">{ex.tipo === 'en_texto' && '🔍 '}{ex.enunciado}</span>
      </div>
      {texto}
      {/* Ficha con apoyos visuales: lo que hay que contar o reconocer, en grande */}
      {!!ex.imagenes?.length && (
        <div className="cp-dibujos">{dibujosEnOrden(ex.imagenes).map((id, i) => <img key={i} src={urlPicto(id)} alt="" />)}</div>
      )}
      <ProjDibujos ex={ex} />
      <ProjFracciones ex={ex} uid={uid} solo={solo} />
      {/* Un ejercicio por pantalla: la figura y sus opciones lado a lado, para que la figura crezca */}
      {ex.figura && solo && !!ex.opciones?.length ? (
        <div className="cp-fig-fila">
          <div className="cp-fig" dangerouslySetInnerHTML={{ __html: buildFigureSvg(ex.figura.forma, ex.figura.medidas, color) }} />
          <div className="cp-items cp-items-col">{ex.opciones.map((o, i) => <span key={i} className="cp-item"><b>{letra(i)})</b> {o}</span>)}</div>
        </div>
      ) : (
        <>
          {ex.figura && (
            <div className="cp-fig" dangerouslySetInnerHTML={{ __html: buildFigureSvg(ex.figura.forma, ex.figura.medidas, color) }} />
          )}
          {!!ex.opciones?.length && (
            <div className="cp-items">{ex.opciones.map((o, i) => <span key={i} className="cp-item"><b>{letra(i)})</b> {o}</span>)}</div>
          )}
        </>
      )}
      {!!ex.bancoPalabras?.length && (
        <div className="cp-items cp-banco">{ex.bancoPalabras.map((p, i) => <span key={i} className="cp-item">{p}</span>)}</div>
      )}
      {!!ex.afirmaciones?.length && (
        <div className="cp-list">{ex.afirmaciones.map((a, i) => <div key={i} className="cp-row">{a}<span className="cp-vf">{t('V')} / {t('F')}</span></div>)}</div>
      )}
      {ex.tipo === 'calculos' && !!ex.lineas?.length && (
        <div className="cp-list">{ex.lineas.map((l, i) => <div key={i} className="cp-row">{i + 1}. {l.replace(/[\s=_…]+$/u, '')} = …</div>)}</div>
      )}
      {ex.tipo === 'contestar' && !!ex.preguntas?.length && (
        <div className="cp-list">{ex.preguntas.map((p, i) => <div key={i} className="cp-row">{i + 1}. {p}</div>)}</div>
      )}
      {!!ex.elementos?.length && (
        <div className="cp-items">{ex.elementos.map((e, i) => <span key={i} className="cp-item">{e}</span>)}</div>
      )}
      {ex.tipo === 'relacionar' && !!ex.izquierda?.length && (
        <div className="cp-two">
          <div>{ex.izquierda.map((x, i) => (
            <div key={i} className="cp-row">{ex.dibujos?.[i]?.ilustracion ? <Ilus id={ex.dibujos[i].ilustracion} className="cp-rel-img" /> : null}{i + 1}. {x}</div>
          ))}</div>
          <div>{(ex.derecha ?? []).map((x, i) => <div key={i} className="cp-row">{letra(i).toUpperCase()}. {x}</div>)}</div>
        </div>
      )}
      {ex.tipo === 'tabla_rellenar' && !!ex.columnas?.length && (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead><tr>{!!ex.pictosFilas?.some(Boolean) && <th style={{ background: color }} />}{ex.columnas.map((c, i) => <th key={i} style={{ background: color, whiteSpace: solo && c.length <= 12 ? 'nowrap' : undefined }}>{c}</th>)}</tr></thead>
            <tbody>{(ex.filas ?? []).map((f, r) => (
              <tr key={r}>
                {!!ex.pictosFilas?.some(Boolean) && <td>{ex.pictosFilas[r] ? <img className="cp-picto-fila" src={urlPicto(ex.pictosFilas[r])} alt="" /> : null}</td>}
                {f.map((c, i) => <td key={i}>{c || '…'}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {ex.tipo === 'colorear' && (
        <div className="cp-items">
          {(ex.leyenda ?? []).map((l, i) => <span key={`l${i}`} className="cp-item">🎨 {l.color}: {l.criterio}</span>)}
          {(ex.itemsColorear ?? []).map((x, i) => <span key={i} className="cp-item">{x}</span>)}
        </div>
      )}
      {ex.tipo === 'comic' && !!ex.vinetas?.length && (
        <div className="cp-comic">
          {ex.vinetas.map((v, i) => (
            <div key={i} className="cp-panel">
              <div className={`cp-bubble${v.texto ? '' : ' empty'}`}>{v.texto || '…?'}</div>
              <div className="cp-who">{v.personaje}</div>
            </div>
          ))}
        </div>
      )}
      {ex.tipo === 'dibujar' && <div className="cp-dibujar" aria-hidden="true" />}
      {ex.tipo === 'sopa_letras' && (solo ? <ProjSopa ex={ex} /> : <div className="cp-note">📄 {t('Resuélvelo en tu hoja')}</div>)}
      {ex.tipo === 'crucigrama' && (solo ? <ProjCrucigrama ex={ex} /> : <div className="cp-note">📄 {t('Resuélvelo en tu hoja')}</div>)}
      {sol && !solo && showSol && <div className="cp-sol">✅ {sol}</div>}
    </div>
  );
}
