/**
 * Qué tipo de docente es el perfil: de aula, especialista de PT y AL o de
 * Educación Física (con la casilla de tutoría, el 2 en 1). Se elige al crear
 * el perfil y se cambia en Configuración → Perfil. Cada tipo tiene su menú y
 * su Inicio (ver `lib/navigation.ts`, `docs/PTAL.md` y `docs/EF.md`).
 */
import { Check, HeartHandshake, Users, Volleyball } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Especialidad } from '../types/apoyo';
import type { TipoDocente } from '../lib/tipoDocente';

export type { TipoDocente };

export interface EleccionTipo {
  tipo: TipoDocente;
  especialidades: Especialidad[];
  /** EF: también es tutor o tutora de uno de sus grupos. */
  tutor: boolean;
}

interface Props extends EleccionTipo {
  onChange: (v: EleccionTipo) => void;
  /** Para enlazar la etiqueta y los avisos del formulario. */
  id: string;
}

const TIPOS: { id: TipoDocente; titulo: string; texto: string; icon: React.ReactNode }[] = [
  { id: 'aula', titulo: 'Docente de aula', texto: 'Tutoría o materias: clases, cuaderno de notas, asistencia y evaluación.', icon: <Users size={18} /> },
  { id: 'ef', titulo: 'Educación Física', texto: 'Tus clases de EF y, si quieres, tu tutoría: observación en la pista, pruebas físicas, equipos, circuitos y sesiones.', icon: <Volleyball size={18} /> },
  { id: 'apoyo', titulo: 'PT y AL', texto: 'Profesorado especialista de apoyo: tu alumnado, sus sesiones, sus programas y los informes.', icon: <HeartHandshake size={18} /> },
];

const ESPECIALIDADES: { id: Especialidad; label: string }[] = [
  { id: 'PT', label: 'Pedagogía Terapéutica (PT)' },
  { id: 'AL', label: 'Audición y Lenguaje (AL)' },
];

export function TipoDocentePicker({ tipo, especialidades, tutor, onChange, id }: Props) {
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
              onClick={() => onChange({
                tipo: o.id,
                especialidades: o.id === 'apoyo' ? especialidades : [],
                tutor: o.id === 'ef' ? tutor : false,
              })}
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
                onChange={ev => onChange({
                  tipo: 'apoyo', tutor: false,
                  especialidades: ev.target.checked
                    ? (['PT', 'AL'] as const).filter(x => x === e.id || especialidades.includes(x))
                    : especialidades.filter(x => x !== e.id),
                })}
              />
              {t(e.label)}
            </label>
          ))}
        </fieldset>
      )}
      {tipo === 'ef' && (
        <div className="td-esp">
          <label className="td-chk">
            <input type="checkbox" checked={tutor} onChange={ev => onChange({ tipo: 'ef', especialidades: [], tutor: ev.target.checked })} />
            {t('También soy tutor o tutora')}
          </label>
          <p className="td-nota">
            {t(tutor
              ? 'Tu Inicio será el de tutoría. Tu grupo es la clase en la que marques «Soy el tutor o la tutora de este grupo», en Mis Clases.'
              : 'Tendrás todo lo de un docente de aula y, además, el apartado de Educación Física.')}
          </p>
        </div>
      )}
    </div>
  );
}
