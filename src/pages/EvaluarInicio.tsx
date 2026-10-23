/**
 * Portada de Evaluar: dos tarjetas grandes para elegir cómo evaluar, por
 * rúbricas o por dianas, y debajo cómo va cada clase según sus rúbricas
 * (decisión del dueño, 11-10-2026). Entrar en Evaluar desde el menú abre
 * siempre esta pantalla (`portada` en lib/navigation.ts).
 */
import { useMemo } from 'react';
import { ArrowRight, Camera, ClipboardCheck, History, Radar, Target, ThumbsUp, TrendingUp, UserCheck } from 'lucide-react';
import type { Class, EvalDiana, Evaluation, Rubric, Section } from '../types';
import { esRegistro } from '../lib/registro';
import { rendimientoPorClase } from '../lib/rendimiento';
import { RendimientoCarrusel } from '../components/evaluar/RendimientoCarrusel';
import { useI18n } from '../i18n';

interface Props {
  classes: Class[];
  rubrics: Rubric[];
  dianas?: EvalDiana[];
  evaluations: Evaluation[];
  onNav: (s: Section) => void;
}

export function EvaluarInicio({ classes, rubrics, dianas = [], evaluations, onNav }: Props) {
  const { t } = useI18n();
  const clases = useMemo(() => rendimientoPorClase(classes, rubrics, evaluations), [classes, rubrics, evaluations]);
  const idsRegistro = new Set(dianas.filter(esRegistro).map(d => d.id));
  const conRubrica = evaluations.filter(e => e.instrument !== 'diana').length;
  const conRegistro = dianas.filter(esRegistro).length;
  const conDiana = evaluations.filter(e => e.instrument === 'diana' && !idsRegistro.has(e.rubric_id)).length;

  const tarjetas: { id: Section; color: string; icono: React.ReactNode; titulo: string; texto: string; dato: string }[] = [
    {
      id: 'rubrics', color: '#f59e0b', icono: <ClipboardCheck size={26} />,
      titulo: 'Evaluar por rúbricas',
      texto: 'Criterios con descriptores por nivel: marcas la casilla que corresponde a cada alumno.',
      dato: t(conRubrica === 1 ? '{n} evaluación' : '{n} evaluaciones', { n: conRubrica }),
    },
    {
      id: 'dianas', color: '#ef4444', icono: <Target size={26} />,
      titulo: 'Evaluar por dianas',
      texto: 'Ítems con peso sobre una diana: se ve de un vistazo en qué destaca cada alumno.',
      dato: t(conDiana === 1 ? '{n} evaluación' : '{n} evaluaciones', { n: conDiana }),
    },
    {
      id: 'registros', color: '#16a34a', icono: <ThumbsUp size={26} />,
      titulo: 'Escalas de registro',
      texto: 'Un concepto concreto: por cada alumno, un pulgar arriba (bien hecho) o abajo (mejorable).',
      dato: t(conRegistro === 1 ? '{n} escala' : '{n} escalas', { n: conRegistro }),
    },
    {
      id: 'evalfoto', color: '#0ea5e9', icono: <Camera size={26} />,
      titulo: 'Evaluar por foto',
      texto: 'Fotografías un examen o un trabajo: la IA propone los puntos de cada pregunta y tú revisas la nota.',
      dato: t('Exámenes y trabajos'),
    },
    {
      id: 'diana', color: '#8b5cf6', icono: <Radar size={26} />,
      titulo: 'Diana competencial',
      texto: 'Las competencias clave de cada alumno en una diana de seis sectores, con lo que sale de tus evaluaciones.',
      dato: t('Por alumno'),
    },
    {
      id: 'selfassess', color: '#6366f1', icono: <UserCheck size={26} />,
      titulo: 'Autoevaluaciones',
      texto: 'Lo que el alumnado dice de sí mismo en la Sala de alumnos; se guarda aparte y no cuenta en el cuaderno.',
      dato: t('De la Sala'),
    },
    {
      id: 'history', color: '#64748b', icono: <History size={26} />,
      titulo: 'Historial',
      texto: 'Todo lo evaluado, con su fecha y su instrumento, para consultarlo o pasarlo a otro sitio.',
      dato: t('{n} evaluaciones', { n: evaluations.length }),
    },
  ];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Evaluar')}</h1>
          <p className="pg-sub">{t('Elige cómo quieres evaluar')}</p>
        </div>
      </div>

      <div className="ev-cards cuatro">
        {tarjetas.map(c => (
          <button key={c.id} type="button" className="ev-card" style={{ '--ev-c': c.color } as React.CSSProperties} onClick={() => onNav(c.id)}>
            <span className="ev-card-ico">{c.icono}</span>
            <span className="ev-card-ttl">{t(c.titulo)}</span>
            <span className="ev-card-txt">{t(c.texto)}</span>
            <span className="ev-card-ft">
              <span className="ev-card-dato">{c.dato}</span>
              <span className="ev-card-go">{t('Empezar')}<ArrowRight size={15} /></span>
            </span>
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-hd">
          <span className="card-ttl"><TrendingUp size={15} />{t('Cómo va cada clase')}</span>
        </div>
        {clases.length > 0
          ? <RendimientoCarrusel clases={clases} />
          : (
            <p className="rend-vacio">
              {t('Cuando evalúes con rúbricas, aquí verás la nota media de cada rúbrica en cada clase.')}
            </p>
          )}
      </div>
    </section>
  );
}
