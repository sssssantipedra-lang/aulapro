/**
 * Un curso de Primaria o de la ESO en un solo desplegable («3º Primaria»).
 */
import { useNombreCurso } from '../../hooks/useNombreCurso';
import type { CursoDe } from '../../types/apoyo';

const OPCIONES: CursoDe[] = [
  ...[1, 2, 3, 4, 5, 6].map(curso => ({ etapa: 'primaria' as const, curso })),
  ...[1, 2, 3, 4].map(curso => ({ etapa: 'eso' as const, curso })),
];

const clave = (c: CursoDe) => `${c.etapa}-${c.curso}`;

export function CursoSelect({ id, value, onChange, vacio }: {
  id: string;
  value: CursoDe | undefined;
  onChange: (c: CursoDe | undefined) => void;
  /** Texto de la opción sin curso. */
  vacio: string;
}) {
  const nombre = useNombreCurso();
  return (
    <select
      id={id} className="finput" style={{ cursor: 'pointer' }}
      value={value ? clave(value) : ''}
      onChange={e => onChange(OPCIONES.find(o => clave(o) === e.target.value))}
    >
      <option value="">{vacio}</option>
      {OPCIONES.map(o => <option key={clave(o)} value={clave(o)}>{nombre(o)}</option>)}
    </select>
  );
}
