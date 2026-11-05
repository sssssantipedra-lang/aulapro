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

const BASE = 'https://aulapro.app/assets/videos/';
export const urlVideo = (id: VideoAyuda, ext: 'mp4' | 'jpg') => `${BASE}${id}.${ext}`;
