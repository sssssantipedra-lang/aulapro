/**
 * Comunidades autónomas y los decretos que fijan su currículo.
 *
 * Es el registro del que parte todo lo demás: el perfil del docente guarda un
 * `ComunidadId`, y de él salen qué decreto se cita, en qué idioma está el texto
 * oficial y si AulaPro ya lleva ese decreto copiado o todavía usa el estatal.
 * Las decisiones están en `docs/COMUNIDADES.md`.
 *
 * Aquí solo hay metadatos de las normas. Los datos del currículo de cada
 * comunidad viven aparte y se cargan bajo demanda (ver `./cargar.ts`): una
 * comunidad figura en la lista desde el primer día, pero solo se considera
 * «con currículo propio» cuando existe quien lo carga.
 *
 * Los títulos de las normas se citan tal y como los publica el boletín, sin
 * traducir (un título legal traducido deja de ser el oficial). Por eso cada
 * texto va en el idioma en que se publicó: castellano, catalán o los dos, como
 * en la Comunitat Valenciana. Mientras una norma no se haya comprobado contra
 * el boletín, lleva `verificada: false` y la prueba de este módulo impide que
 * una comunidad con currículo propio dependa de una cita sin comprobar.
 */

import type { Etapa } from './index';

/** Idiomas en los que se publica el texto oficial. */
export type IdiomaOficial = 'es' | 'ca';

/** Idiomas de la interfaz con los que se muestra el nombre de la comunidad. */
export type IdiomaApp = 'es' | 'ca' | 'en';

/** Un mismo texto en cada idioma en que se publicó (puede ser solo uno). */
export type Textos = Partial<Record<IdiomaOficial, string>>;

export interface Norma {
  /** `matriz` es el decreto base; `modificacion` lo cambia, y se aplica encima. */
  tipo: 'matriz' | 'modificacion';
  /** Título completo, literal. */
  titulo: Textos;
  /** «Decreto 61/2022, de 13 de julio», para citar en una línea. */
  corto: Textos;
  /** «BOCM núm. 169, de 18 de julio de 2022». */
  boletin: Textos;
  /**
   * `true` cuando el título, el número y el boletín se han comprobado contra
   * la publicación oficial, no solo contra una referencia de segunda mano.
   */
  verificada: boolean;
}

export type ComunidadId =
  | 'andalucia' | 'aragon' | 'asturias' | 'baleares' | 'canarias' | 'cantabria'
  | 'castilla-la-mancha' | 'castilla-y-leon' | 'cataluna' | 'ceuta'
  | 'comunitat-valenciana' | 'extremadura' | 'galicia' | 'la-rioja' | 'madrid'
  | 'melilla' | 'murcia' | 'navarra' | 'pais-vasco'
  /** Fuera de España, o quien no quiere comunidad: usa el currículo estatal. */
  | 'fuera';

export interface Comunidad {
  id: ComunidadId;
  nombre: Record<IdiomaApp, string>;
  /**
   * Idioma(s) en que la comunidad publica su currículo. Con dos, se guardan
   * las dos versiones y se usa la del idioma de la app; con uno, ese es el
   * que se muestra aunque la app esté en otro. Vacío mientras la comunidad no
   * tiene decreto registrado: no se afirma nada que no se haya comprobado.
   */
  idiomas: IdiomaOficial[];
  /**
   * Normas por etapa, en el orden en que se aplican: primero la matriz y
   * después sus modificaciones. Una norma puede aparecer en las dos etapas
   * (Cataluña regula Primaria y ESO con un único decreto). Sin la etapa, la
   * comunidad todavía no tiene su decreto registrado.
   */
  normas: Partial<Record<Etapa, Norma[]>>;
}

/* ── Estatal: la base que se usa mientras una comunidad no tiene la suya ── */

const RD_PRIMARIA: Norma = {
  tipo: 'matriz',
  titulo: { es: 'Real Decreto 157/2022, de 1 de marzo, por el que se establecen la ordenación y las enseñanzas mínimas de la Educación Primaria.' },
  corto: { es: 'Real Decreto 157/2022, de 1 de marzo' },
  boletin: { es: 'BOE núm. 52, de 2 de marzo de 2022' },
  verificada: true,
};

