/**
 * La escalera de dificultad de las fichas: todas van «de menos a más» (decisión
 * del dueño, 14-10-2026, tras ver fichas reales hechas con Gemini que salían
 * planas). Una ficha con tres ejercicios o más lleva tres bloques de nivel 1, 2
 * y 3, y el nivel de cada bloque se ve en la hoja con estrellas.
 *
 * Lo decide el código, no la IA: cuántos bloques hay, cuántos ejercicios lleva
 * cada uno y qué se espera en cada peldaño según el curso. La IA solo rellena
 * (ver `services/resources.ts`), y lo que devuelve se ordena y se corrige aquí
 * (`normalizarEscalera`) para que nunca salga una hoja que empiece por lo difícil.
 *
 * Puro: sin dependencias de `services/`, para que lo usen a la vez el motor, la
 * maquetación y el editor.
 */

/** 1 = para empezar, 2 = para practicar, 3 = para retarte. */
export type Dificultad = 1 | 2 | 3;

export const DIFICULTADES: readonly Dificultad[] = [1, 2, 3];

export const esDificultad = (n: unknown): n is Dificultad => n === 1 || n === 2 || n === 3;

/** Las claves (en castellano, como el resto de textos de la app) del nombre de cada peldaño. */
export const NOMBRE_DIFICULTAD: Record<Dificultad, string> = {
  1: 'Para empezar',
  2: 'Para practicar',
  3: 'Para retarte',
};

/** Las estrellas de un peldaño: ★☆☆, ★★☆, ★★★. */
export const estrellas = (d: Dificultad): string => '★'.repeat(d) + '☆'.repeat(3 - d);

/* ── El curso: qué se le puede pedir ── */

export type BandaCurso = 'ciclo1' | 'ciclo2' | 'ciclo3' | 'eso' | 'bachillerato' | 'otra';

export interface PerfilCurso {
  etapa: 'infantil' | 'primaria' | 'eso' | 'bachillerato' | 'otra';
  /** 1 a 6; 0 si no se sabe. */
  curso: number;
  banda: BandaCurso;
  /**
   * 5.º y 6.º de Primaria: el dueño pidió subirles el nivel (14-10-2026). Sus
   * peldaños piden más que un cuaderno de su curso, no «el de 4.º con otro tema».
   */
  sube: boolean;
  /**
   * Si la ficha es de cálculo (matemáticas, física, química…). En ciencias o sociales los
   * peldaños no hablan de cifras ni decimales: una ficha del cuerpo humano de 6.º con
   * «78 × 60 × 24» en el primer bloque salió de pedirle «números de seis cifras» a una IA real.
   */
  numerica: boolean;
}

const RE_NUMERICA = /matem|\bmates?\b|math|f[ií]sic[ao]|qu[ií]mic|geometr|aritm|c[aá]lcul|fracci|decimal|porcentaj|percent|operaci[oó]n|\bsumas?\b|\bresta\b|multiplic|divisi|potencia|ecuaci|n[uú]meros?|numbers?|per[ií]metro|volumen|estad[ií]stic|probabilid/i;

/** ¿Es una ficha de cálculo? Por el área o, si no se dice, por el tema. */
export const esAreaNumerica = (area: string | undefined, tema: string | undefined): boolean => RE_NUMERICA.test(`${area ?? ''} ${tema ?? ''}`);

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ORDINALES: [RegExp, number][] = [
  [/\b(?:primero|primer|primera)\b/, 1], [/\b(?:segundo|segon|segona)\b/, 2], [/\b(?:tercero|tercer|tercera)\b/, 3],
  [/\b(?:cuarto|cuarta|quart|quarta)\b/, 4], [/\b(?:quinto|quinta|cinque|cinquena)\b/, 5], [/\b(?:sexto|sexta|sise|sisena)\b/, 6],
];

/**
 * Lo que se sabe del curso a partir de lo que escribe el docente o trae la clase:
 * «5º de Primaria», «2.º Primaria», «3r d'ESO», «Year 5», «Quinto». Sin etapa, de 5
 * en adelante solo puede ser Primaria; con 1 a 4 no se sabe, y se queda en «otra».
 */
