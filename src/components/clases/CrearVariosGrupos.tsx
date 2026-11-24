import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { Class } from '../../types';
import type { Etapa } from '../../lib/curriculum';
import type { ComunidadId } from '../../lib/curriculum/comunidades';
import { materiasDelCurso } from '../../lib/curriculum/materiasDeClase';
import { useCurriculo } from '../../hooks/useCurriculo';
import { useI18n } from '../../i18n';
import {
  CURSOS_DE_ETAPA, MAX_GRUPOS, claseDeGrupo, esOficialEnCurso, gruposACrear, gruposPrevistos, leerLetras,
} from '../../lib/variosGrupos';

interface Props {
  /** Las clases que ya hay: lo que exista no se duplica. */
  classes: Class[];
  comunidad?: ComunidadId;
  /** Los colores de las clases, los mismos del formulario de una sola. */
  palette: readonly string[];
  nuevoId: () => string;
  onCrear: (clases: Class[]) => void;
  onCancelar: () => void;
}

/**
 * «Crear varios grupos» (20-11-2026): etapa, cursos, letras y una asignatura, con la lista de lo que se va a
 * crear a la vista antes de crearlo. La cuenta está en `lib/variosGrupos.ts`; aquí, solo el formulario, que va
 * dentro de la ventana de «Nueva clase» (`pages/ClassesManager.tsx`).
 */