const RD_ESO: Norma = {
  tipo: 'matriz',
  titulo: { es: 'Real Decreto 217/2022, de 29 de marzo, por el que se establece la ordenación y las enseñanzas mínimas de la Educación Secundaria Obligatoria.' },
  corto: { es: 'Real Decreto 217/2022, de 29 de marzo' },
  boletin: { es: 'BOE núm. 76, de 30 de marzo de 2022' },
  verificada: true,
};

export const NORMAS_ESTATALES: Record<Etapa, Norma[]> = {
  primaria: [RD_PRIMARIA],
  eso: [RD_ESO],
};

/* ── Comunitat Valenciana ──
   Cada etapa tiene su decreto matriz y una modificación posterior: el
   currículo vigente es el de la matriz con la modificación aplicada. El DOGV
   publica en valenciano y en castellano.
   - 106/2022: comprobado con los metadatos del DOGV (título en los dos
     idiomas, núm. 9402, publicado el 10-8-2022).
   - 96/2026: título en castellano, número y boletín comprobados con el PDF del
     DOGV (docs/Normativa Comunitat Valenciana). Falta cotejar el título en
     valenciano, que es el que dio el dueño; hasta entonces, sin verificar.
   - ESO: pendiente de comprobar. */

const VC_PRIMARIA: Norma[] = [
  {
    tipo: 'matriz',
    titulo: {
      ca: 'Decret 106/2022, de 5 d\'agost, del Consell, d\'ordenació i currículum de l\'etapa d\'Educació Primària.',
      es: 'Decreto 106/2022, de 5 de agosto, del Consell, de ordenación y currículo de la etapa de Educación Primaria.',
    },
    corto: { ca: 'Decret 106/2022, de 5 d\'agost', es: 'Decreto 106/2022, de 5 de agosto' },
    boletin: { ca: 'DOGV núm. 9402, de 10 d\'agost de 2022', es: 'DOGV núm. 9402, de 10 de agosto de 2022' },
    verificada: true,
  },
  {
    tipo: 'modificacion',
    // Comprobado con los PDF del DOGV en castellano y en valenciano
    titulo: {
      ca: 'Decret 96/2026, de 19 de juny, del Consell, pel qual es modifica el Decret 106/2022, de 5 d\'agost, del Consell, d\'ordenació i currículum de l\'etapa d\'Educació Primària.',
      es: 'Decreto 96/2026, de 19 de junio, del Consell, por el que se modifica el Decreto 106/2022, de 5 de agosto, del Consell, de ordenación y currículo de la etapa de Educación Primaria.',
    },
    corto: { ca: 'Decret 96/2026, de 19 de juny', es: 'Decreto 96/2026, de 19 de junio' },
    boletin: { ca: 'DOGV núm. 10391, de 25 de juny de 2026', es: 'DOGV núm. 10391, de 25 de junio de 2026' },
    verificada: true,
  },
];

const VC_ESO: Norma[] = [
  {
    tipo: 'matriz',
    titulo: {
      ca: 'Decret 107/2022, de 5 d\'agost, del Consell, pel qual s\'establix l\'ordenació i el currículum de l\'etapa d\'Educació Secundària Obligatòria.',
      es: 'Decreto 107/2022, de 5 de agosto, del Consell, por el que se establece la ordenación y el currículo de la etapa de Educación Secundaria Obligatoria.',
    },
    corto: { ca: 'Decret 107/2022, de 5 d\'agost', es: 'Decreto 107/2022, de 5 de agosto' },
    boletin: { ca: 'DOGV núm. 9403, d\'11 d\'agost de 2022', es: 'DOGV núm. 9403, de 11 de agosto de 2022' },
    verificada: false,
  },
  {
    tipo: 'modificacion',
    titulo: {
      ca: 'Decret 66/2024, de 21 de juny, del Consell, pel qual es modifica el Decret 107/2022, de 5 d\'agost, del Consell, pel qual s\'establix l\'ordenació i el currículum de l\'etapa d\'Educació Secundària Obligatòria.',
    },
    corto: { ca: 'Decret 66/2024, de 21 de juny', es: 'Decreto 66/2024, de 21 de junio' },
    boletin: { ca: 'DOGV núm. 9879, de 26 de juny de 2024', es: 'DOGV núm. 9879, de 26 de junio de 2024' },
    verificada: false,
  },
];

