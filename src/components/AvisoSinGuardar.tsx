/**
 * El guardado automático no ha podido escribir (auditoría del 1-11-2026; ver `hooks/useGuardadoAutomatico.ts`). Antes
 * no se decía nada y el docente seguía trabajando sin que se guardara. El aviso no se puede cerrar mientras dure el
 * fallo: desaparece solo cuando un nuevo intento sale bien. Mientras tanto, la copia se descarga con un toque (o, en el
 * móvil, se manda por el menú de compartir), con todo lo que hay en pantalla, también lo que no se ha guardado.
 */
import { AlertTriangle, Download } from 'lucide-react';
import { useI18n } from '../i18n';
import { useToast } from './ui/Toast';
import { compartirArchivo, downloadFile, puedeCompartirArchivos } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';
import { isoDate } from '../lib/utils';
import { registrarCopia } from '../lib/avisoCopia';
import type { ErrorGuardado } from '../hooks/useGuardadoAutomatico';

export function AvisoSinGuardar({ motivo, exportar }: { motivo: ErrorGuardado | null; exportar: () => Record<string, unknown> }) {
  const { t } = useI18n();
  const { toast } = useToast();
  if (!motivo) return null;

  async function descargar() {
    const blob = new Blob([JSON.stringify(exportar(), null, 2)], { type: 'application/json' });
    const nombre = `aulapro-copia-${isoDate()}.json`;
    if (puedeCompartirArchivos()) {
      if (!(await compartirArchivo(blob, nombre))) return;
      toast(t('✅ Copia enviada'));
    } else {
      await downloadFile(blob, nombre, CARPETAS.copias);
      toast(t('✅ Copia de seguridad descargada'));
    }
    registrarCopia();
  }

  return (
    // Con la clase del recordatorio de copia (que no sale mientras dure el fallo): en el móvil ocupa el ancho de la pantalla
    <div className="update-banner aviso-copia" role="alert">
      <AlertTriangle size={18} color="var(--danger, #dc2626)" style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ flex: 1 }}>
        {t(motivo === 'espacio'
          ? 'No se pueden guardar tus cambios: el navegador se ha quedado sin espacio para AulaPro. Descarga ahora una copia para no perderlos y libera espacio en el dispositivo; AulaPro vuelve a intentarlo sola.'
          : 'No se han podido guardar tus últimos cambios en este navegador. AulaPro vuelve a intentarlo sola; mientras tanto, descarga una copia para no perderlos.')}
      </span>
      <button type="button" onClick={descargar}><Download size={14} />{t('Descargar una copia')}</button>
    </div>
  );
}
