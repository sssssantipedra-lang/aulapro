import { esPaquete, type SharedBundle } from './paquete';

/**
 * Copia cifrada para compartir datos con otro docente (25-10-2026).
 *
 * Sustituye al antiguo «Trabajo compartido» por QR y código (ver
 * `docs/COMPARTIR.md`). El docente que envía elige qué comparte, la app lo mete
 * en un archivo cifrado con una contraseña, y el otro docente lo abre en su
 * AulaPro con esa contraseña. El archivo puede viajar por cualquier medio
 * (correo, WhatsApp, Drive): sin la contraseña no se puede leer.
 *
 * Cifrado:
 *  - Clave: PBKDF2-SHA256 con 600.000 vueltas y una sal aleatoria de 16 bytes,
 *    a partir de la contraseña. Es lo que ofrece Web Crypto en Windows y en
 *    Android sin añadir librerías.
 *  - Datos: AES-256-GCM con un vector de inicio aleatorio de 12 bytes. GCM
 *    autentica: un archivo tocado o una contraseña equivocada fallan, no dan
 *    datos a medias. Los parámetros de la cabecera van como datos asociados,
 *    así que cambiarlos también hace fallar el descifrado.
 *
 * Lo que NO se puede garantizar, y la pantalla lo dice: que «solo la app» lo
 * lea. La seguridad está en la contraseña, no en esconder el formato (que es
 * este, público); cualquiera que tenga el archivo y la contraseña puede leerlo
 * con otra herramienta. Una clave metida dentro de la app no serviría de nada:
 * la app se puede abrir y esa clave se sacaría. Por eso la contraseña la pone
 * quien envía y la comunica por otro medio.
 *
 * La contraseña no se guarda ni se envía a ninguna parte.
 */

const VERSION = 1;
const ITERACIONES = 600_000;
/** Una cabecera con muchas más vueltas sería un archivo hecho para colgar la app. */
const ITER_MIN = 100_000;
const ITER_MAX = 3_000_000;
const LARGO_SAL = 16;
const LARGO_IV = 12;
export const LARGO_MINIMO_CONTRASENA = 10;

/** Sin caracteres que se confundan al dictarlos: 0/O, 1/I/L. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO_GENERADA = 16;

/** El archivo tal como se guarda. Solo la cabecera va en claro. */
export interface CopiaCifrada {
  _app: 'AulaPro';
  _tipo: 'compartido';
  _cifrada: true;
  v: number;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  alg: 'AES-256-GCM';
  sal: string;
  iv: string;
  datos: string;
}

/** Lo que va dentro, cifrado. */
export interface ContenidoCompartido {
  /** Quién lo envía: el nombre que tiene en su perfil. */
  de: string;
  /** Cuándo se creó, en ISO. */
  creado: string;
  paquete: SharedBundle;
}

export type CodigoError =
  /** Este equipo no tiene Web Crypto. */
  | 'sin-cripto'
  /** No es un archivo de AulaPro, o está dañado. */
  | 'formato'
  /** Lo creó una versión más nueva de AulaPro. */
  | 'version'
  /** La contraseña no es la correcta, o el archivo se ha modificado. */
  | 'contrasena'
  /** Se descifró bien, pero lo de dentro no es un paquete de datos. */
  | 'paquete';

export class CopiaError extends Error {
  readonly codigo: CodigoError;
  constructor(codigo: CodigoError) {
    super(codigo);
    this.name = 'CopiaError';
    this.codigo = codigo;
  }
}

/* ── Contraseña ── */

/** Una contraseña aleatoria fácil de dictar: `ABCD-EFGH-JKMN-PQRS` (unos 79 bits). */
export function generarContrasena(): string {
  const letras: string[] = [];
  // Rechazo para no favorecer unos símbolos: 256 no es múltiplo de 31.
  const tope = 256 - (256 % ALFABETO.length);
  while (letras.length < LARGO_GENERADA) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const b of bytes) {
      if (b < tope && letras.length < LARGO_GENERADA) letras.push(ALFABETO[b % ALFABETO.length]);
    }
  }
  const trozos = letras.join('').match(/.{4}/g) ?? [];
  return trozos.join('-');
}

/**
 * Deja la contraseña como se usa para cifrar. Una generada se acepta con
 * minúsculas, sin guiones o con espacios (se dicta por teléfono); cualquier
 * otra se usa tal cual, solo normalizada y sin espacios en los extremos.
 */
export function normalizarContrasena(entrada: string): string {
  const c = (entrada ?? '').normalize('NFKC').trim();
  const compacta = c.replace(/[\s-]/g, '').toUpperCase();
  const patron = new RegExp(`^[${ALFABETO}]{${LARGO_GENERADA}}$`);
  return patron.test(compacta) ? compacta : c;
}

