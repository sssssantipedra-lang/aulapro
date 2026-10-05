/**
 * Qué tipo de docente es el perfil: de aula o especialista de PT y AL. Se
 * elige al crear el perfil y se cambia en Configuración → Perfil. Con PT y AL
 * la aplicación tiene otro menú y otro Inicio (ver `lib/navigation.ts` y
 * `docs/PTAL.md`). Educación Física, con la tutoría a la vez, vendrá más
 * adelante (decisión del dueño, 5-10-2026).
 */
import { Check, HeartHandshake, Users } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Especialidad } from '../types/apoyo';

export type TipoDocente = 'aula' | 'apoyo';

interface Props {
  tipo: TipoDocente;
  especialidades: Especialidad[];
  onChange: (tipo: TipoDocente, especialidades: Especialidad[]) => void;
  /** Para enlazar la etiqueta y los avisos del formulario. */
  id: string;
}

const TIPOS: { id: TipoDocente; titulo: string; texto: string; icon: React.ReactNode }[] = [
  { id: 'aula', titulo: 'Docente de aula', texto: 'Tutoría o materias: clases, cuaderno de notas, asistencia y evaluación.', icon: <Users size={18} /> },
  { id: 'apoyo', titulo: 'PT y AL', texto: 'Profesorado especialista de apoyo: tu alumnado, sus sesiones, sus programas y los informes.', icon: <HeartHandshake size={18} /> },
];

const ESPECIALIDADES: { id: Especialidad; label: string }[] = [
  { id: 'PT', label: 'Pedagogía Terapéutica (PT)' },
  { id: 'AL', label: 'Audición y Lenguaje (AL)' },
];

export function TipoDocentePicker({ tipo, especialidades, onChange, id }: Props) {
  const { t } = useI18n();
  return (
    <div className="td">
      <div className="flabel" id={`${id}-l`}>{t('Tipo de docente')}</div>
      <div className="td-opts" role="radiogroup" aria-labelledby={`${id}-l`}>
        {TIPOS.map(o => {
          const on = o.id === tipo;
          return (
            <button
              key={o.id} type="button" role="radio" aria-checked={on}
              className={`td-opt${on ? ' on' : ''}`}
              onClick={() => onChange(o.id, o.id === 'aula' ? [] : especialidades)}
            >
              <span className="td-ico">{o.icon}</span>
              <span className="td-txt">
                <strong>{t(o.titulo)}</strong>
                <span>{t(o.texto)}</span>
              </span>
              {on && <Check size={16} className="td-check" />}
            </button>
          );
        })}
      </div>
      {tipo === 'apoyo' && (
        <fieldset className="td-esp">
          <legend className="flabel">{t('¿De qué eres especialista?')}</legend>
          {ESPECIALIDADES.map(e => (
            <label key={e.id} className="td-chk">
              <input
                type="checkbox" checked={especialidades.includes(e.id)}
                onChange={ev => onChange('apoyo', ev.target.checked
                  ? (['PT', 'AL'] as const).filter(x => x === e.id || especialidades.includes(x))
                  : especialidades.filter(x => x !== e.id))}
              />
              {t(e.label)}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