export function CrearVariosGrupos({ classes, comunidad, palette, nuevoId, onCrear, onCancelar }: Props) {
  const { t } = useI18n();
  // De partida, la etapa de la que el docente ya tiene más clases
  const [etapa, setEtapa] = useState<Etapa | ''>(() => {
    const n = (e: Etapa) => classes.filter(c => c.etapa === e).length;
    return n('primaria') === 0 && n('eso') === 0 ? '' : n('eso') > n('primaria') ? 'eso' : 'primaria';
  });
  const [cursos, setCursos] = useState<number[]>([]);
  const [letras, setLetras] = useState('A');
  const [asignatura, setAsignatura] = useState('');
  const [otra, setOtra] = useState('');

  const curriculo = useCurriculo(comunidad, etapa);
  const todos = etapa ? Array.from({ length: CURSOS_DE_ETAPA[etapa] }, (_, i) => i + 1) : [];
  /** Las materias oficiales de los cursos marcados (o de toda la etapa, si aún no hay ninguno), en el orden del decreto. */
  const materias = etapa && curriculo
    ? curriculo.materias
      .filter(m => (cursos.length ? cursos : todos).some(c => materiasDelCurso({ etapa, curso: c }, curriculo.materias).includes(m.nombre)))
      .map(m => m.nombre)
    : [];
  // Una materia marcada que ya no es de ningún curso elegido deja de contar (su ficha ya no está a la vista)
  const elegida = otra.trim() || (materias.includes(asignatura) ? asignatura : '');

  const previstos = etapa ? gruposPrevistos(etapa, cursos, leerLetras(letras), classes) : [];
  const nuevos = gruposACrear(previstos);
  const yaExisten = previstos.filter(g => g.existe);
  const sobran = previstos.filter(g => !g.existe).length - nuevos.length;
  /** Cursos en los que la asignatura elegida no es una materia oficial: se crean igual, en modo libre, y se dice. */
  const sinCurriculo = etapa && curriculo && elegida && !otra.trim()
    ? [...new Set(nuevos.map(g => g.curso))].filter(c => !esOficialEnCurso(elegida, etapa, c, curriculo.materias))
    : [];

  function crear() {
    if (!etapa || !curriculo || !elegida || nuevos.length === 0) return;
    onCrear(nuevos.map(g => claseDeGrupo(g, etapa, elegida, curriculo.materias, {
      id: nuevoId(), color: palette[(g.curso - 1) % palette.length],
    })));
  }

  const alternarCurso = (c: number) => setCursos(l => (l.includes(c) ? l.filter(x => x !== c) : [...l, c]));

  return (
    <div className="vg">
      <p className="vg-nota">
        {t('Para cuando das la misma asignatura a muchos grupos. Elige la etapa, marca los cursos, escribe las letras y verás abajo la lista de clases antes de crearlas. Después podrás cambiar cualquiera de ellas.')}
      </p>

      <div className="fgroup">
        <span className="flabel" id="vg-etapa">{t('Etapa')}</span>
        <div className="chip-row" role="group" aria-labelledby="vg-etapa">
          {(['primaria', 'eso'] as const).map(e => (
            <button
              key={e} type="button" className={`chip accent${etapa === e ? ' on' : ''}`} aria-pressed={etapa === e}
              onClick={() => { setEtapa(e); setCursos([]); setAsignatura(''); }}
            >
              {etapa === e && <Check size={12} />}{t(e === 'primaria' ? 'Primaria' : 'ESO')}
            </button>
          ))}
        </div>
      </div>

      {etapa && (
        <>
          <div className="fgroup">
            <span className="flabel" id="vg-cursos">{t('Cursos')}</span>
            <div className="chip-row" role="group" aria-labelledby="vg-cursos">
              {todos.map(c => {
                const on = cursos.includes(c);
                return (
                  <button key={c} type="button" className={`chip accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternarCurso(c)}>
                    {on && <Check size={12} />}{c}.º
                  </button>
                );
              })}
              <button type="button" className="btn-ghost sm" onClick={() => setCursos(cursos.length === todos.length ? [] : todos)}>
                {t(cursos.length === todos.length ? 'Ninguno' : 'Todos')}
              </button>
            </div>
          </div>

          <div className="fgroup">
            <label className="flabel" htmlFor="vg-letras">{t('Letras de los grupos')}</label>
            <input
              id="vg-letras" className="finput" value={letras} placeholder="A, B, C"
              onChange={e => setLetras(e.target.value)} autoComplete="off"
            />
            <p className="vg-ayuda">{t('Separadas por comas: «A, B, C». También vale «A-D». Si solo hay un grupo por curso, puedes dejarlo vacío.')}</p>
          </div>

          <div className="fgroup">
            <span className="flabel" id="vg-asignatura">{t('Asignatura que les das')}</span>
            {!curriculo ? (
              <p className="vg-ayuda">{t('Cargando…')}</p>
            ) : (
              <div className="chip-row" role="group" aria-labelledby="vg-asignatura">
                {materias.map(n => {
                  const on = !otra.trim() && asignatura === n;
                  return (
                    <button
                      key={n} type="button" aria-pressed={on} className={`chip${on ? ' on' : ''} vg-materia`}
                      onClick={() => { setAsignatura(on ? '' : n); setOtra(''); }}
                    >
                      {on && <Check size={12} style={{ flexShrink: 0 }} />}{n}
                    </button>
                  );
                })}
              </div>
            )}
            <input
              className="finput" style={{ marginTop: 10 }} value={otra}
              aria-label={t('Otra asignatura que no está en el currículo')}
              placeholder={t('Otra que no esté en la lista, por ejemplo Religión o Tutoría')}
              onChange={e => setOtra(e.target.value)}
            />
            <p className="vg-ayuda">{t('Una sola para todos los grupos. Si a alguno le das más, se las añades después en «Editar clase».')}</p>
          </div>

          {/* Lo que se va a crear, antes de crearlo */}
          <div className="vg-lista" aria-live="polite">
            {previstos.length === 0 ? (
              <p className="vg-ayuda" style={{ margin: 0 }}>{t('Marca al menos un curso para ver las clases que se crearán.')}</p>
            ) : (
              <>
                <div className="vg-lista-ttl">
                  {nuevos.length === 0
                    ? t('No hay nada que crear: todos esos grupos ya existen.')
                    : t(nuevos.length === 1 ? 'Se va a crear {n} clase' : 'Se van a crear {n} clases', { n: nuevos.length })}
                  {nuevos.length > 0 && elegida && <span className="vg-lista-sub"> · {elegida}</span>}
                </div>
                {nuevos.length > 0 && (
                  <ul className="vg-grupos">
                    {nuevos.map(g => <li key={g.nombre}>{g.nombre}</li>)}
                  </ul>
                )}
                {yaExisten.length > 0 && (
                  <p className="vg-ayuda vg-existen">
                    {t(yaExisten.length === 1 ? 'Ya existe y no se duplica: {grupos}.' : 'Ya existen y no se duplican: {grupos}.', { grupos: yaExisten.map(g => g.nombre).join(', ') })}
                  </p>
                )}
                {sobran > 0 && (
                  <p className="vg-ayuda vg-existen">{t('Se crean como mucho {max} de una vez. Los demás, en una segunda tanda.', { max: MAX_GRUPOS })}</p>
                )}
                {sinCurriculo.length > 0 && (
                  <p className="vg-ayuda vg-existen">
                    {t('«{asignatura}» no está en el currículo oficial de {cursos}: en esas clases quedará sin materia oficial, y podrás elegirla después.', { asignatura: elegida, cursos: sinCurriculo.map(c => `${c}.º`).join(', ') })}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn-ghost" onClick={onCancelar}>{t('Cancelar')}</button>
        <button type="button" className="btn-accent" onClick={crear} disabled={!etapa || !curriculo || !elegida || nuevos.length === 0}>
          <Plus size={14} />
          {nuevos.length > 1 ? t('Crear {n} clases', { n: nuevos.length }) : t('Crear clase')}
        </button>
      </div>
      {etapa && nuevos.length > 0 && !elegida && (
        <p className="vg-ayuda" style={{ textAlign: 'right' }}>{t('Elige la asignatura para poder crearlas.')}</p>
      )}
    </div>
  );
}
