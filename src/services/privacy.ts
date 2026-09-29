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
  /** Nombre de pila suelto («Lucía»): solo si nadie más lo comparte y escrito con mayúscula. */
  const firsts: { form: string; n: number }[] = [];

  const firstCount = new Map<string, number>();
  for (const p of people) {
    const first = p.name.split(' ')[0].toLocaleLowerCase('es');
    firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
  }

  people.forEach((p, i) => {
    const n = i + 1;
    byCode.set(n, p.name);
    const words = p.name.split(' ');
    full.push({ form: p.name, n });
    if (words.length > 2) full.push({ form: `${words[0]} ${words[1]}`, n });
    const first = words[0];
    // Un nombre de pila de dos letras («Al») o repetido en el perfil taparía
    // palabras corrientes o a otra persona: mejor dejarlo.
    if (words.length > 1 && first.length >= 3 && firstCount.get(first.toLocaleLowerCase('es')) === 1) {
      firsts.push({ form: first, n });
    }
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
