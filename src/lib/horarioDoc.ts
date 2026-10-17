/**
 * El documento del horario: el docente sube su PDF (o una foto) y la Agenda lo
 * muestra tal cual, sin que lo lea la IA. Se guarda dentro del perfil, por eso
 * se limita el peso: los PDF de horarios pesan decenas de KB, y las fotos se
 * reducen antes de guardarlas.
 */
import type { HorarioDocumento } from '../types';
import { fileToBase64 } from './utils';

/** Lo máximo que se guarda de un PDF. */
export const MAX_HORARIO_BYTES = 4 * 1024 * 1024;
/** Lado mayor de una foto una vez reducida: se lee bien y pesa poco. */
const LADO_MAX_FOTO = 2000;

export type TipoHorario = 'pdf' | 'imagen';

export function tipoHorario(mimeType: string, name = ''): TipoHorario | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf' || (!mime && /\.pdf$/i.test(name))) return 'pdf';
  if (mime.startsWith('image/')) return 'imagen';
  if (!mime && /\.(png|jpe?g|webp|gif|heic)$/i.test(name)) return 'imagen';
  return null;
}

/** El PDF empieza siempre por «%PDF»: así no se guarda otro archivo con la extensión cambiada. */
export function parecePdf(base64: string): boolean {
  try { return atob(base64.slice(0, 8)).startsWith('%PDF'); } catch { return false; }
}

/** Peso real de un base64, en bytes. */
export function bytesDeBase64(base64: string): number {
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - relleno;
}

/** Reduce una foto a JPEG de, como mucho, `LADO_MAX_FOTO` píxeles de lado. */
async function reducirFoto(file: File): Promise<{ mimeType: string; base64: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('imagen'));
      el.src = url;
    });
    const escala = Math.min(1, LADO_MAX_FOTO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    // Una captura con transparencia saldría negra en JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { mimeType: 'image/jpeg', base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ResultadoHorario =
  | { ok: true; doc: HorarioDocumento }
  | { ok: false; error: 'tipo' | 'peso' | 'lectura' };

/** Convierte el archivo elegido en el documento que se guarda, o dice por qué no vale. */
export async function documentoDeArchivo(file: File): Promise<ResultadoHorario> {
  const tipo = tipoHorario(file.type, file.name);
  if (!tipo) return { ok: false, error: 'tipo' };
  try {
    let mimeType: string;
    let base64: string;
    if (tipo === 'pdf') {
      if (file.size > MAX_HORARIO_BYTES) return { ok: false, error: 'peso' };
      ({ base64 } = await fileToBase64(file));
      mimeType = 'application/pdf';
      if (!parecePdf(base64)) return { ok: false, error: 'tipo' };
    } else {
      ({ mimeType, base64 } = await reducirFoto(file));
    }
    if (bytesDeBase64(base64) > MAX_HORARIO_BYTES) return { ok: false, error: 'peso' };
    return { ok: true, doc: { name: file.name, mimeType, base64, addedAt: new Date().toISOString() } };
  } catch {
    return { ok: false, error: 'lectura' };
  }
}

/**
 * Lo que trae un perfil o una copia de seguridad puede haberse editado a
 * mano: solo se acepta un documento con la forma esperada.
 */
export function horarioDocValido(v: unknown): HorarioDocumento | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Partial<HorarioDocumento>;
  if (typeof d.base64 !== 'string' || !d.base64 || typeof d.mimeType !== 'string') return null;
  if (!tipoHorario(d.mimeType)) return null;
  return {
    name: typeof d.name === 'string' ? d.name : 'horario',
    mimeType: d.mimeType,
    base64: d.base64,
    addedAt: typeof d.addedAt === 'string' ? d.addedAt : '',
  };
}
