/**
 * Imágenes en las sesiones (25-10-2026, petición del dueño: «copio una imagen de
 * internet o de donde sea y la pego ahí; o arrastrarla»). Aquí está lo que no
 * es pantalla: de dónde sacar las imágenes de un pegado o de un arrastre, cómo
 * se reducen antes de guardarlas y cómo se comprueban al leerlas del disco.
 *
 * Van dentro de los datos del perfil (`SesionEF.imagenes`), como las fotos de
 * la agenda visual, así que se reducen: un lado mayor de 1.400 px en JPEG de
 * calidad 0,85, y menos si aun así pasan de unos 650 KB. Sale a unos cientos de
 * KB por imagen, de sobra para media página impresa.
 */
import type { ImagenSesion } from '../types/ef';
import type { SdaContent, SdaSession } from '../services/learningSituations';

/** Las que caben en una sesión: más haría pesados los datos y las copias de seguridad. */
export const MAX_IMAGENES_SESION = 12;
/** Lo más que ocupa una imagen ya reducida (caracteres de su `data:`), unos 650 KB. */
const MAX_CARACTERES = 900_000;
/** Lo más que se acepta al leer del disco: una copia editada a mano no puede colar un archivo enorme. */
const MAX_CARACTERES_LEIDA = 3_000_000;
/** Probar con menos lado y calidad hasta que quepa. */
const INTENTOS: { lado: number; calidad: number }[] = [
  { lado: 1400, calidad: 0.85 }, { lado: 1100, calidad: 0.75 }, { lado: 900, calidad: 0.7 },
];

/** Solo estos tipos: un SVG podría llevar código y no hace falta para nada. */
const DATA_URL_IMAGEN = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function nuevoIdImagen(): string {
  return 'im' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Lo que dice cada dato guardado: se descarta lo que no sea una imagen de verdad. */
export function imagenesValidas(v: unknown[]): ImagenSesion[] {
  const vistos = new Set<string>();
  const out: ImagenSesion[] = [];
  for (const x of v) {
    if (out.length >= MAX_IMAGENES_SESION) break;
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== 'string' || !o.id || vistos.has(o.id)) continue;
    if (typeof o.src !== 'string' || o.src.length > MAX_CARACTERES_LEIDA || !DATA_URL_IMAGEN.test(o.src)) continue;
    vistos.add(o.id);
    const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    out.push({
      id: o.id, src: o.src, ancho: num(o.ancho), alto: num(o.alto),
      ...(typeof o.pie === 'string' && o.pie.trim() ? { pie: o.pie.slice(0, 300) } : {}),
    });
  }
  return out;
}

/* ── De un pegado o un arrastre a imágenes ── */

/**
 * Lo que trae un pegado o un arrastre, leído de golpe: el navegador solo deja
 * mirar un `DataTransfer` mientras dura el evento, y descargar una imagen de
 * internet es asíncrono.
 */
export interface Transferencia {
  archivos: File[];
  html: string;
  /** Una dirección (`text/uri-list`, o un texto que es solo una dirección). */
  direccion: string;
  texto: string;
}

export function leerTransferencia(dt: DataTransfer | null | undefined): Transferencia {
  const vacia: Transferencia = { archivos: [], html: '', direccion: '', texto: '' };
  if (!dt) return vacia;
  let archivos = Array.from(dt.files ?? []).filter(f => f.type.startsWith('image/'));
  if (archivos.length === 0) {
    archivos = Array.from(dt.items ?? [])
      .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter((f): f is File => !!f);
  }
  const texto = dt.getData('text/plain') ?? '';
  const lista = (dt.getData('text/uri-list') ?? '').split('\n').map(l => l.trim()).find(l => l && !l.startsWith('#'));
  const soloDireccion = /^https?:\/\/\S+$/i.test(texto.trim()) ? texto.trim() : '';
  return { archivos, html: dt.getData('text/html') ?? '', direccion: lista || soloDireccion, texto };
}

const EXTENSION_IMAGEN = /\.(png|jpe?g|gif|webp|bmp|avif)(\?|#|$)/i;

/** Las direcciones de imagen que hay en un trozo de HTML copiado (`<img src>`), sin repetir. */
export function direccionesDeHtml(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.getAttribute('src')?.trim();
    if (src && (src.startsWith('data:image/') || /^https?:\/\//i.test(src)) && !out.includes(src)) out.push(src);
  }
  return out;
}

/** ¿Trae algo que parezca una imagen? Se mira al momento, para saber si hay que quedarse el pegado. */
export function traeImagen(t: Transferencia): boolean {
  if (t.archivos.length > 0) return true;
  if (direccionesDeHtml(t.html).length > 0) return true;
  return !!t.direccion && EXTENSION_IMAGEN.test(t.direccion);
}

/**
 * Las imágenes de una transferencia: los archivos que trae o, si no, las que se
 * descargan de las direcciones. `sinRecuperar` cuenta las que no se pudieron
 * traer (una web que no deja descargarlas, por ejemplo).
 */
export async function imagenesDeTransferencia(
  t: Transferencia,
  descargar: (url: string) => Promise<Blob> = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return r.blob();
  },
): Promise<{ blobs: Blob[]; sinRecuperar: number }> {
  if (t.archivos.length > 0) return { blobs: t.archivos, sinRecuperar: 0 };
  const urls = direccionesDeHtml(t.html);
  if (urls.length === 0 && t.direccion && EXTENSION_IMAGEN.test(t.direccion)) urls.push(t.direccion);
  const blobs: Blob[] = [];
  let sinRecuperar = 0;
  for (const url of urls) {
    try {
      const b = await descargar(url);
      if (b.type.startsWith('image/')) blobs.push(b); else sinRecuperar += 1;
    } catch {
      sinRecuperar += 1;
    }
  }
  return { blobs, sinRecuperar };
}

/* ── Reducir ── */

function cargar(file: Blob): Promise<{ img: HTMLImageElement; liberar: () => void }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, liberar: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No es una imagen')); };
    img.src = url;
  });
}

