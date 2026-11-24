import { useState } from 'react';
import { CalendarRange, CalendarPlus, CalendarX } from 'lucide-react';
import { useToast } from './ui/Toast';
import { useI18n } from '../i18n';
import { CursoNuevo } from './CursoNuevo';
import type { DatosDelCurso, PlanDeCurso } from '../lib/cursoNuevo';

/** Lo que necesita el asistente «Empezar curso nuevo». */
export interface DatosParaCursoNuevo {
  /** Todo el trabajo del perfil, tal como está ahora. */
  datos: DatosDelCurso;
  /** La copia descargable de siempre. */
  onExportar: () => Record<string, unknown>;
  onEmpezar: (plan: PlanDeCurso, cursoNuevo: string) => Promise<void>;
}

interface Props {
  courseLabel: string;
  /** Perfil de PT y AL: al vaciar el curso se conserva su alumnado de apoyo, y se dice. */
  apoyo: boolean;
  /** Si este dispositivo guarda copias de seguridad automáticas (y se puede decir que se hace una antes). */
  conCopias: boolean;
  cursoNuevo?: DatosParaCursoNuevo;
  onClearSchoolYear: () => Promise<void>;
  /** Tras empezar el curso nuevo (hay una copia más en la lista). */
  onHecho: () => void;
}

/**
 * «Final de curso», en su propia tarjeta de Configuración › Datos y copias (20-11-2026; antes, al fondo de «Mis
 * datos»). Dos caminos: «Empezar curso nuevo», que conserva lo que casi no cambia (`CursoNuevo`), y «Vaciar el
 * curso», el de siempre, que se lo lleva todo menos las rúbricas y las dianas.
 */
export function FinalDeCurso({ courseLabel, apoyo, conCopias, cursoNuevo, onClearSchoolYear, onHecho }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [asistente, setAsistente] = useState(false);
  /** Cerrado sin terminar, el asistente conserva lo elegido; tras empezar un curso, el siguiente empieza de cero. */
  const [vez, setVez] = useState(0);

  return (
    <div className="card fc" style={{ gridColumn: '1 / -1', marginTop: 16 }}>
      <div className="card-hd">
        <div className="card-ttl"><CalendarRange size={14} color="var(--accent-d)" />{t('Final de curso')} {courseLabel && `· ${courseLabel}`}</div>
      </div>

      {cursoNuevo && (
        <div className="fc-opcion">
          <div className="fc-ttl">{t('Empezar curso nuevo')}</div>
          <p className="fc-texto">
            {t('Para pasar de un curso al siguiente sin rehacerlo todo. Te guía paso a paso: primero descargas una copia del curso que acaba; después dices qué clases suben de curso con su alumnado, cuáles se quedan vacías para un grupo nuevo y cuáles se van, y si conservas el horario y las categorías y los pesos del cuaderno.')}{' '}
            <strong>{t('Tus rúbricas, dianas, situaciones de aprendizaje, fichas y sesiones se conservan')}</strong>{t('; las notas, las evaluaciones, la asistencia, las anotaciones y los informes empiezan limpios. Antes de aplicar nada verás el resumen de lo que se conserva y lo que se borra.')}
            {apoyo && <> {t('De PT y AL se conserva tu alumnado de apoyo con sus grupos, sus programas, sus adaptaciones y sus agendas visuales.')}</>}
          </p>
          <button type="button" className="btn-accent" onClick={() => setAsistente(true)}>
            <CalendarPlus size={14} />{t('Empezar curso nuevo')}
          </button>
          <CursoNuevo
            key={vez} open={asistente}
            onClose={hecho => { setAsistente(false); if (hecho) { setVez(v => v + 1); onHecho(); } }}
            curso={courseLabel} datos={cursoNuevo.datos} onExportar={cursoNuevo.onExportar} onEmpezar={cursoNuevo.onEmpezar} conCopias={conCopias}
          />
        </div>
      )}

      <div className={`fc-opcion${cursoNuevo ? ' segunda' : ''}`}>
        <div className="fc-ttl">{t('Vaciar el curso')}</div>
        <p className="fc-texto">
          {cursoNuevo && <>{t('Para empezar de cero.')} </>}
          {t('Cuando termine la tercera evaluación puedes vaciar el curso: se borran clases, alumnos, notas, evaluaciones, asistencia e informes.')} <strong>{t('Se conservan tus rúbricas y dianas')}</strong>{t(', que te servirán el año que viene.')}
          {apoyo && <> {t('De PT y AL se conserva tu alumnado de apoyo con sus grupos, sus programas, sus adaptaciones y sus agendas visuales; se borran los registros de las sesiones, las coordinaciones, los cierres de trimestre y los documentos.')}</>}
          {conCopias && t(' Antes de borrar se guarda una copia de seguridad.')}
        </p>

        {confirmClear ? (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '0.5px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '13px 15px' }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 12 }}>
              {t('¿Seguro? Se borrará el trabajo de este curso. Podrás recuperarlo desde las copias de seguridad de arriba si te arrepientes.')}
            </p>
            <div style={{ display: 'flex', gap: 9 }}>
              <button
                className="btn-ghost"
                style={{ color: 'white', background: 'var(--danger)', border: 'none' }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onClearSchoolYear();
                  setBusy(false);
                  setConfirmClear(false);
                  toast(t('✅ Curso vaciado. Tus rúbricas siguen ahí.'));
                }}
              >
                {t('Sí, vaciar el curso')}
              </button>
              <button className="btn-ghost" onClick={() => setConfirmClear(false)}>{t('Cancelar')}</button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirmClear(true)}>
            <CalendarX size={14} />{t('Vaciar el curso')}
          </button>
        )}
      </div>
    </div>
  );
}
