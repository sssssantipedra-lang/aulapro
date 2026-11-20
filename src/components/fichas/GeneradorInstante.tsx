/**
 * «Al instante (sin IA)»: el formulario de los cuatro generadores por código (`lib/fichaInstante.ts`).
 * Se elige la hoja en tarjetas, se dan sus datos (unas palabras, o unas operaciones y entre qué
 * números) y sale una ficha «Cuaderno» que se abre en el editor como cualquier otra. No hay clave,
 * ni espera, ni cupo: las cuentas y las soluciones las hace el código, y nada sale del dispositivo.
 */
import { useState, type ReactNode } from 'react';
import { Check, Zap } from 'lucide-react';
import { useI18n } from '../../i18n';
import {
  GENERADORES_INSTANTE, MAX_LETRAS_PALABRA, MAX_NUMERO, MAX_OPERACIONES, MAX_PALABRAS_CRUCIGRAMA, MAX_PALABRAS_SOPA, MIN_OPERACIONES,
  MIN_PALABRAS_CRUCIGRAMA, MIN_PALABRAS_SOPA, NOMBRE_OPERACION, OPERACIONES, FACTOR_MAX, FACTOR_MIN,
  fichaCrucigrama, fichaFracciones, fichaOperaciones, fichaSopa, palabrasDeTexto, pistasDeTexto, rangoSugerido, signoDe,
  type FichaInstante, type GeneradorInstante as Generador, type Operacion,
} from '../../lib/fichaInstante';
import { normalizeLetters } from '../../lib/wordSearch';

const GENERADOR: Record<Generador, { emoji: string; color: string; label: string; desc: string }> = {
  sopa: { emoji: '🔎', color: '#0ea5e9', label: 'Sopa de letras', desc: 'Escribes las palabras y la app monta la rejilla.' },
  crucigrama: { emoji: '🧩', color: '#8b5cf6', label: 'Crucigrama', desc: 'Cada palabra con su pista; los cruces los busca la app.' },
  operaciones: { emoji: '➕', color: '#f59e0b', label: 'Hoja de operaciones', desc: 'Sumas, restas, multiplicaciones y divisiones, de menos a más.' },
  fracciones: { emoji: '🍕', color: '#ec4899', label: 'Fracciones con pizzas', desc: 'Pizzas dibujadas con los trozos exactos: leer, colorear y unir.' },
};

interface Props {
  /** El curso escrito o el de la clase elegida: de él sale el rango de números que se propone. */
  nivel: string;
  onCrear: (r: FichaInstante) => void;
  /** Lo que falta para poder crear la hoja (un aviso corto). */
  avisar: (mensaje: string) => void;
  /** Lo que la pantalla pone entre el formulario y el botón (la clase y el área). */
  children?: ReactNode;
}

const entero = (v: string, min: number, max: number, defecto: number): number => {
  const n = Math.round(Number(v));
  return v.trim() !== '' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : defecto;
};