/* ── Cataluña: Primaria y ESO, un único decreto ── */

const CT_EDUCACIO_BASICA: Norma = {
  tipo: 'matriz',
  titulo: { ca: 'Decret 175/2022, de 27 de setembre, d\'ordenació dels ensenyaments de l\'educació bàsica.' },
  corto: { ca: 'Decret 175/2022, de 27 de setembre' },
  boletin: { ca: 'DOGC núm. 8762, de 29 de setembre de 2022' },
  verificada: false,
};

/* ── Comunidad de Madrid ── */

const MD_PRIMARIA: Norma = {
  tipo: 'matriz',
  titulo: { es: 'Decreto 61/2022, de 13 de julio, del Consejo de Gobierno, por el que se establece para la Comunidad de Madrid la ordenación y el currículo de la etapa de Educación Primaria.' },
  corto: { es: 'Decreto 61/2022, de 13 de julio' },
  boletin: { es: 'BOCM núm. 169, de 18 de julio de 2022' },
  verificada: false,
};

const MD_ESO: Norma = {
  tipo: 'matriz',
  titulo: { es: 'Decreto 65/2022, de 20 de julio, del Consejo de Gobierno, por el que se establecen para la Comunidad de Madrid la ordenación y el currículo de la Educación Secundaria Obligatoria.' },
  corto: { es: 'Decreto 65/2022, de 20 de julio' },
  boletin: { es: 'BOCM núm. 175, de 25 de julio de 2022' },
  verificada: false,
};

/** Sin decreto registrado todavía: solo el nombre. */
const sinNormas = (id: ComunidadId, es: string, ca: string, en: string): Comunidad => (
  { id, nombre: { es, ca, en }, idiomas: [], normas: {} }
);

export const COMUNIDADES: Comunidad[] = [
  sinNormas('andalucia', 'Andalucía', 'Andalusia', 'Andalusia'),
  sinNormas('aragon', 'Aragón', 'Aragó', 'Aragon'),
  sinNormas('asturias', 'Asturias', 'Astúries', 'Asturias'),
  sinNormas('baleares', 'Islas Baleares', 'Illes Balears', 'Balearic Islands'),
  sinNormas('canarias', 'Canarias', 'Canàries', 'Canary Islands'),
  sinNormas('cantabria', 'Cantabria', 'Cantàbria', 'Cantabria'),
  sinNormas('castilla-la-mancha', 'Castilla-La Mancha', 'Castella-la Manxa', 'Castilla-La Mancha'),
  sinNormas('castilla-y-leon', 'Castilla y León', 'Castella i Lleó', 'Castile and León'),
  {
    id: 'cataluna',
    nombre: { es: 'Cataluña', ca: 'Catalunya', en: 'Catalonia' },
    idiomas: ['ca'],
    normas: { primaria: [CT_EDUCACIO_BASICA], eso: [CT_EDUCACIO_BASICA] },
  },
  sinNormas('ceuta', 'Ceuta', 'Ceuta', 'Ceuta'),
  {
    id: 'comunitat-valenciana',
    nombre: { es: 'Comunitat Valenciana', ca: 'Comunitat Valenciana', en: 'Valencian Community' },
    idiomas: ['ca', 'es'],
    normas: { primaria: VC_PRIMARIA, eso: VC_ESO },
  },
  sinNormas('extremadura', 'Extremadura', 'Extremadura', 'Extremadura'),
  sinNormas('galicia', 'Galicia', 'Galícia', 'Galicia'),
  sinNormas('la-rioja', 'La Rioja', 'La Rioja', 'La Rioja'),
  {
    id: 'madrid',
    nombre: { es: 'Comunidad de Madrid', ca: 'Comunitat de Madrid', en: 'Community of Madrid' },
    idiomas: ['es'],
    normas: { primaria: [MD_PRIMARIA], eso: [MD_ESO] },
  },
  sinNormas('melilla', 'Melilla', 'Melilla', 'Melilla'),
  sinNormas('murcia', 'Región de Murcia', 'Regió de Múrcia', 'Region of Murcia'),
  sinNormas('navarra', 'Navarra', 'Navarra', 'Navarre'),
  sinNormas('pais-vasco', 'País Vasco', 'País Basc', 'Basque Country'),
  sinNormas('fuera', 'Fuera de España / no aplica', 'Fora d\'Espanya / no s\'aplica', 'Outside Spain / not applicable'),
];

