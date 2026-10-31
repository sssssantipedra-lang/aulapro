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
 * Lo que no se puede tapar son los archivos adjuntos (fotos o PDF que el
 * propio docente sube): se envían tal cual.
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

export function buildPseudonymizer(roster: readonly RosterEntry[]): Pseudonymizer {
  const people = roster
    .map(r => ({ ...r, name: r.name.trim().replace(/\s+/g, ' ') }))
    .filter(r => r.name.length > 0);

  const byCode = new Map<number, string>();
  /** Formas completas («Lucía Pérez Navarro», «Lucía Pérez»): sin distinguir mayúsculas. */
  const full: { form: string; n: number }[] = [];
  /** Nombre de pila suelto («Lucía»), escrito con mayúscula: el de su alumno o, si lo comparten varios, uno propio. */
  const firsts: { form: string; n: number }[] = [];

  const firstCount = new Map<string, number>();
  for (const p of people) {
    const first = p.name.split(' ')[0].toLocaleLowerCase('es');
    firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
  }

  /**
   * Nombre de pila que comparten dos o más alumnos («Ana» con Ana López y Ana Ruiz; 31-10-2026): no se sabe a
   * cuál se refiere, pero tampoco puede salir tal cual. Lleva su propio código, que al volver es otra vez «Ana».
   * Antes se dejaba sin tapar. Van detrás de los códigos de las personas.
   */
  const compartidos = new Map<string, number>();
  let siguiente = people.length;

  people.forEach((p, i) => {
    const n = i + 1;
    byCode.set(n, p.name);
    const words = p.name.split(' ');
    full.push({ form: p.name, n });
    if (words.length > 2) full.push({ form: `${words[0]} ${words[1]}`, n });
    const first = words[0];
    // Un nombre de pila de dos letras («Al») taparía palabras corrientes: mejor dejarlo.
    if (words.length < 2 || first.length < 3) return;
    const clave = first.toLocaleLowerCase('es');
    if (firstCount.get(clave) === 1) { firsts.push({ form: first, n }); return; }
    let c = compartidos.get(clave);
    if (c === undefined) { c = ++siguiente; compartidos.set(clave, c); byCode.set(c, first); }
    if (!firsts.some(f => f.form === first)) firsts.push({ form: first, n: c });
  });

  // Las formas más largas primero: «Lucía Pérez Navarro» antes que «Lucía Pérez».
  full.sort((a, b) => b.form.length - a.form.length);
  const fullIndex = new Map(full.map(f => [f.form.toLocaleLowerCase('es'), f.n]));
  const firstIndex = new Map(firsts.map(f => [f.form, f.n]));

  const fullRe = full.length ? wordRe(full.map(f => escapeRe(f.form)).join('|'), 'giu') : null;
  // Con mayúscula inicial tal cual: «rosa» (el color) no es «Rosa» (la alumna).
  const firstRe = firsts.length ? wordRe(firsts.map(f => escapeRe(f.form)).join('|'), 'gu') : null;

  return {
    mask(text) {
      if (!text) return text;
      let out = text;
      if (fullRe) out = out.replace(fullRe, m => code(fullIndex.get(m.toLocaleLowerCase('es')) ?? 0));
      if (firstRe) out = out.replace(firstRe, m => code(firstIndex.get(m) ?? 0));
      return out;
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
