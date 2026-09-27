import type { Class } from '../../types';

interface Props {
  classes: Pick<Class, 'id' | 'name' | 'color'>[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Selector de clase en forma de chips con su color. Es el mismo en todas las
 * pantallas que trabajan clase a clase (cuaderno, asistencia…), para que se
 * lea y se use igual en todas.
 */
export function ClassChips({ classes, value, onChange }: Props) {
  return (
    <div className="chip-row">
      {classes.map(c => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            className={`chip${on ? ' on' : ''}`}
            style={on ? { borderColor: c.color } : undefined}
            aria-pressed={on}
            onClick={() => onChange(c.id)}
          >
            <span className="chip-dot" style={{ background: c.color }} aria-hidden="true" />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
