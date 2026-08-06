import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, X } from 'lucide-react';
import { parseScannedCode } from '../../services/p2p';
import { useI18n } from '../../i18n';

type ScanState = 'asking' | 'scanning' | 'denied' | 'unsupported';

interface Props {
  onDetected: (code: string) => void;
  onCancel: () => void;
}

/**
 * Lee el código de sesión con la cámara del equipo.
 * Solo analiza fotogramas en memoria: no graba ni envía nada.
 */
export function QRScanner({ onDetected, onCancel }: Props) {
  const { t } = useI18n();
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<ScanState>('asking');
  const [hint, setHint]   = useState('');

  // Evita avisar dos veces del mismo código si se detecta en varios fotogramas
  const doneRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        const video = videoRef.current;
        if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        setState('scanning');

        const tick = () => {
          if (cancelled || doneRef.current) return;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const img = ctx.getImageData(0, 0, w, h);
                const found = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
                if (found?.data) {
                  const code = parseScannedCode(found.data);
                  if (code) {
                    doneRef.current = true;
                    onDetected(code);
                    return;
                  }
                  setHint(t('Ese QR no es de una sesión de Aula Pro.'));
                }
              }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();

        cleanupRef.current = () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach(t => t.stop());
        };
      } catch {
        if (!cancelled) setState('denied');
      }
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [onDetected]);

  if (state === 'denied' || state === 'unsupported') {
    return (
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <CameraOff size={30} color="var(--text-3)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 16 }}>
          {t(state === 'unsupported'
            ? 'Este equipo no tiene cámara disponible.'
            : 'No se pudo usar la cámara. Permite el acceso en el navegador o escribe el código a mano.')}
        </p>
        <button className="btn-ghost" onClick={() => { stop(); onCancel(); }}>
          {t('Escribir el código a mano')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          position: 'relative', display: 'inline-block', borderRadius: 14,
          overflow: 'hidden', background: '#0f172a', lineHeight: 0,
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: 260, height: 200, objectFit: 'cover', display: 'block' }}
        />
        {/* Marco de puntería */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.85)',
            borderRadius: 14,
            margin: 34,
            width: 'calc(100% - 68px)', height: 'calc(100% - 68px)',
          }}
        />
        {state === 'asking' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, gap: 8 }}>
            <span className="spin" />{t('Pidiendo permiso…')}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.5 }}>
        <Camera size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />
        {t('Apunta al código QR de tu compañero/a')}
      </p>
      {hint && (
        <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 4 }}>{hint}</p>
      )}

      <button
        className="btn-ghost"
        style={{ marginTop: 12, fontSize: 12.5 }}
        onClick={() => { stop(); onCancel(); }}
      >
        <X size={13} />{t('Escribir el código a mano')}
      </button>
    </div>
  );
}
