/**
 * Portada de Documentos (decisión del dueño, 11-10-2026), como la de
 * Evaluar: una tarjeta grande por cada pantalla del apartado, con para qué
 * sirve y cuánto hay hecho. Entrar en Documentos desde el menú abre siempre
 * esta pantalla (`portada` en lib/navigation.ts).
 */
import { ArrowRight, ClipboardList, FileText, FolderOpen, Lightbulb, Shapes } from 'lucide-react';
import type { Class, CompetencyReport, Ficha, GradeItem, LearningSituation, Section } from '../types';
import { useI18n } from '../i18n';
import { useToast } from '../components/ui/Toast';
import { CARPETA_RAIZ } from '../lib/carpetas';

interface Props {
  classes: Class[];
  reports: CompetencyReport[];
  gradeItems: GradeItem[];
  learningSituations: LearningSituation[];
  fichas: Ficha[];
  onNav: (s: Section) => void;
}

export function DocumentosInicio({ classes, reports, gradeItems, learningSituations, fichas, onNav }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const abrirCarpeta = window.electronAPI?.docs?.openFolder;
  const conNotas = classes.filter(c => gradeItems.some(i => i.class_id === c.id)).length;
  const cuenta = (n: number, uno: string, varios: string) => t(n === 1 ? uno : varios, { n });

  const tarjetas: { id: Section; color: string; icono: React.ReactNode; titulo: string; texto: string; dato: string }[] = [
    {
      id: 'reports', color: '#6366f1', icono: <FileText size={26} />,
      titulo: 'Informes',
      texto: 'Informes competenciales para las familias, redactados por la IA con tus propias evaluaciones.',
      dato: cuenta(reports.length, '{n} informe redactado', '{n} informes redactados'),
    },
    {
      id: 'records', color: '#0ea5e9', icono: <ClipboardList size={26} />,
      titulo: 'Actas',
      texto: 'Actas de calificaciones de cada clase y evaluación, listas para imprimir y firmar.',
      dato: cuenta(conNotas, '{n} clase con notas', '{n} clases con notas'),
    },
    {
      id: 'learning-situations', color: '#10b981', icono: <Lightbulb size={26} />,
      titulo: 'Situaciones de aprendizaje',
      texto: 'Una idea y la IA redacta la SdA entera: currículo, sesiones, inclusión y evaluación.',
      dato: cuenta(learningSituations.length, '{n} situación', '{n} situaciones'),
    },
    {
      id: 'resources', color: '#ec4899', icono: <Shapes size={26} />,
      titulo: 'Recursos',
      texto: 'Fichas con historia, escape rooms y tarjetas para imprimir: la IA las crea y tú las retocas.',
      dato: cuenta(fichas.length, '{n} recurso', '{n} recursos'),
    },
  ];

  return (
    <section className="sec active">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Documentos')}</h1>
          <p className="pg-sub">{t('Todo lo que acaba en papel')}</p>
        </div>
        {abrirCarpeta && (
          // Lleva a Documentos › AulaPro, donde se proponen los PDF, Word y copias (en Android, donde quedan guardados)
          <button type="button" className="btn-ghost" title={t('Abre la carpeta Documentos › AulaPro')}
            onClick={async () => {
              try {
                const r = await abrirCarpeta();
                if (!r.existe) toast(t('Todavía no has guardado ningún documento. Aquí aparecerán, en la carpeta «{carpeta}».', { carpeta: CARPETA_RAIZ }));
              } catch {
                toast(t('No se pudo abrir la carpeta. Búscala en Documentos › AulaPro.'));
              }
            }}>
            <FolderOpen size={15} />{t('Documentos descargados')}
          </button>
        )}
      </div>
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
