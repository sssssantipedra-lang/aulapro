/**
 * La vista previa de pegar notas en el cuaderno (22-11-2026): antes de escribir nada, enseña qué celda recibe cada
 * nota, lo que pisa y lo que no entra. Es obligatoria porque lo pegado se casa por posición y no por nombre: si
 * la hoja del docente no está en el orden de la lista, aquí es donde se ve. La cuenta es de `lib/pegarNotas.ts`.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { entenderPegado, planDePegado, type CambioDeNota, type CeldaDelPlan, type DondePegar } from '../../lib/pegarNotas';

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
  const pegado = useMemo(() => entenderPegado(filas, { cabecera }), [filas, cabecera]);
  const plan = useMemo(() => planDePegado(pegado, donde), [pegado, donde]);
  const nota = (n: number | null) => (n === null ? '' : lang !== 'en' ? String(n).replace('.', ',') : String(n));

  if (!plan) return null;
  const total = plan.cambios.length;
  const una = total === 1;
  const primerAlumno = plan.filas[0]?.nombre ?? '';
  const primeraActividad = plan.columnas[0]?.nombre ?? '';
  const variasColumnas = plan.columnas.length > 1;
  const sinColumnas = plan.columnas.length === 0;

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
      <div className="pn-previa">
        <p className="pn-como">
          {sinColumnas
            ? t('Lo que has pegado no trae ninguna columna de notas.')
            : variasColumnas
              ? t('Se coloca por orden, no por nombre: la primera fila va a {alumno} y sigue hacia abajo; la primera columna va a «{actividad}» y sigue hacia la derecha.', { alumno: primerAlumno, actividad: primeraActividad })
              : t('Se coloca por orden, no por nombre: la primera fila va a {alumno}, en «{actividad}», y sigue hacia abajo.', { alumno: primerAlumno, actividad: primeraActividad })}
        </p>

        {!sinColumnas && (
          <ul className="pn-resumen" aria-label={t('Lo que va a pasar')}>
            <li className="pn-nueva"><strong>{plan.nuevas}</strong> {t(plan.nuevas === 1 ? 'nota nueva' : 'notas nuevas')}</li>
            <li className={plan.cambian > 0 ? 'pn-cambia' : 'pn-nada'}><strong>{plan.cambian}</strong> {t(plan.cambian === 1 ? 'cambia una nota que ya estaba' : 'cambian una nota que ya estaba')}</li>
            {plan.mal > 0 && <li className="pn-mal"><strong>{plan.mal}</strong> {t(plan.mal === 1 ? 'no es una nota de 0 a 10 y no entra' : 'no son notas de 0 a 10 y no entran')}</li>}
            {plan.iguales > 0 && <li className="pn-nada"><strong>{plan.iguales}</strong> {t(plan.iguales === 1 ? 'ya tenía esa nota' : 'ya tenían esa nota')}</li>}
          </ul>
        )}

        {(plan.descuadradas > 0 || plan.filasQueSobran > 0 || plan.columnasQueSobran > 0) && (
          <ul className="pn-avisos" role="alert">
            {plan.descuadradas > 0 && (
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
            {plan.columnasQueSobran > 0 && !sinColumnas && (
              <li><AlertTriangle size={14} aria-hidden="true" />
                {plan.columnasQueSobran === 1
                  ? t('Sobra 1 columna: no hay más actividades a la derecha de «{actividad}». No entra.', { actividad: plan.columnas[plan.columnas.length - 1].nombre })
                  : t('Sobran {n} columnas: no hay más actividades a la derecha de «{actividad}». No entran.', { n: plan.columnasQueSobran, actividad: plan.columnas[plan.columnas.length - 1].nombre })}
              </li>
            )}
          </ul>
        )}

        {filas.length > 1 && (
          <label className="pn-cabecera">
            <input type="checkbox" checked={pegado.cabecera} onChange={e => setCabecera(e.target.checked)} />
            <span>
              {t('La primera fila es la cabecera de mi hoja: no es de ningún alumno')}
              {pegado.pareceCabecera && cabecera === undefined && <small>{t('Se ha marcado sola porque esa fila no trae ninguna nota y las de debajo sí.')}</small>}
            </span>
          </label>
        )}
        {(pegado.numeroDeLista || pegado.etiquetas) && (
          <p className="sda-note pn-apartado">
            {pegado.numeroDeLista && t('La columna con el número de lista (1, 2, 3…) no se cuenta como nota.') + ' '}
            {pegado.etiquetas && t('Los nombres de tu hoja salen junto a cada alumno para que compruebes el orden; no se usan para colocar las notas.')}
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
                  <tr key={f.alumnoId} className={f.descuadra ? 'pn-fila-mal' : undefined}>
                    <th scope="row">{f.nombre}</th>
                    {pegado.etiquetas && (
                      <td className="pn-etiqueta">
                        {f.descuadra && <span className="pn-distinto" title={t('No coincide con el alumno de esta fila')}>≠</span>}
                        {f.etiqueta ?? ''}
                      </td>
                    )}
                    {f.celdas.map((c, k) => <td key={plan.columnas[k].id}>{celda(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="sda-note">
          {t('Una celda vacía de tu hoja no borra la nota que ya estaba. Después de poner las notas tendrás unos segundos para deshacerlo.')}
        </p>
        <div className="pn-pie">
          <button type="button" className="btn-accent" disabled={total === 0} onClick={() => onAplicar(plan.cambios)}>
            {total === 0 ? t('No hay nada que poner') : t(una ? 'Poner 1 nota' : 'Poner {n} notas', { n: total })}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        </div>
      </div>
    </Modal>
  );
}
