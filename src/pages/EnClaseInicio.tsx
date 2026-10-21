/**
 * Portada de En clase (decisión del dueño, 11-10-2026), como las de Evaluar
 * y Documentos: arriba, la clase que toca según el horario con sus atajos;
 * debajo, una tarjeta grande por herramienta. Entrar en En clase desde el
 * menú abre siempre esta pantalla (`portada` en lib/navigation.ts).
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Flag, LayoutGrid, Presentation, Smartphone, UserCheck } from 'lucide-react';
import type { Class, ClassMark, ScheduleBlock, SeatingPlan, Section } from '../types';
import { bloqueQueToca, enMarcha } from '../lib/claseQueToca';
import { esLectivo, type EtapaCalendario } from '../lib/calendarioEscolar';
import { useCalendarioEscolar } from '../hooks/useCalendarioEscolar';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import { isoDate } from '../lib/utils';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  scheduleBlocks: ScheduleBlock[];
  classMarks: ClassMark[];
  seatingPlans: Record<string, SeatingPlan>;
  /** Comunidad del perfil: de ella sale el calendario escolar (festivos y vacaciones). */
  comunidad?: ComunidadId;
  onNav: (s: Section) => void;
}

export function EnClaseInicio({ classes, scheduleBlocks, classMarks, seatingPlans, comunidad, onNav }: Props) {
  const { t } = useI18n();
  // La hora se renueva cada medio minuto: sin esto, la clase de «ahora» se quedaba la de cuando se abrió la pantalla
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhoraMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const ahoraD = useMemo(() => new Date(ahoraMs), [ahoraMs]);
  const hoy = isoDate(ahoraD);
  const anotadasHoy = classMarks.filter(m => m.date === hoy).length;
  const conMesas = classes.filter(c => seatingPlans[c.id]?.groups.some(g => g.studentIds.some(Boolean))).length;
  // Un festivo o unas vacaciones según el calendario escolar no tienen clase, diga lo que diga el horario
  const archivoCal = useCalendarioEscolar();
  const etapas = useMemo<EtapaCalendario[]>(() => {
    const e = new Set(classes.map(c => c.etapa).filter((x): x is EtapaCalendario => x === 'primaria' || x === 'eso'));
    return e.size ? [...e] : ['primaria', 'eso'];
  }, [classes]);
  const lectivo = esLectivo(archivoCal, comunidad, ahoraD, etapas);
  const bloque = bloqueQueToca(classes, scheduleBlocks, ahoraD, lectivo);
  const clase = bloque && classes.find(c => c.id === bloque.class_id);
  // bloqueQueToca da el que está en marcha o, si no, el siguiente
  const ahora = !!bloque && enMarcha(bloque, ahoraD);
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
      dato: t('Para proyectar en el aula'),
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
