/**
 * Crear una situación de aprendizaje a partir de las sesiones elegidas
 * (petición del dueño, 21-10-2026): la IA estructura la SdA en torno a esas
 * sesiones (sus mismos títulos y en su orden), la SdA se guarda en
 * Situaciones de aprendizaje y las sesiones quedan asociadas a ella.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { generateSda, MINUTOS_SESION_EF, type SdaRequest } from '../../services/learningSituations';
import { hasApiKey } from '../../services/gemini';
import { isoDate } from '../../lib/utils';
import { recursosParaIA } from '../../lib/ef';
import type { Class, LearningSituation } from '../../types';
import type { EfData, SesionEF } from '../../types/ef';
import type { ComunidadId } from '../../lib/curriculum/comunidades';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Las sesiones elegidas, en el orden en que se quedarán en la SdA. */
  sesiones: SesionEF[];
  clase?: Class;
  comunidad?: ComunidadId;
  perfil: 'ef' | 'aula';
  ef: EfData;
  /** Cuántas SdA hay ya, para darle el número siguiente. */
  numeroSiguiente: number;
  /** Guarda la SdA y asocia las sesiones; devuelve el id de la SdA. */
  onCreada: (sda: LearningSituation, sesionIds: string[]) => void;
  /** Para ir a verla. */
  onAbrirSda?: () => void;
}

const sinNumero = (titulo: string) => titulo.replace(/^\s*\d+\s*[.)-]\s*/, '').trim();

export function CrearSdaDeSesiones({ open, onClose, sesiones, clase, comunidad, perfil, ef, numeroSiguiente, onCreada, onAbrirSda }: Props) {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [idea, setIdea] = useState('');
  const [generando, setGenerando] = useState(false);
  const [creada, setCreada] = useState<string | null>(null);

  const ideaPorDefecto = sesiones.map(s => sinNumero(s.titulo)).filter(Boolean).slice(0, 3).join(', ');

  async function generar() {
    if (sesiones.length === 0) return;
    const areas = clase ? (clase.subjects?.length ? clase.subjects : [clase.subject]).filter(Boolean) : [];
    const modalidad = sesiones.find(s => s.modalidad)?.modalidad;
    const req: SdaRequest = {
      idea: idea.trim() || ideaPorDefecto || t('Situación de aprendizaje'),
      numero: String(numeroSiguiente), temporalizacion: '', meses: '', areas, numSesiones: sesiones.length,
      nivel: clase?.etapa && clase.curso ? `${clase.curso}º ${clase.etapa === 'primaria' ? 'de Primaria' : 'de ESO'}` : '',
      etapa: clase?.etapa, curso: clase?.curso, opcionMatematicas: clase?.opcionMatematicas, comunidad,
      materiasOficiales: clase?.materiasOficiales, contextoClase: '', metodologia: '', documentos: [],
      sesionesBase: sesiones.map(s => ({ titulo: sinNumero(s.titulo) || s.titulo, resumen: [s.objetivo, s.principal].map(x => x.trim()).filter(Boolean).join(' ') })),
      ...(perfil === 'ef' ? { ef: { modelo: '', modalidad: modalidad ?? '', ...recursosParaIA(ef), limitaciones: [], minutos: MINUTOS_SESION_EF } } : {}),
    };
    const content = await generateSda(req, lang, {
      onStart: () => setGenerando(true), onEnd: () => setGenerando(false), onError: m => toast(m),
    });
    if (!content) { toast(t('La IA no devolvió una situación de aprendizaje válida. Vuelve a intentarlo.')); return; }
    const sda: LearningSituation = {
      id: 'sda' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(), date: isoDate(),
      ...(clase ? { class_id: clase.id, class_name: clase.name } : {}),
      title: content.titulo || t('Situación de aprendizaje'),
      request: {
        idea: req.idea, numero: req.numero, temporalizacion: '', meses: '', areas, numSesiones: sesiones.length, nivel: req.nivel,
        contextoClase: '', metodologia: '', etapa: clase?.etapa, curso: clase?.curso, comunidad,
        ...(clase?.materiasOficiales ? { materiasOficiales: clase.materiasOficiales } : {}),
        ...(perfil === 'ef' ? { efModelo: '', efModalidad: modalidad ?? '', efMinutos: MINUTOS_SESION_EF } : {}),
      },
      content,
    };
    onCreada(sda, sesiones.map(s => s.id));
    setCreada(sda.title);
  }

  function cerrar() { setCreada(null); setIdea(''); onClose(); }

  return (
    <Modal open={open} onClose={cerrar} wide title={t('Crear una situación de aprendizaje con estas sesiones')}>
      {creada ? (
        <>
          <p className="ap-aviso" role="status">{t('✅ Creada «{titulo}». Las {n} sesiones ya están asociadas a ella.', { titulo: creada, n: sesiones.length })}</p>
          <div className="ap-acciones" style={{ marginTop: 12 }}>
            {onAbrirSda && <button type="button" className="btn-accent" onClick={() => { cerrar(); onAbrirSda(); }}>{t('Abrirla en Situaciones de aprendizaje')}</button>}
            <button type="button" className="btn-ghost" onClick={cerrar}>{t('Cerrar')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="ap-sub" style={{ marginBottom: 10 }}>
            {t('La IA estructura la situación de aprendizaje en torno a estas sesiones, con sus mismos títulos y en este orden: justificación, currículo, inclusión y evaluación.')}
          </p>
          <ol className="ses-sda-lista" aria-label={t('Sesiones elegidas')}>
            {sesiones.map(s => <li key={s.id}>{sinNumero(s.titulo) || t('Sin título')}</li>)}
          </ol>
          <div className="fgroup" style={{ marginTop: 12 }}>
            <label className="flabel" htmlFor="ses-sda-idea">{t('Idea o título de la situación (opcional)')}</label>
            <input id="ses-sda-idea" className="finput" value={idea} placeholder={ideaPorDefecto} onChange={e => setIdea(e.target.value)} />
          </div>
          <div className="ap-acciones">
            <button type="button" className="btn-accent" onClick={generar} disabled={generando || sesiones.length === 0 || !hasApiKey()}
              title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
              {generando ? <span className="spin" /> : <Sparkles size={15} />}{generando ? t('Preparando…') : t('Crear la situación de aprendizaje')}
            </button>
            <button type="button" className="btn-ghost" onClick={cerrar}>{t('Cancelar')}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
