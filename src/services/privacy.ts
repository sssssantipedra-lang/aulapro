/**
 * Seudonimización de lo que se envía a la IA.
 *
 * Los datos del alumnado son de menores: su nombre no debe salir del
 * ordenador del docente hacia un servicio externo. Antes de cada llamada a
 * Gemini, `mask` cambia cada nombre del alumnado por un código («[ALU-7]»);
 * al volver la respuesta, `unmask` pone de nuevo el nombre real. La IA
 * razona igual —sigue viendo medias, asistencia y avisos de cada código—,
 * pero nunca ve a quién corresponden.
 *
 * Se hace en un único sitio (`callGemini`) y con la lista de todo el
 * alumnado del perfil, no en cada pantalla: así también se cubren los
 * nombres que el docente escribe a mano en el chat, en unas notas o en un
 * aviso, y cualquier función nueva que llame a la IA en el futuro.
 *
 * Los documentos del alumnado no se envían como archivo: se leen en el
 * dispositivo y solo va su texto, que pasa por aquí (`lib/documentoParaIA.ts`);
 * en sus fotos, el docente tapa el nombre antes (`components/TaparNombre.tsx`).
 * Lo que no se puede tapar solo es un nombre que no esté en la lista del
 * alumnado (un familiar, un apodo, un diminutivo) escrito a mano.
 */

export interface RosterEntry {
  id: string;
  name: string;
}

export interface Pseudonymizer {
  /** Texto con cada nombre del alumnado cambiado por su código. */
  mask(text: string): string;
  /** Texto con cada código cambiado otra vez por el nombre real. */
  unmask(text: string): string;
  /** Si `text` contiene algún código de alumno. */
  hasCodes(text: string): boolean;
}

