/**
 * El aviso que sale en Android cada vez que se guarda un archivo (petición del
 * dueño, 18-10-2026): dice en qué carpeta de «Documentos › AulaPro» ha quedado
 * y tiene botones para abrirlo, ir a la carpeta o compartirlo. Se recoge del
 * evento que emite el puente nativo (`lib/guardado.ts`, `platform/android.ts`).
 */
import { useEffect, useState } from 'react';
import { FileText, FolderOpen, Share2, X } from 'lucide-react';
import { alGuardar, type Guardado } from '../lib/guardado';
import { rutaLegible } from '../lib/carpetas';
import { useI18n } from '../i18n';

/** Lo que el aviso sabe hacer con un archivo guardado: lo pone el puente de Android. */
export interface AccionesGuardado {
  abrir: (g: Guardado) => Promise<void>;
  abrirCarpeta: (g: Guardado) => Promise<void>;
  compartir: (g: Guardado) => Promise<void>;
}

/** Cuánto se queda a la vista, en ms: lo justo para tocar un botón sin tapar la pantalla para siempre. */
export const TIEMPO_AVISO_MS = 12000;

export function AvisoGuardado({ acciones }: { acciones: AccionesGuardado }) {
  const { t } = useI18n();
  const [guardado, setGuardado] = useState<Guardado | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => alGuardar(g => { setGuardado(g); setFallo(false); }), []);

  // Se quita solo; cada archivo nuevo vuelve a empezar la cuenta
  useEffect(() => {
    if (!guardado) return;
    const h = setTimeout(() => setGuardado(null), TIEMPO_AVISO_MS);
    return () => clearTimeout(h);
  }, [guardado]);

  if (!guardado) return null;

  const hacer = (f: (g: Guardado) => Promise<void>) => async () => {
    try { await f(guardado); setFallo(false); } catch { setFallo(true); }
  };

  return (
    <div className="aviso-guardado" role="status" aria-live="polite">
      <div className="aviso-guardado-txt">
        <strong>{t('Guardado')}</strong>
        <span className="aviso-guardado-nombre">{guardado.nombre}</span>
        <span className="aviso-guardado-ruta">{rutaLegible(guardado.carpeta)}</span>
        {fallo && <span className="aviso-guardado-fallo">{t('Tu dispositivo no sabe abrirlo desde aquí. Búscalo en la aplicación de Archivos.')}</span>}
      </div>
      <div className="aviso-guardado-btns">
        <button type="button" className="btn-accent" onClick={hacer(acciones.abrirCarpeta)}><FolderOpen size={15} />{t('Ver carpeta')}</button>
        <button type="button" className="btn-ghost" onClick={hacer(acciones.abrir)}><FileText size={15} />{t('Abrir')}</button>
        <button type="button" className="btn-ghost" onClick={hacer(acciones.compartir)}><Share2 size={15} />{t('Compartir')}</button>
        <button type="button" className="ico-btn" onClick={() => setGuardado(null)} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={16} /></button>
      </div>
    </div>
  );
}
