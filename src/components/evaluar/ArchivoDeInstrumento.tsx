/**
 * «Guardar como archivo» y «Abrir archivo» de una rúbrica, una diana o una escala de registro (20-11-2026): el
 * instrumento solo, sin alumnado ni clases, para pasarlo a un compañero o conservarlo (`lib/archivoInstrumento.ts`).
 * Lo abierto no se guarda solo: quien lo recibe (`onAbierto`) rellena con ello el editor de siempre.
 */
import { useRef, type ChangeEvent } from 'react';
import { FolderOpen, Save } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useToast } from '../ui/Toast';
import { downloadFile } from '../../lib/download';
import { CARPETAS } from '../../lib/carpetas';
import {
  MAX_BYTES_INSTRUMENTO, archivoDeDiana, archivoDeRubrica, leerArchivoDeInstrumento, nombreDeArchivoDeInstrumento,
  type InstrumentoLeido, type MotivoDeRechazo, type TipoDeInstrumento,
} from '../../lib/archivoInstrumento';
import { esRegistro } from '../../lib/registro';
import type { EvalDiana, Rubric } from '../../types';

const nuevoId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const RECHAZO: Record<MotivoDeRechazo, string> = {
  'ilegible': 'No se ha podido leer el archivo. Tiene que ser un archivo de instrumento guardado desde AulaPro.',
  'no-es-instrumento': 'Este archivo no es una rúbrica, una diana ni una escala guardada desde AulaPro. Una copia de tus datos se carga en Configuración y un archivo de «Trabajo compartido», en esa pantalla.',
  'version-posterior': 'Este archivo se guardó con una versión de AulaPro más nueva. Recarga la página para actualizarla y vuelve a abrirlo.',
  'vacio': 'El archivo no trae ningún criterio con nombre: no hay nada que abrir.',
};

/** Dónde se abre cada tipo de instrumento, para decirlo si se elige el archivo en la pantalla que no es. */
const SU_PANTALLA: Record<TipoDeInstrumento, string> = {
  rubrica: 'Este archivo es una rúbrica: ábrelo desde Evaluar › Rúbricas.',
  diana: 'Este archivo es una diana: ábrelo desde Evaluar › Dianas.',
  registro: 'Este archivo es una escala de registro: ábrelo desde Evaluar › Escalas de registro.',
};

type Leido = Extract<InstrumentoLeido, { ok: true }>;
type RubricaLeida = Extract<Leido, { tipo: 'rubrica' }>['rubrica'];
type DianaLeida = Exclude<Leido, { tipo: 'rubrica' }>['diana'];

interface AbrirProps {
  /** El instrumento de esta pantalla: un archivo de otro tipo no se abre aquí y se dice dónde. */
  tipo: TipoDeInstrumento;
  /** Lo que se hace con la rúbrica abierta (pantalla de rúbricas). */
  onRubrica?: (r: RubricaLeida) => void;
  /** Lo que se hace con la diana o la escala abierta (sus pantallas). */
  onDiana?: (d: DianaLeida) => void;
}

export function AbrirArchivoDeInstrumento({ tipo, onRubrica, onDiana }: AbrirProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const entrada = useRef<HTMLInputElement>(null);

  async function elegido(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    // Para poder elegir el mismo archivo otra vez
    e.target.value = '';
    if (!archivo) return;
    if (archivo.size > MAX_BYTES_INSTRUMENTO) { toast(t(RECHAZO['no-es-instrumento'])); return; }
    let texto: string;
    try { texto = await archivo.text(); } catch { toast(t(RECHAZO.ilegible)); return; }
    const leido = leerArchivoDeInstrumento(texto, nuevoId);
    if (!leido.ok) { toast(t(RECHAZO[leido.motivo])); return; }
    if (leido.tipo !== tipo) { toast(t(SU_PANTALLA[leido.tipo])); return; }
    if (leido.tipo === 'rubrica') onRubrica?.(leido.rubrica);
    else onDiana?.(leido.diana);
  }

  return (
    <>
      <button type="button" className="btn-ghost ai-abrir" onClick={() => entrada.current?.click()}
        title={t('Abre una rúbrica, una diana o una escala guardada como archivo desde AulaPro, por ti o por otro docente.')}>
        <FolderOpen size={15} aria-hidden="true" />{t('Abrir archivo')}
      </button>
      <input ref={entrada} type="file" accept=".json,application/json" onChange={elegido} style={{ display: 'none' }} aria-label={t('Archivo de instrumento')} />
    </>
  );
}

/** El icono de la tarjeta de un instrumento que lo guarda como archivo, sin alumnado ni clases. */
export function GuardarInstrumentoComoArchivo({ rubrica, diana }: { rubrica?: Rubric; diana?: EvalDiana }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const nombre = rubrica?.name ?? diana?.name ?? '';

  async function guardar() {
    const archivo = rubrica ? archivoDeRubrica(rubrica) : diana ? archivoDeDiana(diana) : null;
    if (!archivo) return;
    const tipo: TipoDeInstrumento = rubrica ? 'rubrica' : esRegistro(diana!) ? 'registro' : 'diana';
    try {
      await downloadFile(new Blob([JSON.stringify(archivo, null, 2)], { type: 'application/json' }), nombreDeArchivoDeInstrumento(nombre, tipo), CARPETAS.cuaderno);
      toast(t('✅ Guardado como archivo, sin alumnado ni clases. Otro docente lo abre con «Abrir archivo».'));
    } catch {
      toast(t('No se ha podido guardar el archivo.'));
    }
  }

  return (
    <button type="button" className="ico-btn" onClick={guardar} title={t('Guardar como archivo')} aria-label={t('Guardar «{nombre}» como archivo', { nombre })}>
      <Save size={14} />
    </button>
  );
}
