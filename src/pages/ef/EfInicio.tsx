/**
 * Portada de Educación Física (decisión del dueño, 17-10-2026): diez
 * pantallas en una fila de pestañas eran demasiadas. Al entrar, cuatro
 * tarjetas grandes, una por tema, y dentro de cada una todo lo que ofrece, con
 * una línea de lo que hace cada herramienta. Entrar en el apartado desde el
 * menú abre siempre esta pantalla (`portada` en lib/navigation.ts); ya dentro
 * de una pantalla, la barra de arriba solo enseña las de su tema. Ver
 * `docs/EF.md`.
 */
import { ArrowRight, Backpack, BookOpenCheck, ClipboardList, Dumbbell, FileText, Footprints, HeartPulse, Lightbulb, Pencil, Shapes, Timer, Users, Volleyball } from 'lucide-react';
import type { Section } from '../../types';
import type { EfData } from '../../types/ef';
import { exentosDelDia } from '../../lib/ef';
import { isoDate } from '../../lib/utils';
import { useI18n } from '../../i18n';

interface Props {
  ef: EfData;
  onNav: (s: Section) => void;
}

interface Fila { id: Section; icono: React.ReactNode; titulo: string; texto: string }
interface Tarjeta { id: string; color: string; icono: React.ReactNode; titulo: string; texto: string; dato: string; filas: Fila[] }

export function EfInicio({ ef, onNav }: Props) {
  const { t } = useI18n();
  const exentosHoy = exentosDelDia(ef, isoDate()).length;

  const tarjetas: Tarjeta[] = [
    {
      id: 'pista', color: '#16a34a', icono: <Volleyball size={26} />,
      titulo: 'Con el grupo', texto: 'Lo que usas con el grupo delante',
      dato: t('Clases con equipos hechos: {n}', { n: Object.keys(ef.equipos).length }),
      filas: [
        { id: 'ef-pista', icono: <Footprints size={18} />, titulo: 'En la pista', texto: 'Observa a toda la clase desde el móvil: eliges un aspecto (participa, se esfuerza, juego limpio, sin equipación…) y tocas a cada alumno. Cuenta en el cuaderno.' },
        { id: 'ef-equipos', icono: <Users size={18} />, titulo: 'Equipos', texto: 'Equipos equilibrados por nivel y por sexo, sin juntar a quien no conviene. Los retocas con un toque y los proyectas sin niveles ni limitaciones.' },
        { id: 'ef-circuitos', icono: <Timer size={18} />, titulo: 'Cronómetro de circuitos', texto: 'Estaciones, trabajo, descanso y rondas a pantalla completa, con pitidos en los últimos segundos y un color para cada fase.' },
      ],
    },
    {
      id: 'alumnado', color: '#e11d48', icono: <HeartPulse size={26} />,
      titulo: 'Alumnado', texto: 'Quién necesita qué, y cómo evoluciona',
      dato: exentosHoy === 0 ? t('Hoy todo tu alumnado puede hacer la clase.') : t('Exentos o lesionados hoy: {n}', { n: exentosHoy }),
      filas: [
        { id: 'ef-exentos', icono: <HeartPulse size={18} />, titulo: 'Exentos y lesiones', texto: 'Qué no puede hacer cada alumno, desde cuándo y qué hace mientras tanto; y, debajo, los niveles de respuesta II y III con lo que necesitan. El motivo se queda en tu equipo.' },
        { id: 'ef-pruebas', icono: <Dumbbell size={18} />, titulo: 'Pruebas físicas', texto: 'Course Navette, Cooper, velocidad, salto, flexibilidad… Las marcas de cada alumno, su evolución respecto a sí mismo y baremos propios que pasan a nota.' },
      ],
    },
    {
      id: 'preparar', color: '#2563eb', icono: <BookOpenCheck size={26} />,
      titulo: 'Preparar las clases', texto: 'De la actividad suelta a la unidad entera',
      dato: t('Actividades tuyas: {a} · Sesiones: {s}', { a: ef.actividades.length, s: ef.sesiones.length }),
      filas: [
        { id: 'ef-actividades', icono: <Shapes size={18} />, titulo: 'Actividades', texto: 'Un banco por tipo y modalidad, con tus actividades. Propón con IA, desde una foto o desde un manual en PDF, que la app clasifica por ti.' },
        { id: 'ef-sesiones', icono: <ClipboardList size={18} />, titulo: 'Sesiones', texto: 'Calentamiento, parte principal y vuelta a la calma, con inclusión y plan B. La IA la prepara y se imprime en PDF.' },
        { id: 'ef-sda', icono: <Lightbulb size={18} />, titulo: 'Situaciones de aprendizaje', texto: 'La situación de aprendizaje completa de Educación Física: currículo de tu comunidad, modelo pedagógico, sesiones y evaluación.' },
      ],
    },
    {
      id: 'material', color: '#ea580c', icono: <Backpack size={26} />,
      titulo: 'Circuitos y material', texto: 'Dibujar el circuito y saber con qué cuentas',
      dato: t('Pizarras guardadas: {p} · Material: {m}', { p: ef.pizarras.length, m: ef.material.length }),
      filas: [
        { id: 'ef-pizarra', icono: <Pencil size={18} />, titulo: 'Pizarra de circuitos', texto: 'Dibuja un circuito con un banco de material en imágenes, o a mano: la app propone qué material es cada forma y te dice cuánto necesitas.' },
        { id: 'ef-material', icono: <FileText size={18} />, titulo: 'Material e instalaciones', texto: 'Inventario con su estado y lo que hay que reponer, e instalaciones cubiertas para el plan B de los días de lluvia.' },
      ],
    },
  ];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Educación Física')}</h1>
          <p className="pg-sub">{t('Todo lo que ofrece la app para tus clases de EF, por temas')}</p>
        </div>
      </div>
      <div className="ef-in">
        {tarjetas.map(c => (
          <article key={c.id} className="ef-in-card" style={{ '--ev-c': c.color } as React.CSSProperties} aria-labelledby={`ef-in-${c.id}`}>
            <div className="ef-in-hd">
              <span className="ef-in-ico">{c.icono}</span>
              <div>
                <h2 id={`ef-in-${c.id}`} className="ef-in-ttl">{t(c.titulo)}</h2>
                <p className="ef-in-sub">{t(c.texto)}</p>
              </div>
            </div>
            <div className="ef-in-rows">
              {c.filas.map(f => (
                <button key={f.id} type="button" className="ef-in-row" onClick={() => onNav(f.id)}>
                  <span className="ef-in-row-ico">{f.icono}</span>
                  <span className="ef-in-row-txt">
                    <span className="ef-in-row-ttl">{t(f.titulo)}</span>
                    <span className="ef-in-row-desc">{t(f.texto)}</span>
                  </span>
                  <ArrowRight size={16} className="ef-in-row-go" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="ef-in-dato">{c.dato}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
