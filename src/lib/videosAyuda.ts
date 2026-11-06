/** Los vídeos de ayuda (`web/sitio/assets/videos/`): el mismo dominio que la app, sin servicios de terceros. */
export const VIDEOS_AYUDA = {
  'primeros-pasos': 'Empezar con AulaPro',
  'cuaderno-notas': 'El cuaderno de notas',
  'asistencia-actitud': 'Asistencia y actitud',
  'crear-rubrica': 'Crear una rúbrica y evaluar',
  'clave-ia': 'Conseguir la clave de la IA',
  'privacidad': 'Tus datos y la privacidad',
  'inicio': 'Tu jornada en Inicio',
  'agenda': 'La agenda y el horario',
  'dianas-escalas': 'Dianas y escalas de registro',
  'informes': 'Informes para las familias',
  'actas': 'Actas de calificaciones',
  'situaciones-aprendizaje': 'Situaciones de aprendizaje',
  'sesiones': 'Las sesiones de cada clase',
  'recursos': 'Fichas y recursos',
  'distribucion-aula': 'Distribución del aula',
  'pizarra': 'Pizarra y herramientas',
  'reuniones-formaciones': 'Reuniones y formaciones',
  'trabajo-compartido': 'Trabajo compartido',
  'configuracion': 'Configurar AulaPro',
} as const;
export type VideoAyuda = keyof typeof VIDEOS_AYUDA;

const PRINCIPAL = 'https://aulapro.app/assets/videos/';
/** Los sitios de AulaPro (producción, respaldo y copias de prueba de Cloudflare): ahí los vídeos se piden al mismo sitio desde el que se abrió la app. */
const SITIOS = /^(www\.)?aulapro\.app$|^([a-z0-9-]+\.)?aulapro-app\.pages\.dev$|^aulapro-respaldo\.netlify\.app$/;

/**
 * Dónde están los vídeos. Abierta desde un sitio de AulaPro, en ese mismo sitio (así la copia de prueba enseña los vídeos que
 * aún no están en aulapro.app, y si cae un servidor sirve el otro); en cualquier otro caso, desde aulapro.app.
 */
export function baseVideos(origen: { protocol: string; hostname: string; origin: string } | undefined = typeof location !== 'undefined' ? location : undefined): string {
  if (origen && origen.protocol === 'https:' && SITIOS.test(origen.hostname)) return `${origen.origin}/assets/videos/`;
  return PRINCIPAL;
}

export const urlVideo = (id: VideoAyuda, ext: 'mp4' | 'jpg') => `${baseVideos()}${id}.${ext}`;