/** Reduce una imagen y la devuelve en JPEG. Lanza si no es una imagen que se pueda leer. */
export async function prepararImagen(file: Blob): Promise<{ src: string; ancho: number; alto: number }> {
  const { img, liberar } = await cargar(file);
  try {
    let ultima: { src: string; ancho: number; alto: number } | null = null;
    for (const { lado, calidad } of INTENTOS) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
      const alto = Math.max(1, Math.round(img.naturalHeight * escala));
      const lienzo = document.createElement('canvas');
      lienzo.width = ancho;
      lienzo.height = alto;
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('Sin lienzo');
      // Fondo blanco: un PNG con transparencia no se queda negro en JPEG
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, ancho, alto);
      ctx.drawImage(img, 0, 0, ancho, alto);
      ultima = { src: lienzo.toDataURL('image/jpeg', calidad), ancho, alto };
      if (ultima.src.length <= MAX_CARACTERES) break;
    }
    return ultima as { src: string; ancho: number; alto: number };
  } finally {
    liberar();
  }
}

/**
 * Prepara las imágenes nuevas, respetando el sitio que queda. Devuelve solo las
 * nuevas (quien llama las suma a lo que haya en ese momento, que puede haber
 * cambiado mientras se reducían) y cuántas se quedaron fuera por el tope o por
 * no ser imágenes legibles.
 */
export async function prepararNuevas(
  blobs: Blob[],
  sitio: number,
  preparar: (b: Blob) => Promise<{ src: string; ancho: number; alto: number }> = prepararImagen,
): Promise<{ nuevas: ImagenSesion[]; porElTope: number; ilegibles: number }> {
  const caben = blobs.slice(0, Math.max(0, sitio));
  const porElTope = blobs.length - caben.length;
  const nuevas: ImagenSesion[] = [];
  let ilegibles = 0;
  for (const b of caben) {
    try {
      nuevas.push({ id: nuevoIdImagen(), ...(await preparar(b)) });
    } catch {
      ilegibles += 1;
    }
  }
  return { nuevas, porElTope, ilegibles };
}

/* ── Imágenes en las sesiones de una situación de aprendizaje ── */

/** Las imágenes de una sesión de SdA que valen (solo `data:` de imagen), para pintarlas o exportarlas. */
export function imagenesDeSesionSda(s: Pick<SdaSession, 'imagenes'>): ImagenSesion[] {
  return s.imagenes?.length ? imagenesValidas(s.imagenes) : [];
}

/** La sesión con estas imágenes; sin ninguna, sin el campo. */
export function sesionConImagenes(s: SdaSession, imagenes: ImagenSesion[]): SdaSession {
  if (imagenes.length) return { ...s, imagenes };
  const { imagenes: _i, ...resto } = s;
  void _i;
  return resto;
}

/** El contenido sin las imágenes: lo que se compara y lo que va al borrador (pesan, y `localStorage` es pequeño). */
export function contenidoSinImagenes(c: SdaContent): SdaContent {
  if (!c.sesiones.some(s => s.imagenes)) return c;
  return { ...c, sesiones: c.sesiones.map(s => sesionConImagenes(s, [])) };
}

/** ¿Las imágenes de cada sesión son las mismas? Por referencia: es lo que hay que mirar tras editar, y no cuesta nada. */
export function mismasImagenes(a: SdaContent, b: SdaContent): boolean {
  return a.sesiones.length === b.sesiones.length && a.sesiones.every((s, i) => s.imagenes === b.sesiones[i].imagenes);
}

/** Devuelve a un contenido sin imágenes (el de un borrador) las que tenía el guardado, sesión a sesión. */
export function conImagenesDe(c: SdaContent, guardado: SdaContent | undefined): SdaContent {
  if (!guardado) return c;
  return {
    ...c,
    sesiones: c.sesiones.map((s, i) => {
      const g = guardado.sesiones[i];
      return g?.imagenes?.length && g.titulo === s.titulo ? sesionConImagenes(s, g.imagenes) : s;
    }),
  };
}

/** Los bytes de una imagen guardada (`data:image/…;base64,…`) y su tipo, para meterla en un Word. */
export function bytesDeImagen(src: string): { tipo: 'jpg' | 'png' | 'gif'; datos: Uint8Array } | null {
  const m = /^data:image\/(jpeg|png|gif);base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (!m) return null;   // WebP no lo admite Word
  const binario = atob(m[2]);
  const datos = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) datos[i] = binario.charCodeAt(i);
  return { tipo: m[1] === 'jpeg' ? 'jpg' : (m[1] as 'png' | 'gif'), datos };
}
