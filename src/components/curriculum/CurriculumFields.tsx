/**
 * Piezas del currículo oficial que comparten el formulario de la clase y el de
 * la situación de aprendizaje: etapa y curso, la materia oficial de una
 * asignatura, la opción de Matemáticas de 4º de ESO y la línea que dice de qué
 * decreto sale todo. Ver `docs/COMUNIDADES.md`.
 */
import { Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { Etapa } from '../../lib/curriculum';
import type { EstadoMateria } from '../../lib/curriculum/materiasDeClase';
import { citarNormas, nombreComunidad } from '../../lib/curriculum/comunidades';
import { usaEstatalPorFaltaDeDecreto, type CurriculoActivo } from '../../lib/curriculum/cargar';
import { useNivelTexto } from '../../hooks/useCurriculo';

export function EtapaCursoFields({ idPrefix, etapa, curso, onChange }: {
  idPrefix: string;
  etapa: Etapa | '';
  curso: number | '';
  onChange: (etapa: Etapa | '', curso: number | '') => void;
}) {
  const { t } = useI18n();
  const nivelTexto = useNivelTexto();
  return (
    <div className="frow">
      <div className="fgroup">
        <label className="flabel" htmlFor={`${idPrefix}-etapa`}>{t('Etapa (currículo oficial)')}</label>
        <select
          id={`${idPrefix}-etapa`} className="finput" value={etapa}
          onChange={e => onChange(e.target.value as Etapa | '', '')}
        >
          <option value="">{t('Sin especificar')}</option>
          <option value="primaria">{t('Primaria')}</option>
          <option value="eso">{t('ESO')}</option>
        </select>
      </div>
      {etapa && (
        <div className="fgroup">
          <label className="flabel" htmlFor={`${idPrefix}-curso`}>{t('Curso')}</label>
          <select
            id={`${idPrefix}-curso`} className="finput" value={curso}
            onChange={e => onChange(etapa, e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">{t('Sin especificar')}</option>
            {Array.from({ length: etapa === 'primaria' ? 6 : 4 }, (_, i) => i + 1).map(c => (
              <option key={c} value={c}>{nivelTexto(etapa, c)}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** Valor del desplegable para «Ninguna, modo libre». Nunca coincide con una materia. */
const LIBRE = '__libre__';

/**
 * Qué materia oficial es una asignatura. Con alias seguro sale ya elegida (y
 * se dice que se ha detectado sola); sin él, se pide. Siempre se puede dejar
 * en modo libre.
 */
export function MateriaOficialSelect({ id, label, estado, opciones, onChange }: {
  id: string;
  label: string;
  estado: EstadoMateria;
  /** Las materias de este curso en el currículo de la comunidad. */
  opciones: string[];
  /** Una materia, o `null` para modo libre. */
  onChange: (materia: string | null) => void;
}) {
  const { t } = useI18n();
  const value = estado.tipo === 'oficial' ? estado.materia : estado.tipo === 'libre' ? LIBRE : '';
  return (
    <div style={{ marginTop: 6 }}>
      <label className="flabel" htmlFor={id} style={{ fontSize: 11.5 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          id={id} className="finput" value={value} style={{ flex: 1 }}
          onChange={e => onChange(e.target.value === LIBRE ? null : e.target.value)}
        >
          {estado.tipo === 'sin-decidir' && <option value="" disabled>{t('Elige una…')}</option>}
          {opciones.map(o => <option key={o} value={o}>{o}</option>)}
          <option value={LIBRE}>{t('Ninguna, modo libre')}</option>
        </select>
        {estado.tipo === 'oficial' && estado.porAlias && (
          <span style={{ fontSize: 11.5, color: 'var(--ok)', display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <Check size={11} />{t('detectada')}
          </span>
        )}
      </div>
    </div>
  );
}

export function OpcionMatematicas({ value, onChange }: { value: 'A' | 'B' | undefined; onChange: (v: 'A' | 'B') => void }) {
  const { t } = useI18n();
  return (
    <div className="fgroup">
      <label className="flabel">{t('Matemáticas de 4º: ¿opción A o B?')}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {(['A', 'B'] as const).map(op => (
          <button
            key={op} type="button" onClick={() => onChange(op)} aria-pressed={value === op}
            className={value === op ? 'btn-accent' : 'btn-ghost'}
            style={{ minWidth: 80, justifyContent: 'center' }}
          >
            {t('Matemáticas {opcion}', { opcion: op })}
          </button>
        ))}
      </div>
      <p className="sda-note">
        {t('El Real Decreto separa Matemáticas en dos opciones a partir de 4º de la ESO, con criterios y saberes propios de cada una.')}
      </p>
    </div>
  );
}

/**
 * De qué decreto salen las competencias y saberes, y, si la comunidad aún no
 * tiene el suyo en AulaPro, que se usa el estatal. Es solo para la pantalla:
 * el PDF y el Word llevan la cita, sin comentarios sobre la aplicación.
 */
export function CurriculoNota({ curriculo, prefijo }: { curriculo: CurriculoActivo; prefijo?: string }) {
  const { t, lang } = useI18n();
  return (
    <>
      <p className="sda-note" style={{ marginTop: 0 }}>
        {prefijo && <strong style={{ color: 'var(--text-2)' }}>{prefijo} · </strong>}
        {t('Currículo: {cita}', { cita: citarNormas(curriculo.normas, lang) })}
      </p>
      {usaEstatalPorFaltaDeDecreto(curriculo) && <AvisoEstatal comunidad={nombreComunidad(curriculo.comunidad, lang)} />}
    </>
  );
}

/**
 * Bajo la cita del currículo, cuando la comunidad del perfil usa el estatal:
 * lo dice como un hecho, sin «aún no» (decisión del dueño, 3-10-2026). La cita
 * de encima ya nombra el Real Decreto.
 */
export function AvisoEstatal({ comunidad }: { comunidad: string }) {
  const { t } = useI18n();
  return <p className="sda-note">{t('{comunidad} sigue el currículo estatal.', { comunidad })}</p>;
}
