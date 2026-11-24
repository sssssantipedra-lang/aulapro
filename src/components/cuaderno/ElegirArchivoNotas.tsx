/**
 * La puerta de «Importar notas» (24-11-2026, petición del dueño: «que se pueda arrastrar el archivo, así como un
 * botón específico para importar»). Una ventana con una zona grande donde soltar el Excel o el CSV y el botón
 * «Elegir archivo». El archivo soltado lo recoge `useSoltarArchivo` en toda la pantalla del cuaderno (también aquí
 * encima), así que esta zona solo enseña dónde soltarlo y se ilumina al pasar un archivo por encima de la ventana.
 * Lo demás (elegir columnas y la vista previa) es de `ImportarNotas`. Se monta solo mientras está abierta (cerrada,
 * sus botones se alcanzarían con el tabulador), lleva el foco a la zona al abrirse y lo devuelve al cerrarse.
 */
import { useEffect, useId, useRef } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { EXTENSIONES_NOTAS } from '../../lib/importarNotas';

interface Props {
  clase: string;
  /** Hay un archivo encima de la ventana del navegador. */
  arrastrando: boolean;
  /** Se está leyendo un archivo. */
  leyendo: boolean;
  onArchivo: (archivo: File) => void;
  onClose: () => void;
}

export function ElegirArchivoNotas({ clase, arrastrando, leyendo, onArchivo, onClose }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const formatos = useId();
  const zona = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    zona.current?.focus({ preventScroll: true });
    return () => { if (antes?.isConnected) antes.focus({ preventScroll: true }); };
  }, []);
  return (
    <Modal open onClose={onClose} title={<span className="mk-ttl"><FileSpreadsheet size={17} color="var(--accent-d)" />{t('Importar notas de {clase}', { clase })}</span>}>
      <div className="pn-elegir">
        <p className="pn-como">
          {t('Trae las notas de un Excel o de un CSV. Después eliges a qué actividad va cada columna y ves, alumno por alumno, cómo quedan antes de poner nada.')}
        </p>
        <button
          ref={zona}
          type="button"
          className={`pn-soltar${arrastrando ? ' pn-soltar-encima' : ''}`}
          onClick={() => { if (!leyendo) input.current?.click(); }}
          aria-disabled={leyendo || undefined}
          aria-describedby={formatos}
        >
          <Upload size={30} aria-hidden="true" />
          {leyendo ? <strong>{t('Leyendo el archivo…')}</strong>
            : arrastrando ? <strong>{t('Suéltalo aquí')}</strong>
              : (
                <>
                  {/* Con el dedo no se arrastra: se pulsa */}
                  <strong className="pn-con-raton">{t('Arrastra aquí tu archivo')}</strong>
                  <span className="pn-con-raton">{t('o pulsa para elegirlo')}</span>
                  <strong className="pn-con-dedo">{t('Pulsa para elegir el archivo')}</strong>
                </>
              )}
        </button>
        <p className="sda-note" id={formatos}>
          {t('Excel (.xlsx, .xls), LibreOffice (.ods) o CSV, de hasta 10 MB. Va mejor con una columna con los nombres del alumnado y una columna por actividad.')}
        </p>
        <p className="sda-note">{t('El archivo se lee en este dispositivo: no se envía a ningún sitio.')}</p>
        <input ref={input} type="file" accept={EXTENSIONES_NOTAS} hidden onChange={e => {
          const archivo = e.target.files?.[0];
          e.target.value = '';
          if (archivo) onArchivo(archivo);
        }} />
        <div className="pn-pie">
          <button type="button" className="btn-accent" onClick={() => input.current?.click()} disabled={leyendo}>
            <FileSpreadsheet size={15} />{t('Elegir archivo')}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        </div>
      </div>
    </Modal>
  );
}
