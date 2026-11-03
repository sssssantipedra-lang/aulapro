/**
 * El especialista de PT y AL envía una adaptación al docente de aula o de EF del alumno: un archivo cifrado con una
 * contraseña que la app propone y que se da por otro medio (`services/acsCompartir.ts`). El docente lo abre en la
 * ficha del alumno, en «Mis clases».
 */
import { useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { generarContrasena } from '../../services/copiaCifrada';
import { archivoAcs } from '../../services/acsCompartir';
import { downloadFile } from '../../lib/download';
import { CARPETAS } from '../../lib/carpetas';
import { isoDate } from '../../lib/utils';
import type { AcsApoyo, AlumnoApoyo } from '../../types/apoyo';

export function EnviarAcs({ acs, alumno, de }: { acs: AcsApoyo; alumno: AlumnoApoyo; de: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [clave, setClave] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!clave) return;
    setGuardando(true);
    try {
      await downloadFile(await archivoAcs([acs], alumno, de, clave), `aulapro-adaptacion-${isoDate()}.json`, CARPETAS.apoyo);
      toast(t('Archivo guardado. Envíalo al docente y dale la contraseña por otro medio.'));
    } catch {
      toast(t('No se pudo crear el archivo.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button className="btn-ghost" type="button" onClick={() => setClave(generarContrasena())}><Send size={15} />{t('Enviar al docente de aula')}</button>
      <Modal open={clave !== null} onClose={() => setClave(null)} title={t('Enviar al docente de aula')}>
        <p className="ap-sub" style={{ marginTop: 0 }}>
          {t('Se crea un archivo cifrado con esta adaptación y sus necesidades específicas de apoyo educativo, sin su nombre, su diagnóstico ni sus programas. El docente lo abre en la ficha del alumno, en «Mis clases».')}
        </p>
        <div className="fgroup">
          <span className="flabel">{t('Contraseña del archivo')}</span>
          <code className="acs-clave">{clave}</code>
          <span className="ap-sub">{t('Apúntala y dásela por otro medio, no junto al archivo.')}</span>
        </div>
        <div className="ap-acciones">
          <button className="btn-accent" type="button" disabled={guardando} onClick={guardar}>{guardando ? t('Guardando…') : t('Guardar el archivo')}</button>
          <button className="btn-ghost" type="button" onClick={() => setClave(null)}>{t('Cerrar')}</button>
        </div>
      </Modal>
    </>
  );
}
