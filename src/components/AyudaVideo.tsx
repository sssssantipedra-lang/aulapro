import { useState } from 'react';
import { Play } from 'lucide-react';
import { useI18n } from '../i18n';
import { Modal } from './ui/Modal';
import { VIDEOS_AYUDA, urlVideo, type VideoAyuda } from '../lib/videosAyuda';

/**
 * Una miniatura con la portada del vídeo y un botón de play junto al título de una pantalla: al pulsarla abre una ventana con el vídeo corto que la explica. El vídeo no se pide
 * hasta que se abre la ventana, y se sirve desde aulapro.app (ni YouTube ni nada de terceros, ni cookies).
 */
export function AyudaVideo({ id }: { id: VideoAyuda }) {
  const { t, lang } = useI18n();
  const [abierto, setAbierto] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [sinPortada, setSinPortada] = useState(false);
  const titulo = t(VIDEOS_AYUDA[id]);
  return (
    <>
      <button
        type="button" className="ayuda-video" aria-label={t('Ver el vídeo: {titulo}', { titulo })}
        title={t('Ver el vídeo: {titulo}', { titulo })} onClick={() => { setFallo(false); setAbierto(true); }}
      >
        <span className="ayuda-video-mini" aria-hidden="true">
          {!sinPortada && <img src={urlVideo(id, 'jpg')} alt="" loading="lazy" decoding="async" onError={() => setSinPortada(true)} />}
          <span className="ayuda-video-play"><Play size={11} fill="currentColor" /></span>
        </span>
        <span className="ayuda-video-txt">{t('Ver vídeo')}</span>
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
