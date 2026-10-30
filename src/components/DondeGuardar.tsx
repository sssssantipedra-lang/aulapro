import { CheckCircle2, FolderSync, ShieldAlert, Cloud } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Versión web: dónde se puede guardar el trabajo y qué se arriesga con cada sitio (petición del dueño,
 * 30-10-2026: que quede muy claro, y que guardar en el Drive o el OneDrive sea lo extremadamente
 * recomendado antes que solo en el navegador). Se enseña siempre a la vista, en el paso de entrada y en
 * Configuración › Datos y copias, no detrás de un «?».
 *
 * `ms`: la cuenta es de Microsoft (OneDrive en vez de Google Drive). `carpeta`: el navegador deja elegir una
 * carpeta del ordenador (solo Chrome y Edge de ordenador; no los móviles, Safari ni Firefox).
 */
export function DondeGuardar({ ms, carpeta }: { ms: boolean; carpeta: boolean }) {
  const { t } = useI18n();
  const nube = ms ? 'OneDrive' : 'Google Drive';
  return (
    <div className="donde-guardar">
      <div className="donde-ttl">{t('¿Dónde guardar tu trabajo?')}</div>

      <div className="donde-fila donde-ok">
        <Cloud size={18} aria-hidden="true" />
        <div>
          <strong>{t(ms ? 'En tu OneDrive' : 'En tu Google Drive')} <span className="donde-rec">{t('Recomendado')}</span></strong>
          <p>{t('Lo más seguro. Se copia solo, cada media hora y al salir de la aplicación; lo tienes en todos tus dispositivos y no se pierde aunque borres los datos del navegador, cambies de móvil u ordenador o se estropee. Funciona en cualquier navegador, también en el móvil.')}</p>
        </div>
      </div>

      <div className="donde-fila donde-med">
        <FolderSync size={18} aria-hidden="true" />
        <div>
          <strong>{t('En una carpeta de tu ordenador')}</strong>
          <p>{t(carpeta
            ? 'Una copia en tu propio disco, que se actualiza sola. Solo vale en este ordenador. Si la eliges dentro de la carpeta de OneDrive o Google Drive de tu equipo, además viaja a la nube.'
            : 'No está disponible en este navegador: los móviles, Safari y Firefox no la ofrecen. Solo Chrome y Edge de ordenador.')}</p>
        </div>
      </div>

      <div className="donde-fila donde-mal">
        <ShieldAlert size={18} aria-hidden="true" />
        <div>
          <strong>{t('Solo en este navegador')} <span className="donde-riesgo">{t('Con riesgo')}</span></strong>
          <p>{t('Se pierde si se borran los datos del navegador, si cambias de dispositivo o si se estropea, y AulaPro no puede recuperarlo. En iPhone y iPad, Safari puede borrarlo si pasas siete días sin abrir AulaPro. Tendrías que descargar copias a mano.')}</p>
        </div>
      </div>

      <p className="donde-pie">
        <CheckCircle2 size={14} aria-hidden="true" />
        <span>{t('En todos los casos, tus datos no pasan por ningún servidor de AulaPro: AulaPro no los ve ni los guarda. Su custodia es tuya (y de {proveedor}, si guardas en la nube).', { proveedor: nube === 'OneDrive' ? 'Microsoft' : 'Google' })}</span>
      </p>
    </div>
  );
}
