import { useId } from 'react';
import { BookOpen, Check } from 'lucide-react';
import type { Class, ClassTarget, GradeCategory, GradeTarget } from '../types';
import { objetivosDe } from '../lib/objetivos';
import { useI18n } from '../i18n';

interface Props {
  value: GradeTarget;
  onChange: (next: GradeTarget) => void;
  classes: Class[];
  gradeCategories: GradeCategory[];
}

const asignaturasDe = (c?: Class): string[] => (c?.subjects?.length ? c.subjects : c ? [c.subject] : []);
const mismo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Elige a dónde va la nota de una rúbrica, una diana o una escala: una o
 * varias clases, marcadas de una vez (decisión del dueño, 19-10-2026: la misma
 * rúbrica sirve para dos o tres clases y no hay que duplicarla; y sin
 * sobrecargar la pantalla), y una categoría del cuaderno que vale para todas.
 *
 * La categoría se elige por su nombre («Exámenes»): en cada clase se usa la
 * que se llama así en su asignatura. Cada clase tiene su propia columna en su
 * cuaderno (`lib/objetivos.ts`). Mientras no se elija una categoría, el
 * instrumento sigue funcionando como antes: la evaluación se guarda en el
 * Historial y no toca el cuaderno.
 */
export function GradeTargetsPicker({ value, onChange, classes, gradeCategories }: Props) {
  const { t } = useI18n();
  const uid = useId();
  const filas: ClassTarget[] = objetivosDe(value);

  const claseDe = (id: string) => classes.find(c => c.id === id);
  const catsDe = (f: ClassTarget) => {
    const subs = asignaturasDe(claseDe(f.class_id));
    const asig = f.subject && subs.includes(f.subject) ? f.subject : subs[0] ?? '';
    return gradeCategories.filter(c => c.class_id === f.class_id && (c.subject ?? subs[0] ?? '') === asig);
  };
  const nombreDe = (f: ClassTarget) => catsDe(f).find(c => c.id === f.category_id)?.name;
  /** La categoría elegida, por su nombre: la de la primera clase que tenga una. */
  const nombre = filas.map(nombreDe).find(Boolean);
  /** La categoría de ese nombre en esa clase y asignatura. */
  const resolver = (f: ClassTarget, n?: string): ClassTarget => ({
    class_id: f.class_id, subject: f.subject,
    category_id: n ? catsDe(f).find(c => mismo(c.name, n))?.id : undefined,
  });

  function emitir(nuevas: ClassTarget[]) {
    const [primera, ...otras] = nuevas;
    if (!primera) { onChange({ class_id: undefined, subject: undefined, category_id: undefined, otras_clases: undefined }); return; }
    // Las áreas de una SdA interdisciplinar son de la clase y asignatura de antes: si cambian, se quitan
    const mismaPrincipal = primera.class_id === value.class_id && primera.subject === value.subject;
    onChange({
      ...primera, otras_clases: otras.length ? otras : undefined,
      ...(mismaPrincipal && value.areas ? {} : { areas: undefined, modo_areas: undefined }),
    });
  }

  function alternar(id: string) {
    if (filas.some(f => f.class_id === id)) { emitir(filas.filter(f => f.class_id !== id)); return; }
    const subs = asignaturasDe(claseDe(id));
    emitir([...filas, resolver({ class_id: id, subject: subs[0] }, nombre)]);
  }

  const cambiarAsignatura = (id: string, asig: string) =>
    emitir(filas.map(f => (f.class_id === id ? resolver({ class_id: id, subject: asig }, nombre) : f)));

  const nombres = Array.from(new Map(filas.flatMap(catsDe).map(c => [c.name.trim().toLowerCase(), c.name])).values());
  const sinCategoria = nombre ? filas.filter(f => !f.category_id).map(f => claseDe(f.class_id)?.name).filter(Boolean) : [];
  const conVariasAsignaturas = filas.filter(f => asignaturasDe(claseDe(f.class_id)).length > 1);

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 16px', marginBottom: 16, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BookOpen size={15} color="var(--accent-d)" />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{t('Clases donde se usa')}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('Marca una o varias')}</span>
      </div>

      <div className="chip-row" role="group" aria-label={t('Clases donde se usa')} style={{ marginBottom: filas.length ? 14 : 0 }}>
        {classes.map(c => {
          const on = filas.some(f => f.class_id === c.id);
          return (
            <button key={c.id} type="button" className={`chip accent${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternar(c.id)}>
              {on && <Check size={13} />}{c.name}
            </button>
          );
        })}
      </div>
      {filas.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '10px 0 0', lineHeight: 1.5 }}>
          {t('Sin clase, la evaluación se guarda solo en el historial.')}
        </p>
      )}

      {conVariasAsignaturas.length > 0 && (
        <div className="frow" style={{ marginBottom: 10 }}>
          {conVariasAsignaturas.map(f => {
            const subs = asignaturasDe(claseDe(f.class_id));
            return (
              <div className="fgroup" key={f.class_id}>
                <label className="flabel" htmlFor={`${uid}-${f.class_id}`}>{t('Asignatura')} · {claseDe(f.class_id)?.name}</label>
                <select id={`${uid}-${f.class_id}`} className="finput" style={{ cursor: 'pointer' }}
                  value={f.subject && subs.includes(f.subject) ? f.subject : subs[0]}
                  onChange={e => cambiarAsignatura(f.class_id, e.target.value)}>
                  {subs.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {value.areas && value.areas.length > 1 && (
        <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '0 0 12px', lineHeight: 1.5 }}>
          {t('Puntúa en {areas}', { areas: value.areas.map(a => a.subject).join(', ') })}{' · '}
          {t(value.modo_areas === 'criterio' ? 'Nota por criterios' : 'Misma nota en cada área')}{' '}
          <button type="button" className="sda-back" style={{ display: 'inline', marginBottom: 0 }}
            onClick={() => onChange({ ...value, areas: undefined, modo_areas: undefined })}>
            {t('Dejar solo {area}', { area: value.subject ?? '' })}
          </button>
        </p>
      )}

      {filas.length > 0 && (
        <div className="fgroup" style={{ marginBottom: 0 }}>
          <label className="flabel" htmlFor={`${uid}-cat`}>{t('Categoría del cuaderno')}</label>
          {nombres.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--warn)', lineHeight: 1.5, margin: 0 }}>
              {t('Esta asignatura todavía no tiene categorías en el cuaderno. Crea una (Exámenes, Trabajos…) y vuelve aquí; mientras tanto la evaluación se guardará solo en el historial.')}
            </p>
          ) : (
            <select id={`${uid}-cat`} className="finput" value={nombre ?? ''} style={{ cursor: 'pointer' }}
              onChange={e => emitir(filas.map(f => resolver(f, e.target.value || undefined)))}>
              <option value="">{t('Solo el historial, no el cuaderno')}</option>
              {nombres.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {sinCategoria.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--warn)', margin: '8px 0 0', lineHeight: 1.5 }}>
              {t('En estas clases no hay una categoría con ese nombre y solo irá al historial:')} {sinCategoria.join(', ')}
            </p>
          )}
        </div>
      )}

      {nombre && sinCategoria.length < filas.length && (
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 }}>
          {t('Cada alumno que evalúes aparecerá al momento en el cuaderno, en una columna propia de este instrumento.')}{' '}
          <strong>{t('Si vuelves a evaluar al mismo alumno, su nota anterior se sustituye.')}</strong>
        </p>
      )}
    </div>
  );
}
