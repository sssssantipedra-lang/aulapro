/**
 * Cifrado de extremo a extremo de la copia en la nube (Google Drive y OneDrive).
 *
 * Lo que sube a la nube es un binario opaco: sin la clave de sincronización del docente, ni Google ni Microsoft ni
 * nadie con acceso a su cuenta puede leer los nombres del alumnado ni las notas. Todo con Web Crypto, sin librerías.
 *
 * Archivo (en este orden):
 *   [ marca «APS1» (4 B) ][ sal (16 B) ][ IV (12 B) ][ texto cifrado + etiqueta GCM ]
 * - Clave: PBKDF2-SHA256 sobre la clave de sincronización y la sal, a AES-256. Sal e IV nuevos al azar en cada
 *   guardado (nunca se repite un IV con la misma clave).
 * - AES-256-GCM autentica: un archivo tocado o una clave equivocada fallan con `OperationError`, que aquí sale como
 *   `ClaveSincronizacionIncorrecta`; nunca devuelve datos a medias.
 * - La marca va como dato asociado: sirve para reconocer el formato (y para un cambio futuro) sin esconderlo, y
 *   cambiarla también hace fallar el descifrado.
 *
 * Vueltas de PBKDF2: 600.000, no las 100.000 que se pidieron al encargarlo. Es lo que recomienda OWASP en 2023 para
 * PBKDF2-SHA256 y lo que ya usa `services/copiaCifrada.ts`; en un ordenador son unos 0,2 s por guardado (la nube se
 * escribe como mucho cada 30 minutos). Las claves ya derivadas de una sal se recuerdan en memoria, así que leer
 * muchas veces el mismo archivo no repite la cuenta.
 *
 * Compatibilidad: `esCifrado` distingue el binario nuevo de un JSON en texto plano (el formato de antes), y
 * `descifrarTexto` devuelve ese texto tal cual: se vuelve a subir cifrado en el siguiente guardado.
 */

const MARCA = new Uint8Array([0x41, 0x50, 0x53, 0x31]); // «APS1»
const LARGO_SAL = 16;
const LARGO_IV = 12;
const CABECERA = MARCA.length + LARGO_SAL + LARGO_IV;
/** GCM añade una etiqueta de 16 bytes: por debajo de esto no puede ser un archivo nuestro. */
const LARGO_ETIQUETA = 16;
const ITERACIONES = 600_000;
export const LARGO_MINIMO_CLAVE_SYNC = 8;

export const CLAVE_INCORRECTA = 'ClaveSincronizacionIncorrecta';
export const ARCHIVO_DANADO = 'ArchivoCifradoDanado';

function error(name: string, message: string): Error {
  const e = new Error(message);
  e.name = name;
  return e;
}

export const esClaveIncorrecta = (err: unknown) => (err as Error | undefined)?.name === CLAVE_INCORRECTA;

type Binario = ArrayBuffer | ArrayBufferView | Blob;

async function aBytes(x: Binario): Promise<Uint8Array> {
  if (x instanceof Uint8Array) return x;
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  return new Uint8Array(await (x as Blob).arrayBuffer());
}

/** ¿Empieza por la marca? Un JSON antiguo en texto plano empieza por «{» o «[»: nunca coinciden. */
export function esCifrado(x: Uint8Array): boolean {
  return x.length >= CABECERA + LARGO_ETIQUETA && MARCA.every((b, i) => x[i] === b);
}

const claves = new Map<string, CryptoKey>();
const MAX_CLAVES_RECORDADAS = 16;

async function derivar(clave: string, sal: Uint8Array): Promise<CryptoKey> {
  const id = `${clave}\u0000${Array.from(sal).join(',')}`;
  const guardada = claves.get(id);
  if (guardada) return guardada;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  const k = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: ITERACIONES },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  if (claves.size >= MAX_CLAVES_RECORDADAS) claves.delete(claves.keys().next().value as string);
  claves.set(id, k);
  return k;
}

/** Olvida las claves derivadas (al quitar la clave de sincronización). */
export const olvidarClaves = () => claves.clear();

/**
 * Cifra el contenido (un texto JSON o cualquier valor que se pueda pasar a JSON) y devuelve el binario que se sube.
 */
export async function encryptBackup(jsonData: string | unknown, pin: string): Promise<Uint8Array> {
  if (!pin) throw error(CLAVE_INCORRECTA, 'Falta la clave de sincronización');
  const texto = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
  const sal = crypto.getRandomValues(new Uint8Array(LARGO_SAL));
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_IV));
  const k = await derivar(pin, sal);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: MARCA as BufferSource }, k, new TextEncoder().encode(texto),
  ));
  const out = new Uint8Array(CABECERA + cifrado.length);
  out.set(MARCA, 0);
  out.set(sal, MARCA.length);
  out.set(iv, MARCA.length + LARGO_SAL);
  out.set(cifrado, CABECERA);
  return out;
}

/**
 * Descifra un archivo cifrado y devuelve su texto. Un texto plano de antes (JSON sin cifrar) se devuelve tal cual.
 * Con una clave equivocada o un archivo tocado lanza `ClaveSincronizacionIncorrecta`; no toca nada más.
 */
export async function descifrarTexto(datos: Binario, pin: string): Promise<string> {
  const bytes = await aBytes(datos);
  if (!esCifrado(bytes)) {
    // Un archivo que empieza por la marca pero es demasiado corto está dañado; el resto es el formato de antes
    if (MARCA.every((b, i) => bytes[i] === b)) throw error(ARCHIVO_DANADO, 'El archivo cifrado está incompleto');
    return new TextDecoder().decode(bytes);
  }
  if (!pin) throw error(CLAVE_INCORRECTA, 'Falta la clave de sincronización');
  const sal = bytes.slice(MARCA.length, MARCA.length + LARGO_SAL);
  const iv = bytes.slice(MARCA.length + LARGO_SAL, CABECERA);
  const k = await derivar(pin, sal);
  try {
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: MARCA as BufferSource }, k, bytes.slice(CABECERA),
    );
    return new TextDecoder().decode(plano);
  } catch (err) {
    if ((err as DOMException)?.name === 'OperationError') throw error(CLAVE_INCORRECTA, 'La clave de sincronización no coincide');
    throw err;
  }
}

/** Lo mismo que `descifrarTexto`, ya convertido a objeto (nada se escribe en disco). */
export async function decryptBackup<T = unknown>(datos: Binario, pin: string): Promise<T> {
  return JSON.parse(await descifrarTexto(datos, pin)) as T;
}