const POR_ID = new Map<ComunidadId, Comunidad>(COMUNIDADES.map(c => [c.id, c]));

export function esComunidadId(valor: unknown): valor is ComunidadId {
  return typeof valor === 'string' && POR_ID.has(valor as ComunidadId);
}

/**
 * La comunidad guardada en un perfil, o `null` si no hay ninguna o el valor no
 * es de la lista (una copia de seguridad antigua, un archivo editado a mano).
 */
export function comunidadDePerfil(valor: unknown): ComunidadId | null {
  return esComunidadId(valor) ? valor : null;
}

export function comunidadPorId(id: ComunidadId): Comunidad {
  return POR_ID.get(id)!;
}

export function nombreComunidad(id: ComunidadId, idioma: IdiomaApp): string {
  return comunidadPorId(id).nombre[idioma];
}

/**
 * Para el selector: ordenadas por su nombre en el idioma de la app, y «Fuera
 * de España» siempre al final, donde se espera una salida de emergencia.
 */
export function comunidadesOrdenadas(idioma: IdiomaApp): Comunidad[] {
  const normales = COMUNIDADES
    .filter(c => c.id !== 'fuera')
    .sort((a, b) => a.nombre[idioma].localeCompare(b.nombre[idioma], idioma));
  return [...normales, comunidadPorId('fuera')];
}

/**
 * En qué idioma se muestra el texto oficial del currículo de esta comunidad.
 * El de la app si la comunidad lo publica en él; si no, el que sí publica:
 * Cataluña en catalán aunque la app esté en castellano, y Madrid en castellano
 * aunque esté en catalán. El inglés no existe como idioma oficial y usa el
 * castellano. Sin decreto registrado (el estatal está en castellano), `es`.
 */
export function idiomaDelTexto(id: ComunidadId, idioma: IdiomaApp): IdiomaOficial {
  const { idiomas } = comunidadPorId(id);
  const preferido: IdiomaOficial = idioma === 'ca' ? 'ca' : 'es';
  if (idiomas.includes(preferido)) return preferido;
  return idiomas[0] ?? 'es';
}

/** Las normas de una comunidad y etapa, o `null` si todavía no hay ninguna. */
export function normasDe(id: ComunidadId, etapa: Etapa): Norma[] | null {
  return comunidadPorId(id).normas[etapa] ?? null;
}

/**
 * El texto de una norma en el idioma de la app. Si la norma no se publicó en
 * él, se muestra el idioma en que sí se publicó: nunca se traduce.
 */
export function textoNorma(textos: Textos, idioma: IdiomaApp): string {
  const preferido: IdiomaOficial = idioma === 'ca' ? 'ca' : 'es';
  const otro: IdiomaOficial = preferido === 'ca' ? 'es' : 'ca';
  return textos[preferido] ?? textos[otro] ?? '';
}

/**
 * La cita de una serie de normas en una línea: la matriz y, si la tiene, lo
 * que la modifica. «Decreto 106/2022, de 5 de agosto (DOGV núm. 9402, …),
 * modificado por el Decreto 96/2026, de 19 de junio (DOGV núm. 10391, …)».
 */
export function citarNormas(normas: Norma[], idioma: IdiomaApp): string {
  const una = (n: Norma) => `${textoNorma(n.corto, idioma)} (${textoNorma(n.boletin, idioma)})`;
  const [matriz, ...cambios] = normas;
  if (!matriz) return '';
  if (cambios.length === 0) return una(matriz);
  const modificado = idioma === 'ca' ? 'modificat per' : 'modificado por';
  return `${una(matriz)}, ${modificado} ${cambios.map(una).join(idioma === 'ca' ? ' i ' : ' y ')}`;
}
