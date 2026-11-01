/**
 * «Descargar mis datos» en la pantalla de licencia (petición del dueño, 1-11-2026): a un docente al que se le acaba la
 * suscripción y no guardaba en Google Drive, OneDrive ni una carpeta, el trabajo le queda dentro del navegador y la app
 * no le deja entrar. Con este botón se lleva una copia sin pedir ayuda. Solo sale si hay trabajo guardado en este
 * navegador. No cambia nada de la licencia: lee los perfiles igual que la app y descarga el mismo archivo que
 * Configuración › Datos y copias (`exportData` en `useAppState`), que se carga con «Cargar desde archivo».
 */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useI18n } from '../i18n';
import { copiasDeEsteNavegador, type Copia } from '../lib/copiasDeEsteNavegador';
import { compartirArchivo, downloadFile, puedeCompartirArchivos } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';

export function DescargarMisDatos() {
  const { t } = useI18n();
  const [copias, setCopias] = useState<Copia[]>([]);
  const [hecho, setHecho] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { void copiasDeEsteNavegador().then(setCopias); }, []);
  if (copias.length === 0) return null;

  async function descargar() {
    setOcupado(true);
    try {
      for (const c of copias) {
        if (puedeCompartirArchivos()) { if (!(await compartirArchivo(c.blob, c.archivo))) { setOcupado(false); return; } }
        else await downloadFile(c.blob, c.archivo, CARPETAS.copias);
      }
      setHecho(true);
    } finally { setOcupado(false); }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button type="button" className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }} disabled={ocupado} onClick={descargar}>
        <Download size={14} />&nbsp;{t('Descargar mis datos')}
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.55 }}>
        <span>{hecho
          ? t('Copia descargada. Para volver a cargarla, en AulaPro: Configuración › Datos y copias › Cargar desde archivo.')
          : t('Tu trabajo está en este navegador. Descarga una copia y es tuya, aunque no renueves. El archivo no va cifrado y lleva los datos de tu alumnado: guárdalo con cuidado.')}</span>
      </p>
    </div>
  );
}