export function perfilDeCurso(nivel: string | undefined, contexto?: { area?: string; tema?: string }): PerfilCurso {
  const txt = plano(nivel ?? '');
  const digito = /\b([1-6])(?!\d)/.exec(txt)?.[1];
  const curso = digito ? Number(digito) : (ORDINALES.find(([re]) => re.test(txt))?.[1] ?? 0);
  let etapa: PerfilCurso['etapa'] = 'otra';
  if (/infantil|preschool|kindergarten/.test(txt)) etapa = 'infantil';
  else if (/bachiller|batxiller/.test(txt)) etapa = 'bachillerato';
  else if (/\beso\b|secundari|secondary/.test(txt)) etapa = 'eso';
  else if (/primari|primary|elementary|\bprim\b/.test(txt)) etapa = 'primaria';
  else if (curso >= 5) etapa = 'primaria';

  let banda: BandaCurso = 'otra';
  if (etapa === 'primaria' && curso >= 1) banda = curso <= 2 ? 'ciclo1' : curso <= 4 ? 'ciclo2' : 'ciclo3';
  else if (etapa === 'eso') banda = 'eso';
  else if (etapa === 'bachillerato') banda = 'bachillerato';
  // Sin área ni tema no se sabe: se supone de cálculo, que es lo que ya hacía
  return { etapa, curso, banda, sube: banda === 'ciclo3', numerica: contexto ? esAreaNumerica(contexto.area, contexto.tema) : true };
}

/** Qué se espera en cada peldaño de la escalera, según el curso (y, en el último ciclo, si la ficha es de cálculo). Para el prompt de la IA. */
export function expectativas(perfil: PerfilCurso): Record<Dificultad, string> {
  const num = perfil.numerica;
  switch (perfil.banda) {
    case 'ciclo1':
      return {
        1: num
          ? 'Reconocer, nombrar, contar o emparejar; una sola idea u operación, con números pequeños (hasta 20 en 1.º, hasta 100 en 2.º) y frases de pocas palabras.'
          : 'Reconocer, nombrar, contar o emparejar; una sola idea por ejercicio y frases de pocas palabras.',
        2: num
          ? 'Aplicar lo visto en una situación cercana: completar una frase, clasificar, ordenar, un problema de una sola operación.'
          : 'Aplicar lo visto en una situación cercana: completar una frase, clasificar, ordenar, contestar con una frase.',
        3: num
          ? 'Pensar un paso más: un problema de dos pasos muy guiado, explicar con una frase por qué, o inventar un ejemplo propio.'
          : 'Pensar un paso más: explicar con una frase por qué, comparar dos cosas o inventar un ejemplo propio.',
      };
    case 'ciclo2':
      return {
        1: num
          ? 'Reconocer y calcular de forma directa: una operación, una definición, una clasificación, con los números y el vocabulario del curso.'
          : 'Reconocer y aplicar de forma directa: una definición, una clasificación, un dato, con el vocabulario del curso.',
        2: num
          ? 'Aplicar en situaciones cercanas: problemas de uno o dos pasos, tablas por completar, relacionar con razón, ordenar procesos.'
          : 'Aplicar en situaciones cercanas: relacionar con razón, ordenar procesos, completar tablas y esquemas, explicar con una frase.',
        3: num
          ? 'Razonar: un problema de dos o tres pasos, detectar y corregir un error, explicar por qué, comparar dos casos.'
          : 'Razonar: detectar y corregir un error, explicar por qué, comparar dos casos, aplicar lo aprendido a una situación nueva.',
      };
    case 'ciclo3':
      return num
        ? {
          1: 'Aplicar de forma directa pero ya con el nivel alto del ciclo, no solo reconocer: números de hasta seis cifras, decimales (décimas y ' +
            'centésimas), fracciones con distinto denominador, porcentajes sencillos (10 %, 25 %, 50 %), unidades que hay que convertir, vocabulario técnico del tema.',
          2: 'Problemas de dos pasos con datos que hay que interpretar (tablas, gráficos, unidades distintas); comparar y justificar con una frase; ' +
            'relacionar causas y consecuencias; explicar un proceso con sus palabras.',
          3: 'Retos de verdad: problemas de tres pasos o con datos que sobran o faltan, razonar y justificar con argumentos, corregir un error ajeno y ' +
            'explicarlo, inventar un problema o una pregunta, conectar el tema con otro contenido.',
        }
        : {
          1: 'Aplicar de forma directa pero ya con el nivel alto del ciclo, no solo reconocer: vocabulario técnico del tema, definiciones precisas, ' +
            'clasificaciones y esquemas con varias categorías. Sin cálculos, salvo que el tema los pida.',
          2: 'Relacionar causas y consecuencias, comparar y justificar con una frase, interpretar un esquema, una tabla o un gráfico, explicar un proceso con sus palabras.',
          3: 'Retos de verdad: razonar y justificar con argumentos, aplicar lo aprendido a una situación nueva o real, corregir un error ajeno y explicarlo, ' +
            'inventar una pregunta o un ejemplo, conectar el tema con otro contenido.',
        };
    case 'eso':
    case 'bachillerato':
      return {
        1: 'Aplicar de forma directa conceptos y procedimientos del curso, con su vocabulario técnico.',
        2: 'Aplicar en contextos reales, interpretar datos, textos o fuentes y justificar los pasos.',
        3: 'Analizar, argumentar y transferir lo aprendido a una situación nueva: problemas de varios pasos, valorar o criticar una afirmación.',
      };
    default:
      return {
        1: 'Reconocer y aplicar de forma directa lo básico del tema, con una sola idea por ejercicio.',
        2: 'Aplicar el tema en situaciones concretas, con uno o dos pasos.',
        3: 'Razonar, justificar o transferir lo aprendido a una situación nueva.',
      };
  }
}

