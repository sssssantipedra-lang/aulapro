/** Los vídeos de ayuda (`web/sitio/assets/videos/`): el mismo dominio que la app, sin servicios de terceros. */
export const VIDEOS_AYUDA = {
  'primeros-pasos': 'Empezar con AulaPro',
  'cuaderno-notas': 'El cuaderno de notas',
  'asistencia-actitud': 'Asistencia y actitud',
  'crear-rubrica': 'Crear una rúbrica y evaluar',
  'clave-ia': 'Conseguir la clave de la IA',
  'privacidad': 'Tus datos y la privacidad',
} as const;
export type VideoAyuda = keyof typeof VIDEOS_AYUDA;

const BASE = 'https://aulapro.app/assets/videos/';
export const urlVideo = (id: VideoAyuda, ext: 'mp4' | 'jpg') => `${BASE}${id}.${ext}`;
