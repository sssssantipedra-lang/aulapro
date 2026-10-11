/**
 * Portada de En clase (decisión del dueño, 11-10-2026), como las de Evaluar
 * y Documentos: arriba, la clase que toca según el horario con sus atajos;
 * debajo, una tarjeta grande por herramienta. Entrar en En clase desde el
 * menú abre siempre esta pantalla (`portada` en lib/navigation.ts).
 */
import { ArrowRight, Flag, LayoutGrid, Presentation, Smartphone, UserCheck } from 'lucide-react';
import type { Class, ClassMark, ScheduleBlock, SeatingPlan, Section } from '../types';
import { bloqueQueToca } from '../lib/claseQueToca';
import { isoDate } from '../lib/utils';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  scheduleBlocks: ScheduleBlock[];
  classMarks: ClassMark[];
  seatingPlans: Record<string, SeatingPlan>;
  onNav: (s: Section) => void;
}

export function EnClaseInicio({ classes, scheduleBlocks, classMarks, seatingPlans, onNav }: Props) {
  const { t } = useI18n();
  const hoy = isoDate();
  const anotadasHoy = classMarks.filter(m => m.date === hoy).length;
  const conMesas = classes.filter(c => seatingPlans[c.id]?.groups.some(g => g.studentIds.some(Boolean))).length;
  const bloque = bloqueQueToca(classes, scheduleBlocks);
  const clase = bloque && classes.find(c => c.id === bloque.class_id);
  const ahora = bloque ? (() => {
    const d = new Date();
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return bloque.time_start <= hm;
  })() : false;
  const cuenta = (n: number, uno: string, varios: string) => t(n === 1 ? uno : varios, { n });

  const tarjetas: { id: Section; color: string; icono: React.ReactNode; titulo: string; texto: string; dato: string }[] = [
    {
      id: 'actitud', color: '#f59e0b', icono: <Flag size={26} />,
      titulo: 'Anotar actitud',
      texto: 'Toda la clase en una lista: participa, comportamiento, sin tarea… Un toque y cuenta en el cuaderno.',
      dato: cuenta(anotadasHoy, '{n} anotación hoy', '{n} anotaciones hoy'),
    },
    {
      id: 'seating', color: '#10b981', icono: <LayoutGrid size={26} />,
      titulo: 'Distribución de aula',
      texto: 'Mesas cooperativas o cuadradas, quién se sienta dónde y los roles de cada semana.',
      dato: cuenta(conMesas, '{n} clase con mesas', '{n} clases con mesas'),
    },
    {
      id: 'sec-classroom', color: '#0ea5e9', icono: <Presentation size={26} />,
      titulo: 'Pizarra y herramientas',
      texto: 'Para proyectar: pizarra, temporizador, ruleta con los nombres, sonómetro, calculadora y retos.',
      dato: 'Aula Live',
    },
    {
      id: 'classroom-live', color: '#8b5cf6', icono: <Smartphone size={26} />,
      titulo: 'Actividades con móviles',
      texto: 'El alumnado entra con un código QR para autoevaluarse, votar o mandar ideas al mural.',
      dato: t('Sin instalar nada'),
    },
  ];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('En clase')}</h1>
          <p className="pg-sub">{t('Lo que usas con el alumnado delante')}</p>
        </div>
      </div>

      {clase && bloque && (
        <div className="ec-ahora" style={{ '--ec-c': clase.color } as React.CSSProperties}>
          <span className="ec-ahora-dot" aria-hidden="true" />
          <span className="ec-ahora-txt">
            <span className="ec-ahora-lbl">{t(ahora ? 'Ahora' : 'Siguiente')} · {bloque.time_start}–{bloque.time_end}</span>
            <strong>{clase.name}</strong>
          </span>
          <span className="ec-ahora-acts">
            <button type="button" className="btn-ghost" onClick={() => onNav('attendance')}>
              <UserCheck size={14} />{t('Pasar lista')}
            </button>
            <button type="button" className="btn-accent" onClick={() => onNav('actitud')}>
              <Flag size={14} />{t('Anotar actitud')}
            </button>
          </span>
        </div>
      )}

      <div className="ev-cards cuatro">
        {tarjetas.map(c => (
          <button key={c.id} type="button" className="ev-card" style={{ '--ev-c': c.color } as React.CSSProperties} onClick={() => onNav(c.id)}>
            <span className="ev-card-ico">{c.icono}</span>
            <span className="ev-card-ttl">{t(c.titulo)}</span>
            <span className="ev-card-txt">{t(c.texto)}</span>
            <span className="ev-card-ft">
              <span className="ev-card-dato">{c.dato}</span>
              <span className="ev-card-go">{t('Abrir')}<ArrowRight size={15} /></span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
