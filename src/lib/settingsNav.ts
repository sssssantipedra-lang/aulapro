/**
 * Apartado de Configuración que se quiere abrir al llegar. Lo usan los avisos
 * de «Configurar la IA» repartidos por la aplicación: en vez de dejar al
 * docente en la cuadrícula de Configuración, lo llevan directos a la clave.
 */
export type SettingsPanel = 'perfil' | 'ia' | 'idioma' | 'apariencia' | 'seguridad' | 'datos';

let pending: SettingsPanel | null = null;

export function requestSettingsPanel(p: SettingsPanel) {
  pending = p;
}

/** Lo lee Configuración al abrirse, una sola vez. */
export function takeSettingsPanel(): SettingsPanel | null {
  const p = pending;
  pending = null;
  return p;
}
