import { useI18n } from '../i18n';
import type { CursoDe } from '../types/apoyo';

/** «3º Primaria», «1º ESO», en el idioma de la app. */
export function useNombreCurso(): (c: CursoDe) => string {
  const { t } = useI18n();
  return c => t(c.etapa === 'primaria' ? '{n}º Primaria' : '{n}º ESO', { n: c.curso });
}
