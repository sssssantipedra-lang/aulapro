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
import { CARGADORES, type Cargadores } from './propios';
import {
  NORMAS_ESTATALES, idiomaDelTexto, normasDe,
  type ComunidadId, type IdiomaApp, type IdiomaOficial, type Norma,
} from './comunidades';

// Lo que no depende del currículo estatal está en `./propios.ts`; se sigue
// pudiendo importar desde aquí.
export {
  CARGADORES, conLosMismosSaberesEnCadaCiclo, etapasConCurriculoPropio, tieneCurriculoPropio,
  type Cargador, type Cargadores, type RawEntrySaberesComunes,
} from './propios';

export interface CurriculoActivo {
  comunidad: ComunidadId;
  etapa: Etapa;
  /** `estatal` también cuando la comunidad tiene decreto pero no se pudo abrir. */
  origen: 'autonomico' | 'estatal';
  /** Idioma del texto oficial de `materias`, el que de verdad se ha servido. */
  idioma: IdiomaOficial;
  materias: CurriculumEntry[];
  /** Las normas de las que sale este currículo, en el orden en que se aplican. */
  normas: Norma[];
}

/** El currículo estatal, que está siempre disponible sin esperar a nada. */
export function curriculoEstatal(comunidad: ComunidadId, etapa: Etapa): CurriculoActivo {
  return {
    comunidad, etapa, origen: 'estatal', idioma: 'es',
    materias: materiasDe(etapa), normas: NORMAS_ESTATALES[etapa],
  };
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
 * Abre el currículo de esta comunidad y etapa, en el idioma que corresponde a
 * la app. Nunca rechaza: si no hay decreto propio, o el archivo no se puede
 * abrir, devuelve el estatal con `origen: 'estatal'` — un docente sin
 * currículo autonómico sigue pudiendo trabajar, y la interfaz lo sabe.
 */
export function cargarCurriculo(
  comunidad: ComunidadId, etapa: Etapa, idiomaApp: IdiomaApp = 'es', cargadores: Cargadores = CARGADORES,
): Promise<CurriculoActivo> {
  const cargador = cargadores[comunidad]?.[etapa];
  const normas = normasDe(comunidad, etapa);
  if (!cargador || !normas) return Promise.resolve(curriculoEstatal(comunidad, etapa));

  const idioma = idiomaDelTexto(comunidad, idiomaApp);
  let porClave = memoria.get(cargadores);
  if (!porClave) { porClave = new Map(); memoria.set(cargadores, porClave); }
  const clave = `${comunidad}/${etapa}/${idioma}`;

  let pendiente = porClave.get(clave);
  if (!pendiente) {
    pendiente = cargador(idioma).then(
      (abierto): CurriculoActivo => ({
        comunidad, etapa, origen: 'autonomico', idioma: abierto.idioma, materias: abierto.materias, normas,
      }),
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
