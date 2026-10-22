import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { shareUrl } from '../../services/p2p';

/**
 * Código QR de la sesión. Lleva el enlace `aulapro://c/XXXXXX`: si se escanea
 * con un móvil que tiene AulaPro, se abre la app con el código ya puesto; y el
 * lector de la propia app también sabe sacar el código de ese enlace.
 */
export function SessionQR({ code, size = 168 }: { code: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !code) return;
    let cancelled = false;

    QRCode.toCanvas(canvas, shareUrl(code), {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(() => { if (!cancelled) setFailed(false); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [code, size]);

  if (failed) return null;

  return (
    <div
      style={{
        display: 'inline-flex', padding: 10, borderRadius: 14,
        background: 'white', border: '1px solid var(--border)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      }}
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ display: 'block', borderRadius: 6 }} />
    </div>
  );
}
