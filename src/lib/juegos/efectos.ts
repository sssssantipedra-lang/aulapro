/**
 * Los sonidos cortos de los juegos (26-11-2026), hechos con Web Audio, sin archivos: un «tic» en los últimos segundos,
 * fijar el marcador, el número que cae, ganar un punto, el empate y la fanfarria final. Se callan con el altavoz del
 * juego (preferencia del dispositivo, `aulapro_juegos_silencio`). Un solo `AudioContext`, creado al primer sonido
 * (después de un gesto: los navegadores no dejan sonar antes).
 */

const CLAVE = 'aulapro_juegos_silencio';

export function leerSilencioJuegos(): boolean {
  try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
}
export function guardarSilencioJuegos(si: boolean): void {
  try { localStorage.setItem(CLAVE, si ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

export type Efecto = 'tic' | 'fijar' | 'caer' | 'punto' | 'empate' | 'nada' | 'fin';

/** Cada efecto: sus notas (Hz), cuándo empieza cada una (s), lo que dura y la forma de la onda. */
const NOTAS: Record<Efecto, { hz: number[]; paso: number; dura: number; onda: OscillatorType; vol: number; desliza?: number }> = {
  tic: { hz: [1200], paso: 0, dura: 0.05, onda: 'square', vol: 0.05 },
  fijar: { hz: [520, 780], paso: 0.06, dura: 0.12, onda: 'triangle', vol: 0.14 },
  caer: { hz: [1400], paso: 0, dura: 0.45, onda: 'sine', vol: 0.1, desliza: 380 },
  punto: { hz: [523, 659, 784, 1047], paso: 0.08, dura: 0.18, onda: 'triangle', vol: 0.14 },
  empate: { hz: [523, 523], paso: 0.12, dura: 0.16, onda: 'triangle', vol: 0.12 },
  nada: { hz: [330, 262], paso: 0.12, dura: 0.2, onda: 'sine', vol: 0.1 },
  fin: { hz: [523, 659, 784, 659, 784, 1047], paso: 0.11, dura: 0.22, onda: 'triangle', vol: 0.15 },
};

let ctx: AudioContext | null = null;

export function sonarEfecto(e: Efecto, silencio: boolean): void {
  if (silencio || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const n = NOTAS[e];
    const t0 = ctx.currentTime;
    n.hz.forEach((hz, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = n.onda;
      const t = t0 + i * n.paso;
      osc.frequency.setValueAtTime(hz, t);
      if (n.desliza) osc.frequency.exponentialRampToValueAtTime(n.desliza, t + n.dura);
      osc.connect(gain);
      gain.connect(ctx!.destination);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(n.vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dura);
      osc.start(t);
      osc.stop(t + n.dura + 0.02);
    });
  } catch { /* sin audio */ }
}
