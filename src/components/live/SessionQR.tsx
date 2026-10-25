import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Código QR de la sesión. Lleva el valor que se le pase: la dirección local
 * `http://<ip>:<puerto>/share?c=…` cuando hay canal local (para conectarse por
 * la wifi sin internet), o el enlace `aulapro://c/XXXXXX` si no.
 */
export function SessionQR({ value, size = 168 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    let cancelled = false;

    QRCode.toCanvas(canvas, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(() => { if (!cancelled) setFailed(false); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [value, size]);

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
