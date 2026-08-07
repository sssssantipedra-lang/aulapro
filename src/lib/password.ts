/**
 * Contraseña opcional de cada perfil.
 *
 * Solo se guarda un hash (SHA-256 con sal aleatoria), nunca la contraseña en
 * claro. Es una cortina para que un compañero que use el mismo ordenador no
 * vea de un vistazo las notas de otro docente al abrir la app — no es
 * cifrado del archivo de datos, que sigue siendo un JSON legible en disco
 * para quien tenga acceso directo al equipo o a esa carpeta.
 */

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function digest(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return toHex(buf);
}

/** Genera la sal y el hash para guardar al fijar o cambiar la contraseña. */
export async function createPasswordFields(password: string): Promise<{ passwordSalt: string; passwordHash: string }> {
  const passwordSalt = randomSalt();
  const passwordHash = await digest(password, passwordSalt);
  return { passwordSalt, passwordHash };
}

/** Comprueba una contraseña introducida contra la sal y el hash guardados. */
export async function verifyPassword(password: string, passwordSalt: string, passwordHash: string): Promise<boolean> {
  return (await digest(password, passwordSalt)) === passwordHash;
}
