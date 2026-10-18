/**
 * Sonidos cortos hechos con Web Audio, sin archivos. Un solo `AudioContext`
 * para toda la app: los navegadores limitan cuántos se pueden abrir.
 *
 * El sonido se puede apagar (preferencia del dispositivo): en clase no
 * siempre conviene que suene el móvil o el proyector.
 */

const CLAVE = 'aulapro_sonido_actitud';

export function sonidoActivo(): boolean {
  try { return localStorage.getItem(CLAVE) !== 'no'; } catch { return true; }
}

export function guardarSonido(activo: boolean): void {
  try { localStorage.setItem(CLAVE, activo ? 'si' : 'no'); } catch { /* solo dura esta sesión */ }
}

let ctx: AudioContext | null = null;

/** Notas de cada aviso: sube al sumar, baja al restar. */
const NOTAS = { suma: [660, 880], resta: [330, 247] } as const;

export function sonar(tipo: keyof typeof NOTAS): void {
  if (!sonidoActivo()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    NOTAS[tipo].forEach((hz, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = hz;
      osc.connect(gain);
      gain.connect(ctx!.destination);
      const t = t0 + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch { /* sin audio */ }
}
