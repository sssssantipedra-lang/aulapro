/**
 * Qué currículo se usa para una comunidad y una etapa.
 *
 * Los currículos autonómicos van empaquetados dentro de la app, pero cada uno
 * en su propio archivo, y solo se abre el de la comunidad del perfil: ni todos
 * a la vez ni descargados de Internet (ver `docs/COMUNIDADES.md`). Mientras una
 * comunidad no tiene su decreto copiado, se usa el estatal, y el resultado lo
 * dice (`origen`) para que la interfaz avise en vez de dejar creer al docente
 * que está trabajando con el decreto de su comunidad.
 */

import { materiasDe, type CurriculumEntry, type Etapa } from './index';
import { NORMAS_ESTATALES, normasDe, type ComunidadId, type Norma } from './comunidades';

export type Cargador = () => Promise<CurriculumEntry[]>;
export type Cargadores = Partial<Record<ComunidadId, Partial<Record<Etapa, Cargador>>>>;

/**
 * Los currículos autonómicos que AulaPro ya lleva copiados. Cada entrada abre
 * su archivo de datos bajo demanda, así:
 *
 *   'madrid': {
 *     primaria: () => import('./data/madrid/primaria.json')
 *       .then(m => normalizarEntradas(m.default as unknown as RawEntry[])),
 *   }
 *
 * Una comunidad entra aquí solo cuando su decreto está copiado, comprobado con
 * los totales oficiales y con sus normas verificadas en `comunidades.ts`.
 */
export const CARGADORES: Cargadores = {};

export interface CurriculoActivo {
  comunidad: ComunidadId;
  etapa: Etapa;
  /** `estatal` también cuando la comunidad tiene decreto pero no se pudo abrir. */
  origen: 'autonomico' | 'estatal';
  materias: CurriculumEntry[];
  /** Las normas de las que sale este currículo, en el orden en que se aplican. */
  normas: Norma[];
}

export function tieneCurriculoPropio(
  comunidad: ComunidadId, etapa: Etapa, cargadores: Cargadores = CARGADORES,
): boolean {
  return !!cargadores[comunidad]?.[etapa];
}

/** Las etapas de las que AulaPro lleva copiado el decreto de esta comunidad. */
export function etapasConCurriculoPropio(
  comunidad: ComunidadId, cargadores: Cargadores = CARGADORES,
): Etapa[] {
  return (['primaria', 'eso'] as const).filter(e => tieneCurriculoPropio(comunidad, e, cargadores));
}

/** El currículo estatal, que está siempre disponible sin esperar a nada. */
export function curriculoEstatal(comunidad: ComunidadId, etapa: Etapa): CurriculoActivo {
  return { comunidad, etapa, origen: 'estatal', materias: materiasDe(etapa), normas: NORMAS_ESTATALES[etapa] };
}

/**
 * ¿Hay que avisar de que se usa el estatal por no tener el decreto de la
 * comunidad? No para «Fuera de España», que usa el estatal porque es lo que
 * le corresponde.
 */
export function usaEstatalPorFaltaDeDecreto(c: CurriculoActivo): boolean {
  return c.origen === 'estatal' && c.comunidad !== 'fuera';
}

const memoria = new WeakMap<Cargadores, Map<string, Promise<CurriculoActivo>>>();

/**
 * Abre el currículo de esta comunidad y etapa. Nunca rechaza: si no hay
 * decreto propio, o el archivo no se puede abrir, devuelve el estatal con
 * `origen: 'estatal'` — un docente sin currículo autonómico sigue pudiendo
 * trabajar, y la interfaz lo sabe.
 */
export function cargarCurriculo(
  comunidad: ComunidadId, etapa: Etapa, cargadores: Cargadores = CARGADORES,
): Promise<CurriculoActivo> {
  const cargador = cargadores[comunidad]?.[etapa];
  const normas = normasDe(comunidad, etapa);
  if (!cargador || !normas) return Promise.resolve(curriculoEstatal(comunidad, etapa));

  let porClave = memoria.get(cargadores);
  if (!porClave) { porClave = new Map(); memoria.set(cargadores, porClave); }
  const clave = `${comunidad}/${etapa}`;

  let pendiente = porClave.get(clave);
  if (!pendiente) {
    pendiente = cargador().then(
      (materias): CurriculoActivo => ({ comunidad, etapa, origen: 'autonomico', materias, normas }),
      () => {
        // No se recuerda el fallo: el siguiente intento vuelve a probar.
        porClave!.delete(clave);
        return curriculoEstatal(comunidad, etapa);
      },
    );
    porClave.set(clave, pendiente);
  }
  return pendiente;
}