export function contrasenaValida(entrada: string): boolean {
  return normalizarContrasena(entrada).length >= LARGO_MINIMO_CONTRASENA;
}

/* ── Utilidades ── */

function aBase64(bytes: Uint8Array): string {
  let s = '';
  // Por trozos: pasar de golpe un archivo grande a `fromCharCode` desborda la pila.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function deBase64(texto: string): Uint8Array {
  const s = atob(texto);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function cripto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new CopiaError('sin-cripto');
  return subtle;
}

/** Datos asociados: ata el contenido a los parámetros de la cabecera. */
function asociados(v: number, iter: number): Uint8Array {
  return new TextEncoder().encode(`AulaPro|${v}|PBKDF2-SHA256|${iter}|AES-256-GCM`);
}

async function derivarClave(contrasena: string, sal: Uint8Array, iter: number): Promise<CryptoKey> {
  const subtle = cripto();
  const base = await subtle.importKey('raw', new TextEncoder().encode(normalizarContrasena(contrasena)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ── Cifrar y descifrar ── */

/** Cifra el contenido con la contraseña y devuelve el texto del archivo. */
export async function cifrarCopia(contenido: ContenidoCompartido, contrasena: string): Promise<string> {
  const subtle = cripto();
  const sal = crypto.getRandomValues(new Uint8Array(LARGO_SAL));
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_IV));
  const clave = await derivarClave(contrasena, sal, ITERACIONES);
  const cifrado = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: asociados(VERSION, ITERACIONES) as BufferSource },
    clave,
    new TextEncoder().encode(JSON.stringify(contenido)),
  );
  const copia: CopiaCifrada = {
    _app: 'AulaPro', _tipo: 'compartido', _cifrada: true,
    v: VERSION, kdf: 'PBKDF2-SHA256', iter: ITERACIONES, alg: 'AES-256-GCM',
    sal: aBase64(sal), iv: aBase64(iv), datos: aBase64(new Uint8Array(cifrado)),
  };
  return JSON.stringify(copia);
}

function leerCabecera(texto: string): CopiaCifrada | null {
  try {
    const x = JSON.parse(texto) as Partial<CopiaCifrada>;
    if (x && x._app === 'AulaPro' && x._cifrada === true && x._tipo === 'compartido') return x as CopiaCifrada;
  } catch { /* no es JSON */ }
  return null;
}

/** ¿Es el archivo de una copia cifrada de AulaPro? (para distinguirla de una copia de seguridad normal) */
export function esCopiaCifrada(texto: string): boolean {
  return leerCabecera(texto) !== null;
}

/** Abre una copia cifrada. Lanza `CopiaError` con el motivo si no se puede. */
export async function descifrarCopia(texto: string, contrasena: string): Promise<ContenidoCompartido> {
  const subtle = cripto();
  const c = leerCabecera(texto);
  if (!c) throw new CopiaError('formato');
  if (typeof c.v !== 'number' || c.v > VERSION) throw new CopiaError('version');
  if (c.kdf !== 'PBKDF2-SHA256' || c.alg !== 'AES-256-GCM'
    || typeof c.iter !== 'number' || c.iter < ITER_MIN || c.iter > ITER_MAX
    || typeof c.sal !== 'string' || typeof c.iv !== 'string' || typeof c.datos !== 'string') {
    throw new CopiaError('formato');
  }

  let sal: Uint8Array, iv: Uint8Array, datos: Uint8Array;
  try {
    sal = deBase64(c.sal); iv = deBase64(c.iv); datos = deBase64(c.datos);
  } catch { throw new CopiaError('formato'); }
  if (sal.length !== LARGO_SAL || iv.length !== LARGO_IV || datos.length < 16) throw new CopiaError('formato');

  let plano: ArrayBuffer;
  try {
    const clave = await derivarClave(contrasena, sal, c.iter);
    plano = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: asociados(c.v, c.iter) as BufferSource },
      clave,
      datos as BufferSource,
    );
  } catch (e) {
    if (e instanceof CopiaError) throw e;
    // Contraseña equivocada y archivo modificado fallan igual a propósito: no se distinguen.
    throw new CopiaError('contrasena');
  }

  try {
    const contenido = JSON.parse(new TextDecoder().decode(plano)) as Partial<ContenidoCompartido>;
    if (contenido && typeof contenido.de === 'string' && typeof contenido.creado === 'string' && esPaquete(contenido.paquete)) {
      return contenido as ContenidoCompartido;
    }
  } catch { /* JSON ilegible */ }
  throw new CopiaError('paquete');
}
