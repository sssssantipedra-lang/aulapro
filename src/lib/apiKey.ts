/** Forma de una clave de Google: «AIza» y 35 caracteres más. */
export function looksLikeKey(k: string): boolean {
  return /^AIza[0-9A-Za-z_-]{35}$/.test(k.trim());
}
