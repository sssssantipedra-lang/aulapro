/**
 * La vista previa de pegar notas en el cuaderno (22-11-2026): antes de escribir nada, enseña qué celda recibe cada
 * nota, lo que pisa y lo que no entra. La cuenta es de `lib/pegarNotas.ts`.
 *
 * Desde el 24-11-2026, si la hoja trae los nombres, cada nota va al alumno que se llama así: las filas que no se
 * parecen a nadie, o que se parecen igual a dos, salen aparte y el docente elige a quién van; las que solo se
 * parecen (una errata, el nombre de pila) se marcan con ≈ y hay que confirmarlas. Sin nombres se coloca por orden
 * de lista, y hay que confirmar que la hoja está en ese orden.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { entenderPegado, leerNota, planDePegado, type CambioDeNota, type CeldaDelPlan, type DondePegar } from '../../lib/pegarNotas';

interface Props {
  /** Lo que venía en el portapapeles, ya partido en filas y columnas (`leerPegado`). */
  filas: string[][];
  donde: DondePegar;
  onAplicar: (cambios: CambioDeNota[]) => void;
  onClose: () => void;
}

export function VistaPreviaPegado({ filas, donde, onAplicar, onClose }: Props) {
  const { t, lang } = useI18n();
  /** Lo que el docente dice de la primera fila; sin decir nada, lo que parezca. */
  const [cabecera, setCabecera] = useState<boolean | undefined>(undefined);
  /** Las filas de la hoja que el docente ha colocado él (fila → alumno). */
  const [aMano, setAMano] = useState<Record<number, string>>({});
  /** Si el docente ha confirmado el orden de su hoja (sin nombres) o los nombres que solo se parecen. */
  const [comprobado, setComprobado] = useState(false);
  const pegado = useMemo(() => entenderPegado(filas, { cabecera }), [filas, cabecera]);
  const plan = useMemo(() => planDePegado(pegado, donde, aMano), [pegado, donde, aMano]);
  const nombreDe = useMemo(() => new Map(donde.alumnado.map(a => [a.id, a.name])), [donde.alumnado]);
  const primeraConTexto = useMemo(() => (filas[0] ?? []).some(x => leerNota(x).tipo === 'mal'), [filas]);
  const nota = (n: number | null) => (n === null ? '' : lang !== 'en' ? String(n).replace('.', ',') : String(n));

  // Al abrirse, el foco pasa a la ventana. Si se quedara en la celda sobre la que se pegó, lo que se tecleara con
  // la vista previa delante (un Intro para aceptar, una cifra) caería en el cuaderno de debajo: cambiaría notas que
  // aquí se dice que no cambian, y sin «Deshacer» (23-11-2026)
  const caja = useRef<HTMLDivElement>(null);
  const hayPlan = plan !== null;
  useEffect(() => { if (hayPlan) caja.current?.focus({ preventScroll: true }); }, [hayPlan]);

  if (!plan) return null;
  const total = plan.cambios.length;
  const una = total === 1;
  const primerAlumno = plan.filas[0]?.nombre ?? '';
  const primeraActividad = plan.columnas[0]?.nombre ?? '';
  const variasColumnas = plan.columnas.length > 1;
  const sinColumnas = plan.columnas.length === 0;
  const porNombre = plan.modo === 'nombre';
  // Lo que hay que confirmar antes de poner nada: el orden, si se coloca por posición y hay más de una fila; los
  // nombres que solo se parecen, si se coloca por nombre
  const hayQueConfirmar = !sinColumnas && total > 0 && (porNombre ? plan.aproximadas > 0 || plan.pareceOtroGrupo : plan.filas.length > 1);
  const ningunoCoincide = !porNombre && !!pegado.etiquetas && plan.filas.length > 0 && plan.descuadradas === plan.filas.length;
  const cambiarCabecera = (v: boolean) => { setCabecera(v); setAMano({}); setComprobado(false); };
  const colocar = (fila: number, alumnoId: string) => {
    setAMano(m => {
      const out = { ...m };
      if (alumnoId) out[fila] = alumnoId; else delete out[fila];
      return out;
    });
  };
  const motivo = (f: (typeof plan.sinColocar)[number]) => {
    if (f.motivo === 'nadie') return f.etiqueta.trim() ? t('No se parece a nadie de la clase') : t('Sin nombre en tu hoja');
    const nombres = f.candidatos.map(id => nombreDe.get(id) ?? '').filter(Boolean).join(', ');
    return f.motivo === 'varios' ? t('Se parece a {nombres}', { nombres }) : t('Otra fila de tu hoja también es de {nombre}', { nombre: nombres });
  };
  const noEstan = plan.noEstan.slice(0, 5).map(a => a.nombre).join(', ') + (plan.noEstan.length > 5 ? '…' : '');

  const celda = (c: CeldaDelPlan) => {
    if (c.estado === 'mal') return <span className="pn-c pn-mal" title={t('No es una nota de 0 a 10: no entra')}>{c.texto}</span>;
    if (c.estado === 'vacia') return <span className="pn-c pn-igual" title={t('Tu hoja no trae nada aquí: se queda como está')}>{c.antes === null ? '·' : nota(c.antes)}</span>;
    if (c.estado === 'igual') return <span className="pn-c pn-igual" title={t('Ya tenía esta nota')}>{nota(c.valor)}</span>;
    if (c.estado === 'cambia') {
      return (
        <span className="pn-c pn-cambia" title={t('Cambia la nota que ya estaba')}>
          <s>{nota(c.antes)}</s><span aria-hidden="true"> → </span><span className="sr-only">{t('pasa a')} </span><strong>{nota(c.valor)}</strong>
        </span>
      );
    }
    return <span className="pn-c pn-nueva" title={t('Nota nueva')}><strong>{nota(c.valor)}</strong></span>;
  };

  return (
    <Modal open onClose={onClose} wide stickyHeader title={<span className="mk-ttl"><ClipboardPaste size={17} color="var(--accent-d)" />{t('Pegar notas: revisa antes de poner nada')}</span>}>
      <div className="pn-previa" ref={caja} tabIndex={-1}>
        <p className="pn-como">
          {sinColumnas
            ? t('Lo que has pegado no trae ninguna columna de notas.')
            : porNombre
              ? (variasColumnas
                ? t('Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma. La primera columna va a «{actividad}» y sigue hacia la derecha.', { actividad: primeraActividad })
                : t('Cada nota va al alumno que se llama así en tu hoja, aunque esté en otro orden o escrito de otra forma, en «{actividad}».', { actividad: primeraActividad }))
            : variasColumnas
              ? t('Se coloca por orden, no por nombre: la primera fila va a {alumno} y sigue hacia abajo; la primera columna va a «{actividad}» y sigue hacia la derecha.', { alumno: primerAlumno, actividad: primeraActividad })
              : t('Se coloca por orden, no por nombre: la primera fila va a {alumno}, en «{actividad}», y sigue hacia abajo.', { alumno: primerAlumno, actividad: primeraActividad })}
        </p>

        {!sinColumnas && (
          <ul className="pn-resumen" aria-label={t('Lo que va a pasar')}>
            {(plan.nuevas > 0 || plan.cambian === 0) && <li className={plan.nuevas > 0 ? 'pn-nueva' : 'pn-nada'}><strong>{plan.nuevas}</strong> {t(plan.nuevas === 1 ? 'nota nueva' : 'notas nuevas')}</li>}
            {/* Lo que pisa se dice siempre, también cuando es cero: es lo que el docente quiere saber antes de aplicar */}
            <li className={plan.cambian > 0 ? 'pn-cambia' : 'pn-nada'}><strong>{plan.cambian}</strong> {t(plan.cambian === 1 ? 'cambia una nota que ya estaba' : 'cambian una nota que ya estaba')}</li>
            {plan.mal > 0 && <li className="pn-mal"><strong>{plan.mal}</strong> {t(plan.mal === 1 ? 'no es una nota de 0 a 10 y no entra' : 'no son notas de 0 a 10 y no entran')}</li>}
            {plan.iguales > 0 && <li className="pn-nada"><strong>{plan.iguales}</strong> {t(plan.iguales === 1 ? 'ya tenía esa nota' : 'ya tenían esa nota')}</li>}
          </ul>
        )}

        {/* Sin ninguna columna de notas no hay nada que colocar: sobran los avisos de orden */}
        {!sinColumnas && (plan.descuadradas > 0 || plan.filasQueSobran > 0 || plan.columnasQueSobran > 0
          || plan.sinColocar.length > 0 || plan.aproximadas > 0 || plan.noEstan.length > 0 || (!porNombre && plan.filas.length > 1)) && (
          <ul className="pn-avisos" role="alert">
            {!porNombre && !pegado.etiquetas && plan.filas.length > 1 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {t('Tu hoja no trae los nombres: las notas se colocan en el orden de la lista del cuaderno. Si copias también la columna de los nombres, cada nota irá a su alumno.')}
              </li>
            )}
            {ningunoCoincide && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {t('Ningún nombre de tu hoja coincide con el alumnado de esta clase: ¿es la hoja de otro grupo? Si sigues, las notas se colocan por orden.')}
              </li>
            )}
            {plan.pareceOtroGrupo && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {t('La mitad de las filas de tu hoja o más no son de nadie de esta clase: ¿es la hoja de otro grupo? Comprueba que las notas que se colocan son de tu alumnado.')}
              </li>
            )}
            {plan.sinColocar.length > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.sinColocar.length === 1
                  ? t('1 fila de tu hoja no se coloca: elige abajo a quién va o se quedará sin poner.')
                  : t('{n} filas de tu hoja no se colocan: elige abajo a quién van o se quedarán sin poner.', { n: plan.sinColocar.length })}
              </li>
            )}
            {plan.aproximadas > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.aproximadas === 1
                  ? t('1 nombre de tu hoja se parece al del alumno, pero no es igual (marcado con ≈): compruébalo.')
                  : t('{n} nombres de tu hoja se parecen al del alumno, pero no son iguales (marcados con ≈): compruébalos.', { n: plan.aproximadas })}
              </li>
            )}
            {plan.noEstan.length > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.noEstan.length === 1
                  ? t('1 alumno de la clase no está en tu hoja ({nombres}): su nota se queda como está.', { nombres: noEstan })
                  : t('{n} alumnos de la clase no están en tu hoja ({nombres}): sus notas se quedan como están.', { n: plan.noEstan.length, nombres: noEstan })}
              </li>
            )}
            {!ningunoCoincide && plan.descuadradas > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.descuadradas === 1
                  ? t('1 nombre de tu hoja no coincide con el alumno de su fila (marcado con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.')
                  : t('{n} nombres de tu hoja no coinciden con el alumno de su fila (marcados con ≠). Puede que tu hoja no esté en el orden de la lista: compruébalo antes de seguir.', { n: plan.descuadradas })}
              </li>
            )}
            {plan.filasQueSobran > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.filasQueSobran === 1
                  ? t('Sobra 1 fila: tu hoja trae más filas que alumnos quedan desde {alumno}. No entra.', { alumno: primerAlumno })
                  : t('Sobran {n} filas: tu hoja trae más filas que alumnos quedan desde {alumno}. No entran.', { n: plan.filasQueSobran, alumno: primerAlumno })}
              </li>
            )}
            {plan.columnasQueSobran > 0 && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.columnasQueSobran === 1
                  ? t('Sobra 1 columna: no hay más actividades a la derecha de «{actividad}». No entra.', { actividad: plan.columnas[plan.columnas.length - 1].nombre })
                  : t('Sobran {n} columnas: no hay más actividades a la derecha de «{actividad}». No entran.', { n: plan.columnasQueSobran, actividad: plan.columnas[plan.columnas.length - 1].nombre })}
              </li>
            )}
          </ul>
        )}

        {/* Solo se pregunta por la cabecera si la primera fila trae algo que no es una nota (o si ya se ha tocado la casilla) */}
        {filas.length > 1 && (cabecera !== undefined || pegado.pareceCabecera || primeraConTexto) && (
          <label className="pn-cabecera">
            <input type="checkbox" checked={pegado.cabecera} onChange={e => cambiarCabecera(e.target.checked)} />
            <span>
              {t('La primera fila es la cabecera de mi hoja: no es de ningún alumno')}
              {pegado.pareceCabecera && cabecera === undefined && <small>{t('Se ha marcado sola porque esa fila no trae ninguna nota y las de debajo sí.')}</small>}
            </span>
          </label>
        )}
        {!sinColumnas && (pegado.numeroDeLista || pegado.etiquetas) && (
          <p className="sda-note pn-apartado">
            {pegado.numeroDeLista && t('La columna con el número de lista (1, 2, 3…) no se cuenta como nota.') + ' '}
            {pegado.etiquetas && !porNombre && t('Los nombres de tu hoja salen junto a cada alumno para que compruebes el orden; no se usan para colocar las notas.')}
          </p>
        )}

        {!sinColumnas && plan.filas.length > 0 && (
          <div className="pn-tabla-caja">
            <table className="pn-tabla">
              <thead>
                <tr>
                  <th scope="col">{t('Alumno')}</th>
                  {pegado.etiquetas && <th scope="col">{t('En tu hoja')}</th>}
                  {plan.columnas.map(c => (
                    <th scope="col" key={c.id}>
                      {c.nombre}
                      {c.titulo && <small title={t('Cómo se llama esta columna en tu hoja')}>{t('En tu hoja')}: {c.titulo}</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.filas.map(f => (
                  <tr key={f.alumnoId} className={f.descuadra ? 'pn-fila-mal' : f.parecido === 'aproximado' ? 'pn-fila-aprox' : undefined}>
                    <th scope="row">{f.nombre}</th>
                    {pegado.etiquetas && (
                      <td className="pn-etiqueta">
                        {f.descuadra && <span className="pn-distinto" title={t('No coincide con el alumno de esta fila')}>≠</span>}
                        {f.parecido === 'aproximado' && <span className="pn-distinto" title={t('Se parece, pero no es igual: compruébalo')}>≈</span>}
                        {f.etiqueta ?? ''}
                        {f.parecido === 'a mano' && (
                          <button type="button" className="pn-quitar" onClick={() => colocar(f.fila, '')} title={t('Quitar: esta fila se queda sin colocar')}>
                            {t('elegido por ti')} <span aria-hidden="true">×</span>
                          </button>
                        )}
                      </td>
                    )}
                    {f.celdas.map((c, k) => <td key={plan.columnas[k].id}>{celda(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!sinColumnas && plan.sinColocar.length > 0 && (
          <div className="pn-sin">
            <h3>{t('Sin colocar')}</h3>
            <ul>
              {plan.sinColocar.map(f => (
                <li key={f.fila}>
                  <span className="pn-sin-hoja">
                    <strong>{f.etiqueta || t('(sin nombre)')}</strong>
                    <small>{motivo(f)}{f.textos.some(Boolean) ? ` · ${f.textos.filter(Boolean).join(' · ')}` : ''}</small>
                  </span>
                  <select aria-label={t('A quién va la fila «{nombre}»', { nombre: f.etiqueta })} value="" onChange={e => colocar(f.fila, e.target.value)}>
                    <option value="">{t('Sin poner')}</option>
                    {plan.noEstan.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hayQueConfirmar && (
          <label className="pn-cabecera pn-confirmar">
            <input type="checkbox" checked={comprobado} onChange={e => setComprobado(e.target.checked)} />
            <span>
              {porNombre
                ? (plan.pareceOtroGrupo ? t('He comprobado que las notas que se colocan son de mi alumnado') : t('He comprobado los nombres marcados con ≈'))
                : t('He comprobado que mi hoja está en el mismo orden que la lista del cuaderno')}
            </span>
          </label>
        )}

        <p className="sda-note">
          {t('Una celda vacía de tu hoja no borra la nota que ya estaba. Después de poner las notas tendrás unos segundos para deshacerlo.')}
        </p>
        <div className="pn-pie">
          <button type="button" className="btn-accent" disabled={total === 0 || (hayQueConfirmar && !comprobado)} onClick={() => onAplicar(plan.cambios)}>
            {total === 0 ? t('No hay nada que poner') : t(una ? 'Poner 1 nota' : 'Poner {n} notas', { n: total })}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        </div>
      </div>
    </Modal>
  );
}