export function GeneradorInstante({ nivel, onCrear, avisar, children }: Props) {
  const { t, lang } = useI18n();
  const [gen, setGen] = useState<Generador>('operaciones');
  const [titulo, setTitulo] = useState('');
  const [conSolucionario, setConSolucionario] = useState(true);

  const [palabras, setPalabras] = useState('');
  const [pistas, setPistas] = useState('');

  const [ops, setOps] = useState<Operacion[]>(['suma', 'resta']);
  const [sugerido] = useState(() => rangoSugerido(nivel));
  // Como texto, para poder borrar el número y escribir otro sin que salte a 0
  const [min, setMin] = useState(String(sugerido.min));
  const [max, setMax] = useState(String(sugerido.max));
  const [cantidad, setCantidad] = useState('18');
  const [sinLlevadas, setSinLlevadas] = useState(false);
  const [respuesta, setRespuesta] = useState<'caja' | 'linea'>('caja');

  const [figuras, setFiguras] = useState(4);
  const [decimal, setDecimal] = useState(false);

  const listaPalabras = palabrasDeTexto(palabras);
  const largas = listaPalabras.filter(p => normalizeLetters(p).length > MAX_LETRAS_PALABRA);
  const leidas = pistasDeTexto(pistas);

  const alternar = (o: Operacion) => setOps(l => (l.includes(o) ? l.filter(x => x !== o) : OPERACIONES.filter(x => x === o || l.includes(x))));

  function crear() {
    let r: FichaInstante | null;
    if (gen === 'sopa') {
      if (listaPalabras.length < MIN_PALABRAS_SOPA) { avisar(t('Escribe al menos {n} palabras para la sopa de letras.', { n: MIN_PALABRAS_SOPA })); return; }
      r = fichaSopa({ titulo, palabras: listaPalabras }, t);
    } else if (gen === 'crucigrama') {
      if (leidas.pistas.length < MIN_PALABRAS_CRUCIGRAMA) { avisar(t('Escribe al menos {n} palabras con su pista, así: «sol: estrella que nos da luz».', { n: MIN_PALABRAS_CRUCIGRAMA })); return; }
      r = fichaCrucigrama({ titulo, pistas: leidas.pistas }, t);
      if (r.content.actividades[0].ejercicios[0].crucigrama!.entradas.length < 2) { avisar(t('Esas palabras no comparten ninguna letra: no se pueden cruzar. Cambia alguna.')); return; }
    } else if (gen === 'operaciones') {
      if (!ops.length) { avisar(t('Elige al menos una operación.')); return; }
      r = fichaOperaciones({
        titulo, operaciones: ops, min: entero(min, 0, MAX_NUMERO, sugerido.min), max: entero(max, 0, MAX_NUMERO, sugerido.max),
        cantidad: entero(cantidad, MIN_OPERACIONES, MAX_OPERACIONES, 18), sinLlevadas, respuesta,
      }, t, lang);
      if (!r) { avisar(t('Entre esos números no sale ninguna operación. Amplía el rango.')); return; }
    } else {
      r = fichaFracciones({ titulo, figuras, decimal }, t, lang);
    }
    onCrear({ ...r, content: { ...r.content, ...(conSolucionario ? { solucionario: true } : {}) } });
  }

  const conColumnas = ops.includes('suma') || ops.includes('resta');
  const hayFactor = ops.includes('multiplicacion') || ops.includes('division');

  return (
    <div className="fsi-gen">
      <div className="ev-cards fe-tipos fsi-gens" role="radiogroup" aria-label={t('Qué hoja quieres')}>
        {GENERADORES_INSTANTE.map(g => {
          const x = GENERADOR[g];
          return (
            <button
              key={g} type="button" role="radio" aria-checked={gen === g}
              className={`ev-card fe-tipo${gen === g ? ' sel' : ''}`} style={{ '--ev-c': x.color } as React.CSSProperties}
              onClick={() => setGen(g)}
            >
              <span className="ev-card-ico fsi-emoji" aria-hidden="true">{x.emoji}</span>
              <span className="ev-card-ttl">{t(x.label)}</span>
              <span className="ev-card-txt">{t(x.desc)}</span>
              {gen === g && <span className="ev-card-ft"><span className="ev-card-go"><Check size={15} />{t('Elegida')}</span></span>}
            </button>
          );
        })}
      </div>

      <div className="fsi-form">
        {gen === 'sopa' && (
          <div className="fgroup">
            <label className="flabel" htmlFor="fsi-palabras">{t('Palabras')} <em className="fsi-cuenta">{t('{n} palabras', { n: listaPalabras.length })}</em></label>
            <textarea
              id="fsi-palabras" className="finput" rows={6} value={palabras} onChange={e => setPalabras(e.target.value)}
              placeholder={t('Una por línea o separadas por comas: raíz, tallo, hoja, flor, fruto, semilla')}
            />
            <p className="fe-hint">{t('De {min} a {max} palabras. Las tildes se quitan en la rejilla y la ñ se conserva; las palabras van siempre hacia delante, nunca al revés.', { min: MIN_PALABRAS_SOPA, max: MAX_PALABRAS_SOPA })}</p>
            {listaPalabras.length > MAX_PALABRAS_SOPA && <p className="fsi-aviso">{t('Solo entran las {n} primeras.', { n: MAX_PALABRAS_SOPA })}</p>}
            {largas.length > 0 && <p className="fsi-aviso">{t('Demasiado largas para la rejilla (más de {n} letras): {lista}', { n: MAX_LETRAS_PALABRA, lista: largas.join(', ') })}</p>}
          </div>
        )}

        {gen === 'crucigrama' && (
          <div className="fgroup">
            <label className="flabel" htmlFor="fsi-pistas">{t('Palabra: pista')} <em className="fsi-cuenta">{t('{n} palabras', { n: leidas.pistas.length })}</em></label>
            <textarea
              id="fsi-pistas" className="finput" rows={7} value={pistas} onChange={e => setPistas(e.target.value)}
              placeholder={t('Una por línea:\nsol: estrella que nos da luz\nluna: satélite de la Tierra\nplaneta: gira alrededor de una estrella')}
            />
            <p className="fe-hint">{t('De {min} a {max} palabras, cada una con su pista detrás de dos puntos. La que no comparta ninguna letra con las demás se queda fuera, y se te dice.', { min: MIN_PALABRAS_CRUCIGRAMA, max: MAX_PALABRAS_CRUCIGRAMA })}</p>
            {leidas.sinPista.length > 0 && <p className="fsi-aviso">{t('Sin pista, no entran: {lista}', { lista: leidas.sinPista.join(', ') })}</p>}
          </div>
        )}

        {gen === 'operaciones' && (
          <>
            <div className="fgroup">
              <span className="flabel">{t('Operaciones')}</span>
              <div className="fe-generos" role="group" aria-label={t('Operaciones')}>
                {OPERACIONES.map(o => (
                  <button key={o} type="button" aria-pressed={ops.includes(o)} className={`fe-genero${ops.includes(o) ? ' on' : ''}`} onClick={() => alternar(o)}>
                    <b className="fsi-signo" aria-hidden="true">{signoDe(o, lang)}</b> {t(NOMBRE_OPERACION[o])}
                  </button>
                ))}
              </div>
            </div>
            <div className="fsi-fila">
              <div className="fgroup">
                <label className="flabel" htmlFor="fsi-min">{t('Números del')}</label>
                <input id="fsi-min" className="finput" type="number" inputMode="numeric" min={0} max={MAX_NUMERO} value={min} onChange={e => setMin(e.target.value)} />
              </div>
              <div className="fgroup">
                <label className="flabel" htmlFor="fsi-max">{t('al')}</label>
                <input id="fsi-max" className="finput" type="number" inputMode="numeric" min={0} max={MAX_NUMERO} value={max} onChange={e => setMax(e.target.value)} />
              </div>
              <div className="fgroup">
                <label className="flabel" htmlFor="fsi-cantidad">{t('Cuántas operaciones')}</label>
                <input id="fsi-cantidad" className="finput" type="number" inputMode="numeric" min={MIN_OPERACIONES} max={MAX_OPERACIONES} value={cantidad} onChange={e => setCantidad(e.target.value)} />
              </div>
              <div className="fgroup">
                <label className="flabel" htmlFor="fsi-respuesta">{t('La respuesta se escribe en')}</label>
                <select id="fsi-respuesta" className="finput" value={respuesta} onChange={e => setRespuesta(e.target.value === 'linea' ? 'linea' : 'caja')}>
                  <option value="caja">{t('Una caja')}</option>
                  <option value="linea">{t('Una línea')}</option>
                </select>
              </div>
            </div>
            {conColumnas && (
              <label className="fe-check">
                <input type="checkbox" checked={sinLlevadas} onChange={e => setSinLlevadas(e.target.checked)} />
                {t('Sin llevadas: sumas sin llevar y restas sin pedir prestado')}
              </label>
            )}
            <p className="fe-hint">
              {t('De {min} a {max} operaciones, repartidas en tres bloques de menos a más: primero las de números pequeños y sin llevadas.', { min: MIN_OPERACIONES, max: MAX_OPERACIONES })}
              {hayFactor && ` ${t('En las multiplicaciones, el primer número sale de ese rango y el segundo va del {a} al {b}. Las divisiones son exactas, entre un número del {a} al {b}.', { a: FACTOR_MIN, b: FACTOR_MAX })}`}
            </p>
          </>
        )}

        {gen === 'fracciones' && (
          <>
            <div className="fsi-fila">
              <div className="fgroup">
                <label className="flabel" htmlFor="fsi-figuras">{t('Pizzas en cada ejercicio')}</label>
                <select id="fsi-figuras" className="finput" value={figuras} onChange={e => setFiguras(Number(e.target.value) === 3 ? 3 : 4)}>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
            </div>
            <label className="fe-check">
              <input type="checkbox" checked={decimal} onChange={e => setDecimal(e.target.checked)} />
              {t('En el último bloque, unir cada pizza con su decimal')}
            </label>
            <p className="fe-hint">{t('Tres bloques de menos a más: escribir la fracción de cada pizza, colorear los trozos que dice la fracción y unir cada pizza con su valor. Las pizzas las dibuja la app con los trozos exactos.')}</p>
          </>
        )}

        <div className="fgroup">
          <label className="flabel" htmlFor="fsi-titulo">{t('Título (opcional)')}</label>
          <input id="fsi-titulo" className="finput" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={t(GENERADOR[gen].label)} />
        </div>

        {children}

        <label className="fe-check">
          <input type="checkbox" checked={conSolucionario} onChange={e => setConSolucionario(e.target.checked)} />
          {t('Con el solucionario en una página aparte, para ti')}
        </label>
      </div>

      <div className="fe-crear">
        <button type="button" className="btn-accent fe-crear-btn" onClick={crear}>
          <Zap size={15} />{t('Crear al instante')}
        </button>
        <span className="fe-hint">{t('Sin IA: lo monta la app en tu dispositivo y después lo retocas en el editor.')}</span>
      </div>
    </div>
  );
}
