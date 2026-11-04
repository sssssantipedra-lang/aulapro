import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { useI18n } from '../i18n';
import { Modal } from './ui/Modal';
import { VIDEOS_AYUDA, urlVideo, type VideoAyuda } from '../lib/videosAyuda';

/**
 * Un «?» junto al título de una pantalla: abre una ventana con el vídeo corto que la explica. El vídeo no se pide
 * hasta que se abre la ventana, y se sirve desde aulapro.app (ni YouTube ni nada de terceros, ni cookies).
 */
export function AyudaVideo({ id }: { id: VideoAyuda }) {
  const { t, lang } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [fallo, setFallo] = useState(false);
  const titulo = t(VIDEOS_AYUDA[id]);
  return (
    <>
      <button
        type="button" className="ayuda-video" aria-label={t('Ver el vídeo: {titulo}', { titulo })}
        title={t('Ver el vídeo: {titulo}', { titulo })} onClick={() => { setFallo(false); setAbierto(true); }}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      <Modal open={abierto} onClose={() => setAbierto(false)} title={titulo} wide>
        {abierto && (
          <div className="ayuda-video-cuerpo">
            {fallo ? (
              <p className="ayuda-video-fallo">{t('No se ha podido cargar el vídeo. Comprueba tu conexión e inténtalo de nuevo.')}</p>
            ) : (
              <video
                controls autoPlay playsInline preload="metadata" poster={urlVideo(id, 'jpg')} src={urlVideo(id, 'mp4')}
                onError={() => setFallo(true)}
              />
            )}
            {lang !== 'es' && <p className="ayuda-video-nota">{t('El vídeo está en español.')}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