/**
 * La frase del prompt que sube el nivel de 5.º y 6.º; vacía en el resto de cursos.
 * Va aparte de `expectativas` porque habla de toda la ficha, no de un peldaño.
 */
export function avisoDeSubida(perfil: PerfilCurso): string {
  return perfil.sube
    ? `NIVEL ALTO: esta ficha es de ${perfil.curso}.º de Primaria, último ciclo, y el dueño de la aplicación quiere que se note: sube un punto el ` +
      `nivel respecto de lo que traería un cuaderno corriente de su curso. No es «la de 4.º con otro tema»: el alumnado de este ciclo tiene que ` +
      `sentir que se le exige pensar, con vocabulario técnico, ${perfil.numerica ? 'números del curso (no solo los pequeños) y ' : ''}varios pasos en cuanto el bloque lo permita.\n`
    : '';
}

/**
 * Entre qué números se mueven los datos de una ficha: el rango se sortea por
 * ficha (la IA, sin ancla, cae siempre en los mismos números de manual) pero se
 * ajusta al curso, para que 1.º no llegue a 20 000 ni 6.º se quede en 20.
 */
export function rangoNumerico(perfil: PerfilCurso, rand: () => number = Math.random): { lo: number; hi: number; nota: string } {
  const entre = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  if (perfil.banda === 'ciclo1') {
    return perfil.curso <= 1
      ? { lo: entre(1, 3), hi: entre(10, 20), nota: '' }
      : { lo: entre(2, 9), hi: entre(40, 99), nota: '' };
  }
  if (perfil.banda === 'ciclo2') {
    return perfil.curso <= 3
      ? { lo: entre(2, 9), hi: entre(200, 999), nota: '' }
      : { lo: entre(10, 99), hi: entre(2000, 9999), nota: 'Alguna fracción sencilla o un decimal si el tema lo permite.' };
  }
  if (perfil.banda === 'ciclo3') {
    return {
      lo: entre(10, 99), hi: entre(20000, 999999),
      nota: 'Con decimales (décimas y centésimas), fracciones con distinto denominador y algún porcentaje sencillo cuando el tema lo permita.',
    };
  }
  if (perfil.banda === 'eso' || perfil.banda === 'bachillerato') {
    return { lo: entre(2, 9), hi: entre(100, 5000), nota: 'Con decimales, fracciones, potencias o porcentajes cuando el tema lo pida.' };
  }
  const lo = entre(2, 8);
  return { lo, hi: lo + entre(6, 15), nota: '' };
}

/* ── El reparto: cuántos bloques y de qué nivel ── */

export interface BloquePlan {
  dificultad: Dificultad;
  ejercicios: number;
}

/** Los niveles de n elementos repartidos «de menos a más»: 1 → [2], 2 → [1,3], 3 → [1,2,3], 4 → [1,2,2,3], 6 → [1,1,2,2,3,3]. */
export function dificultadesPorPosicion(n: number): Dificultad[] {
  if (n <= 0) return [];
  if (n === 1) return [2];
  if (n === 2) return [1, 3];
  if (n === 4) return [1, 2, 2, 3];
  return Array.from({ length: n }, (_, i) => (Math.floor((i * 3) / n) + 1) as Dificultad);
}

