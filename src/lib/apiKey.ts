/**
 * ¿Lo copiado puede ser una clave? Google tiene varios formatos y cambian, así
 * que aquí no se mira cómo empieza: solo que sea una palabra larga, sin
 * espacios. Si vale o no lo dice la prueba con Google al guardarla.
 */
export function looksLikeKey(k: string): boolean {
  return /^\S{20,}$/.test(k.trim());
}