const code = (n: number) => `[ALU-${n}]`;
/** Admite que la IA se coma los corchetes: «ALU-7» también vuelve a ser el nombre. */
const CODE_RE = /\[?ALU-(\d+)\]?/g;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Límite de palabra que entiende de acentos y eñes (`\b` no). */
const wordRe = (inner: string, flags: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${inner})(?![\\p{L}\\p{N}])`, flags);

/** Primeras palabras que no son un nombre de pila: los alumnos de ejemplo se llaman «Alumno 1», «Student 1»… */
const GENERICOS = new Set(['alumno', 'alumna', 'alumne', 'student', 'estudiante', 'estudiant', 'pupil']);

/** Partículas de un apellido («de la Torre», «El Amrani», «Puig i Ferrer»): van con la palabra que sigue y no cuentan solas. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'els', 'les', 'y', 'i', 'van', 'von', 'da', 'do', 'dos', 'di', 'le', 'al', 'ben', 'bin', 'abu', "d'", "l'", 'd’', 'l’', 'sant', 'san', 'santa', 'mac', 'mc']);

/**
 * Nombres de pila que también son palabras corrientes (castellano, catalán, inglés): en minúscula no se tapan («rosa»
 * el color, «marco» el marco, «pau» la paz). Con mayúscula sí. Un nombre que no esté aquí se tapa también en minúscula
 * («lucía va mal», como se escribe deprisa en el chat; auditoría del 5-11-2026).
 */
const NOMBRES_PALABRA = new Set(('rosa marco marc pilar luz paz sol mar alba aurora cruz nieves dolores dolors mercedes blanca victoria gloria ' +
  'esperanza consuelo consol amparo soledad concha paloma reyes angel angela angeles leon domingo julio agosto augusto salvador ventura clara ' +
  'iris violeta margarita jazmin azucena rosario montserrat merce neus pau roser estel estrella perla africa america asia india china belen ' +
  'candela cielo luna marina marino rocio trinidad remedios remei milagros socorro sagrario encarnacion encarna inmaculada asuncion natividad ' +
  'caridad justo modesto prudencio severo fausto prospero amado feliz libre llum flor serena alegria cristal oriol concepcio abril mayo ' +
  'will grace hope faith mark bill rose lily may june summer autumn winter spring pat art sue rich frank jack max chase hunter carol pearl ' +
  'amber ruby violet ivy holly hazel brook cliff dawn destiny joy chance guy bob rob don gene herb lance miles ray sandy skip wade brandy ' +
  'candy cherry daisy ginger honey jade jewel melody penny robin sky star sunny dolly forest river ocean rain storm reed').split(' '));

/**
 * Apellidos que también son palabras o lugares corrientes: solos no se tapan («Toledo» en una situación de aprendizaje
 * sobre un viaje, «Blanco», «Roig», «Smith» en inglés); junto al nombre o con el otro apellido, sí.
 */
const APELLIDOS_PALABRA = new Set(('blanco rubio moreno castillo iglesias leon toledo sevilla madrid navarra cuenca soria burgos zamora segovia ' +
  'cordoba granada jaen huelva cadiz malaga murcia valencia alicante castellon girona lleida tarragona barcelona cruz reyes santos flores campos ' +
  'montes rios vega castro pastor herrero guerrero caballero delgado romero serrano molina marin prado mesa campo rosa luna nieves puente ' +
  'torre torres calle plaza parra robles pino olmo pena sierra valle costa playa ribera arroyo fuente fuentes lago mora morales rosales naranjo ' +
  'manzano cerezo salas sala cortes franco bravo gallardo hidalgo leal alegre feliz cano calvo pardo rojo verde negro bueno grande bello ' +
  'hermoso redondo cuadrado cabeza mano barba pelo rio monte villa pueblo ciudad roig blanc negre verd gris puig vila font riera serra soler ' +
  'ferrer fuster sastre pages camps roca piedra pedra mayo abril agosto march smith brown white black green gray grey stone hill wood woods ' +
  'field fields rivers brooks bush king knight bishop cook baker miller young long short little strong swift bell bird fox wolf lamb may ' +
  'west east north south london york paris rome moon sun day night snow rain frost summer winter spring fall ford lane park parks street ' +
  'rose holly page hunt hunter reed carpenter mason dean grant hope grace faith love church').split(' '));

/**
 * Un nombre se reconoce aunque se escriba sin tildes, sin eñe o sin ce trencada («Lucia», «Nunez», «Lluis» por
 * «Lucía», «Núñez», «Lluís»; auditoría del 1-11-2026): es como se escribe deprisa en una anotación, en el chat o en
 * el nombre de un archivo. Antes solo se tapaba escrito exactamente igual que en la lista.
 */
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const VARIANTES: Record<string, string> = { a: 'aáàâäã', e: 'eéèêë', i: 'iíìîï', o: 'oóòôöõ', u: 'uúùûü', n: 'nñ', c: 'cç' };
/** La clave de un nombre para buscarlo: sin tildes, en minúscula y con un solo espacio entre palabras. */
const claveDe = (s: string) => sinTildes(s).toLocaleLowerCase('es').replace(/['’]/g, "'").replace(/[\s_-]+/g, ' ').trim();

/**
 * Lo que un PDF o un copiar y pegar meten dentro de una palabra sin que se vea: guiones blandos y caracteres de anchura
 * cero, y las tildes como acento combinado («Lucía» con la i y el acento por separado, forma NFD). Se normaliza todo antes de buscar los nombres
 * (auditoría del 5-11-2026: «Lu-cía» con un guion blando se escapaba).
 */
const INVISIBLES = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;
export const textoNormal = (s: string) => s.normalize('NFC').replace(INVISIBLES, '');

/** Un corte de línea con guion dentro de una palabra, como parte un PDF a dos columnas («Lu-\ncía»). */
const GUION_DE_LINEA = '(?:-[ \\t]*\\r?\\n[ \\t]*)?';
/** La clave de lo que se ha encontrado en el texto: sin el guion de fin de línea que pueda llevar dentro. */
const claveEncontrada = (m: string) => claveDe(m.replace(/-[ \t]*\r?\n[ \t]*/g, ''));

/**
 * El patrón de un nombre que admite cada letra con o sin tilde, en la misma caja que la original (los nombres de pila
 * se buscan con mayúscula: «Rosa» es la alumna, «rosa» el color), y entre palabras cualquier espacio, salto de línea,
 * guion o guion bajo («Ana-María», «Lucía\nPérez» en un PDF, «Informe_Lucia_Perez.pdf»). Entre dos letras admite un
 * guion de fin de línea, y un apóstrofo recto o tipográfico («O'Neil», «O’Neil»).
 */
function patronFlexible(forma: string): string {
  let out = '';
  let enPalabra = false;
  for (const ch of forma.normalize('NFC')) {
    if (/[\s_-]/.test(ch)) { if (!out.endsWith('[\\s_-]+')) out += '[\\s_-]+'; enPalabra = false; continue; }
    if (enPalabra) out += GUION_DE_LINEA;
    enPalabra = true;
    if (ch === "'" || ch === '’') { out += "['’]"; continue; }
    const base = sinTildes(ch);
    const grupo = VARIANTES[base.toLocaleLowerCase('es')];
    if (!grupo) { out += escapeRe(ch); continue; }
    out += `[${base === base.toLocaleUpperCase('es') && base !== base.toLocaleLowerCase('es') ? grupo.toLocaleUpperCase('es') : grupo}]`;
  }
  return out;
}

/** Los apellidos de un nombre, agrupados con sus partículas: «García de la Torre» → [«García», «de la Torre»]. */
function unidadesDeApellido(palabras: readonly string[]): string[] {
  const unidades: string[] = [];
  let pendiente = '';
  for (const w of palabras) {
    if (PARTICULAS.has(claveDe(w)) || /^[dl]['’]$/i.test(w)) { pendiente = pendiente ? `${pendiente} ${w}` : w; continue; }
    unidades.push(pendiente ? `${pendiente} ${w}` : w);
    pendiente = '';
  }
  if (pendiente) unidades.push(pendiente);
  return unidades;
}

/** Las combinaciones no vacías de una lista, en su orden («[a, b]» → «[a], [b], [a, b]»). */
function combinaciones<T>(xs: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i)));
  return out;
}

/** Varios códigos seguidos del mismo alumno («[ALU-1], [ALU-1]» de «Pérez Navarro, Lucía») se quedan en uno. */
const CODIGOS_REPETIDOS = /(\[ALU-(\d+)\])(?:[ \t]*,?[ \t]*\[ALU-\2\])+/g;

/**
 * Lo que se tapa de cada alumno (auditoría del 5-11-2026, antes solo el nombre completo, el nombre con el primer
 * apellido y el nombre de pila con mayúscula):
 *
 * - Sin distinguir mayúsculas ni tildes: el nombre completo; el nombre de pila con cualquier combinación de sus
 *   apellidos («Lucía Navarro», «María José»); los apellidos juntos («Pérez Navarro», también con el nombre detrás,
 *   como en una lista: «Pérez Navarro, Lucía»).
 * - Con mayúscula o todo en mayúsculas: el nombre de pila solo («Lucía», «LUCÍA») y cada apellido solo de cuatro letras
 *   o más («Navarro»), salvo los que son también una palabra o un lugar (`APELLIDOS_PALABRA`).
 * - En minúscula: el nombre de pila de cuatro letras o más que no sea una palabra corriente («lucía», no «rosa»).
 *
 * Lo que comparten dos o más alumnos (el nombre de pila «Ana», el apellido de dos hermanos) lleva un código propio
 * que vuelve como estaba. Lo que no se puede tapar: un apodo o diminutivo, y un nombre pegado a otra cosa sin
 * separación («LuciaPerez», «Lucía2»).
 */
export function buildPseudonymizer(roster: readonly RosterEntry[]): Pseudonymizer {
  const people = roster
    .map(r => ({ ...r, name: textoNormal(r.name).trim().replace(/\s+/g, ' ') }))
    .filter(r => r.name.length > 0);

  const byCode = new Map<number, string>();
  /** Formas completas («Lucía Pérez Navarro», «Lucía Pérez», «Pérez Navarro»): sin distinguir mayúsculas ni tildes. */
  const full: { form: string; n: number }[] = [];
  /** Palabras sueltas con mayúscula («Lucía», «Navarro»): las de su alumno o, si las comparten varios, con código propio. */
  const sueltas: { form: string; n: number }[] = [];
  /** Nombres de pila en minúscula («lucía»). */
  const minusculas: { form: string; n: number }[] = [];

  const firstCount = new Map<string, number>();
  const surnameCount = new Map<string, number>();
  const partes = people.map(p => {
    const words = p.name.split(' ');
    const unidades = unidadesDeApellido(words.slice(1));
    const apellidos = unidades.map(u => u.split(' ').at(-1)!);
    return { first: words[0], unidades, apellidos };
  });
  for (const { first, apellidos } of partes) {
    const f = claveDe(first);
    firstCount.set(f, (firstCount.get(f) ?? 0) + 1);
    for (const a of new Set(apellidos.map(claveDe))) surnameCount.set(a, (surnameCount.get(a) ?? 0) + 1);
  }
  const esNombrePila = (clave: string) => firstCount.has(clave);

  /**
   * Una palabra que comparten dos o más alumnos («Ana» con Ana López y Ana Ruiz; 31-10-2026): no se sabe a cuál se
   * refiere, pero tampoco puede salir tal cual. Lleva su propio código, que al volver es otra vez «Ana». Van detrás
   * de los códigos de las personas.
   */
  const compartidos = new Map<string, number>();
  let siguiente = people.length;
  const suelta = (lista: { form: string; n: number }[], form: string, n: number, cuantos: number) => {
    const clave = claveDe(form);
    if (lista.some(f => claveDe(f.form) === clave)) return;
    if (cuantos === 1) { lista.push({ form, n }); return; }
    let c = compartidos.get(clave);
    if (c === undefined) { c = ++siguiente; compartidos.set(clave, c); byCode.set(c, form); }
    lista.push({ form, n: c });
  };

  people.forEach((p, i) => {
    const n = i + 1;
    byCode.set(n, p.name);
    const { first, unidades, apellidos } = partes[i];
    full.push({ form: p.name, n });
    for (const combo of combinaciones(unidades)) {
      full.push({ form: [first, ...combo].join(' '), n });
      // Los apellidos sin el nombre («Pérez Navarro», «García de la Torre»), si son dos o más palabras
      if (combo.length > 1 || combo[0].includes(' ')) full.push({ form: combo.join(' '), n });
    }
    // Un nombre de pila de dos letras («Al») taparía palabras corrientes, y «Alumno» (de «Alumno 1», los datos de
    // ejemplo) es una palabra corriente de cualquier informe: mejor dejarlos.
    if (unidades.length === 0 || first.length < 3 || GENERICOS.has(claveDe(first))) return;
    const clave = claveDe(first);
    suelta(sueltas, first, n, firstCount.get(clave)!);
    if (first.length >= 4 && !NOMBRES_PALABRA.has(claveDe(first))) suelta(minusculas, first.toLocaleLowerCase('es'), n, firstCount.get(clave)!);
    for (const a of apellidos) {
      const ca = claveDe(a);
      if (a.length < 4 || APELLIDOS_PALABRA.has(ca) || esNombrePila(ca)) continue;
      suelta(sueltas, a, n, surnameCount.get(ca)!);
    }
  });

  // Las formas más largas primero: «Lucía Pérez Navarro» antes que «Lucía Pérez».
  full.sort((a, b) => b.form.length - a.form.length);
  // Si dos alumnos se llaman igual (en clases distintas), manda el primero: el nombre que vuelve es el mismo
  const fullIndex = new Map<string, number>();
  for (const f of full) if (!fullIndex.has(claveDe(f.form))) fullIndex.set(claveDe(f.form), f.n);
  const sueltaIndex = new Map(sueltas.map(f => [claveDe(f.form), f.n]));
  const minusculaIndex = new Map(minusculas.map(f => [claveDe(f.form), f.n]));

  const fullRe = fullIndex.size ? wordRe([...new Set(full.map(f => patronFlexible(f.form)))].join('|'), 'giu') : null;
  // Con mayúscula inicial tal cual («rosa», el color, no es «Rosa», la alumna) o todo en mayúsculas («LUCÍA»)
  const sueltaRe = sueltas.length
    ? wordRe(sueltas.flatMap(f => [patronFlexible(f.form), patronFlexible(f.form.toLocaleUpperCase('es'))]).join('|'), 'gu')
    : null;
  const minusculaRe = minusculas.length ? wordRe(minusculas.map(f => patronFlexible(f.form)).join('|'), 'gu') : null;

  return {
    mask(text) {
      if (!text) return text;
      let out = textoNormal(text);
      if (fullRe) out = out.replace(fullRe, m => code(fullIndex.get(claveEncontrada(m)) ?? 0));
      if (sueltaRe) out = out.replace(sueltaRe, m => code(sueltaIndex.get(claveEncontrada(m)) ?? 0));
      if (minusculaRe) out = out.replace(minusculaRe, m => code(minusculaIndex.get(claveEncontrada(m)) ?? 0));
      return out.replace(CODIGOS_REPETIDOS, '$1');
    },
    unmask(text) {
      if (!text) return text;
      return text.replace(CODE_RE, (m, num: string) => byCode.get(Number(num)) ?? m);
    },
    hasCodes(text) {
      return /\[ALU-\d+\]/.test(text);
    },
  };
}

/* ── Códigos nuevos en cada petición (31-10-2026) ────────────────────────
 *
 * Con un código fijo por alumno («[ALU-7]» siempre es la misma persona), quien
 * reciba muchas peticiones podría ir juntando lo que sabe de cada código: sus
 * notas, sus avisos, su apoyo. Para que eso no se pueda hacer, cada petición
 * a la IA usa una numeración nueva al azar: el mismo alumno es [ALU-48213] en
 * una petición y [ALU-305] en la siguiente. Dentro de una misma petición (con
 * su historial) un alumno conserva su código, para que la IA pueda razonar.
 *
 * Además, al volver, solo se cambian por nombres los códigos de esta
 * petición: si la IA se inventa uno, se queda como está, en vez de convertirse
 * en el nombre de otro alumno.
 */

/**
 * El dígito de control de Damm: detecta cualquier cifra cambiada y cualquier par de cifras vecinas
 * intercambiadas. Un número con su dígito al final da 0 (`codigoValido`).
 */
const DAMM = [
  [0, 3, 1, 7, 5, 9, 8, 6, 4, 2], [7, 0, 9, 2, 1, 5, 4, 8, 6, 3], [4, 2, 0, 6, 8, 7, 1, 3, 5, 9], [1, 7, 5, 0, 9, 8, 3, 4, 2, 6],
  [6, 1, 2, 3, 0, 4, 5, 9, 7, 8], [3, 6, 7, 4, 2, 0, 9, 5, 8, 1], [5, 8, 6, 9, 7, 2, 0, 1, 3, 4], [8, 9, 4, 5, 3, 6, 2, 0, 1, 7],
  [9, 4, 3, 8, 6, 1, 7, 2, 0, 5], [2, 5, 8, 1, 4, 3, 6, 7, 9, 0],
];
export function digitoDamm(cifras: string): number {
  let i = 0;
  for (const c of cifras) i = DAMM[i][c.charCodeAt(0) - 48];
  return i;
}

/**
 * Los códigos de una petición tienen siempre cinco cifras: cuatro al azar (de 1000 a 9999) y el dígito de control.
 * Si la IA copia mal un código (una cifra cambiada, dos vecinas al revés, una de más o de menos), deja de ser
 * válido y no se convierte en ningún alumno: se queda a la vista. Ver `codigoValido`.
 */
const MIN_CODIGO = 1000;
const MAX_CODIGO = 9999;
export const codigoValido = (cifras: string) => /^\d{5}$/.test(cifras) && digitoDamm(cifras) === 0;
const conControl = (n: number) => n * 10 + digitoDamm(String(n));

function numeroAlAzar(usados: Set<number>, azar: () => number): number {
  for (let intento = 0; intento < 50; intento++) {
    const n = conControl(MIN_CODIGO + Math.floor(azar() * (MAX_CODIGO - MIN_CODIGO + 1)));
    if (!usados.has(n)) return n;
  }
  // Muy improbable con el azar de verdad: el primero libre, para no quedarse dando vueltas
  let n = MIN_CODIGO;
  while (usados.has(conControl(n))) n++;
  return conControl(n);
}

/** Un número al azar entre 0 y 1, del generador criptográfico del navegador. */
function azarSeguro(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}

/**
 * Un enmascarador para una sola petición: los mismos nombres que `base`, con
 * códigos nuevos al azar. Los códigos que ya trae el texto (el informe que el
 * docente revisó, con los códigos fijos de `base`) se cambian también.
 */
export function codigosDePeticion(base: Pseudonymizer, azar: () => number = azarSeguro): Pseudonymizer {
  /** Código fijo de `base` → código de esta petición, y al revés. */
  const ida = new Map<number, number>();
  const vuelta = new Map<number, number>();
  const usados = new Set<number>();
  const deEstaPeticion = (fijo: number) => {
    let n = ida.get(fijo);
    if (n === undefined) {
      n = numeroAlAzar(usados, azar);
      usados.add(n);
      ida.set(fijo, n);
      vuelta.set(n, fijo);
    }
    return n;
  };
  return {
    mask(text) {
      if (!text) return text;
      return base.mask(text).replace(/\[ALU-(\d+)\]/g, (_, fijo: string) => code(deEstaPeticion(Number(fijo))));
    },
    unmask(text) {
      if (!text) return text;
      return text.replace(CODE_RE, (m, num: string) => {
        // Un código mal copiado no pasa el dígito de control: no es nadie
        const fijo = codigoValido(num) ? vuelta.get(Number(num)) : undefined;
        return fijo === undefined ? m : base.unmask(code(fijo));
      });
    },
    hasCodes: base.hasCodes,
  };
}

/* ── Alumnado del perfil abierto ──────────────────────────────────────────
 *
 * Lo registra la aplicación cada vez que cambia la lista de alumnos, y lo usa
 * `callGemini` sin que cada pantalla tenga que pasárselo.
 */
let current: Pseudonymizer = buildPseudonymizer([]);
let currentLang: 'es' | 'en' | 'ca' = 'es';

export function setPrivacyRoster(roster: readonly RosterEntry[], lang: 'es' | 'en' | 'ca' = 'es'): void {
  current = buildPseudonymizer(roster);
  currentLang = lang;
}

export function currentPseudonymizer(): Pseudonymizer {
  return current;
}

/** Lo que se le explica a la IA cuando el texto lleva códigos de alumno. */
export function privacyInstruction(lang: 'es' | 'en' | 'ca' = currentLang): string {
  return lang === 'en'
    ? '\n\nPRIVACY: students\' names have been replaced by codes such as [ALU-3]. Whenever you refer to a student, write their code exactly like that, brackets included: the app swaps it back for the real name. You do not know their gender, so use gender-neutral wording.'
    : '\n\nPRIVACIDAD: los nombres del alumnado se han sustituido por códigos como [ALU-3]. Cuando te refieras a un alumno, escribe su código exactamente así, con los corchetes: la aplicación lo cambia por el nombre real. No sabes su género, así que redacta con formas neutras («el alumnado», «ha mostrado», «muestra interés»…) en lugar de «el alumno» o «la alumna».';
}