/**
 * Cómo se reparten n ejercicios: tres bloques (de nivel 1, 2 y 3) con el
 * mayor peso en el del medio, o cuatro (1, 2, 2, 3) cuando son muchos. Con uno
 * o dos ejercicios no hay escalera completa: uno de nivel 2, o uno de nivel 1
 * y otro de nivel 3.
 */
export function planDeBloques(n: number): BloquePlan[] {
  if (n <= 0) return [];
  if (n === 1) return [{ dificultad: 2, ejercicios: 1 }];
  if (n === 2) return [{ dificultad: 1, ejercicios: 1 }, { dificultad: 3, ejercicios: 1 }];
  if (n >= 13) {
    const cuantos = Array<number>(4).fill(Math.floor(n / 4));
    // Los que sobran, primero a los dos del medio y luego a los extremos
    [1, 2, 0, 3].slice(0, n % 4).forEach(i => { cuantos[i]++; });
    return ([1, 2, 2, 3] as Dificultad[]).map((dificultad, i) => ({ dificultad, ejercicios: cuantos[i] }));
  }
  const base = Math.floor(n / 3);
  const extra = n % 3;
  // El primer sobrante, al bloque 2; el segundo, al 1
  return [
    { dificultad: 1, ejercicios: base + (extra === 2 ? 1 : 0) },
    { dificultad: 2, ejercicios: base + (extra >= 1 ? 1 : 0) },
    { dificultad: 3, ejercicios: base },
  ];
}

/** El reparto dicho para el prompt: «Bloque 1 · nivel 1 «Para empezar» · 2 ejercicios». */
export function planParaPrompt(plan: BloquePlan[], perfil: PerfilCurso): string {
  const esperado = expectativas(perfil);
  return plan.map((b, i) =>
    `- Bloque ${i + 1} · "dificultad": ${b.dificultad} (${NOMBRE_DIFICULTAD[b.dificultad].toLowerCase()}) · ` +
    `${b.ejercicios} ${b.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}. Aquí se pide: ${esperado[b.dificultad]}`).join('\n');
}

/**
 * Deja las actividades «de menos a más»: si cada una trae un nivel válido y hay al
 * menos dos distintos, se ordenan por nivel (el orden relativo entre iguales se
 * respeta); si no (faltan, están mal o todas valen lo mismo), se reparten por
 * posición. Con `niveles` (el reparto que decidió el código) y el mismo número de
 * bloques, cada uno recibe el que le tocaba: la IA a veces repite un nivel («1, 1, 2»)
 * y la escalera tiene que salir completa. Siempre devuelve el mismo número de
 * actividades, cada una con su nivel.
 */
export function normalizarEscalera<T extends { dificultad?: number }>(acts: T[], niveles?: readonly Dificultad[]): (T & { dificultad: Dificultad })[] {
  if (!acts.length) return [];
  const validos = acts.every(a => esDificultad(a.dificultad));
  const distintos = new Set(acts.map(a => a.dificultad)).size;
  let out: (T & { dificultad: Dificultad })[];
  if (validos && (acts.length === 1 || distintos >= 2)) {
    out = acts
      .map((a, i) => ({ a: a as T & { dificultad: Dificultad }, i }))
      .sort((x, y) => x.a.dificultad - y.a.dificultad || x.i - y.i)
      .map(x => x.a);
  } else {
    const porPosicion = dificultadesPorPosicion(acts.length);
    out = acts.map((a, i) => ({ ...a, dificultad: porPosicion[i] }));
  }
  return niveles?.length === out.length ? out.map((a, i) => ({ ...a, dificultad: niveles[i] })) : out;
}

/** ¿Va de menos a más? (Los niveles no bajan nunca y hay al menos dos distintos, salvo con un solo bloque.) */
export function vaDeMenosAMas(niveles: (number | undefined)[]): boolean {
  if (niveles.length <= 1) return true;
  if (!niveles.every(esDificultad)) return false;
  return niveles.every((n, i) => i === 0 || n! >= niveles[i - 1]!) && new Set(niveles).size >= 2;
}
