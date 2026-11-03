/**
 * Documentos del alumnado que van a la IA (31-10-2026, revisión de privacidad): nunca se envía el archivo, solo su
 * texto, leído aquí, en el navegador. Así pasa por el mismo enmascarado de nombres que todo lo demás (`callGemini`,
 * `services/privacy.ts`) y, antes, por `quitarIdentificadores`, que tapa lo que la lista del alumnado no cubre
 * (correos, teléfonos, DNI, números de expediente, fechas de nacimiento, familiares, domicilio y centro).
 *
 * Antes, un PDF (el informe del orientador, la programación del tutor, un trabajo de un alumno) se enviaba tal cual,
 * con el nombre que llevara. Un PDF escaneado no tiene texto: entonces no se envía y se pide pegar el texto.
 * Ver `docs/PTAL.md` y `web/sitio/privacidad.html`.
 */
import { textoDeDocx } from './leerMaterial';

/** Como mucho se leen estas páginas: un informe o una programación no pasan de aquí, y la IA tampoco lee más. */
export const MAX_PAGINAS_PDF = 80;

/** Por debajo de esta cantidad de letras por página, el PDF es una imagen escaneada. */
const LETRAS_POR_PAGINA = 40;

export const EXTENSIONES_DOCUMENTO = '.pdf,.docx,.txt';
const ES_TEXTO = /\.(txt|md|csv|tsv)$/i;

/** El texto de un PDF, página a página. Error «escaneado» si casi no tiene texto (es una foto de las hojas). */
export async function textoDePdf(datos: ArrayBuffer | Uint8Array): Promise<string> {
  // La versión «legacy» funciona también en los iPad y los navegadores de hace unos años
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
  }
  const tarea = pdfjs.getDocument({
    data: datos instanceof Uint8Array ? datos : new Uint8Array(datos),
    // Sin cargar tipos de letra: solo se quiere el texto (la versión 6 ya no usa `eval`, que la app prohíbe)
    disableFontFace: true, useSystemFonts: false,
  });
  try {
    const doc = await tarea.promise;
    const paginas: string[] = [];
    const n = Math.min(doc.numPages, MAX_PAGINAS_PDF);
    for (let i = 1; i <= n; i++) {
      const pagina = await doc.getPage(i);
      const contenido = await pagina.getTextContent();
      let linea = '';
      const lineas: string[] = [];
      for (const item of contenido.items) {
        if (!('str' in item)) continue;
        linea += item.str;
        if (item.hasEOL) { lineas.push(linea); linea = ''; }
      }
      if (linea) lineas.push(linea);
      paginas.push(lineas.join('\n').replace(/[ \t]+\n/g, '\n').trim());
      pagina.cleanup();
    }
    const texto = paginas.join('\n\n').trim();
    if (texto.replace(/\s/g, '').length < LETRAS_POR_PAGINA * n) throw new Error('escaneado');
    return texto;
  } finally {
    await tarea.destroy();
  }
}

/**
 * El texto de un documento elegido por el docente: PDF, Word (.docx) o texto. Errores: «escaneado» (un PDF sin texto),
 * «doc» (un Word antiguo, .doc, que no se puede leer aquí) y «formato» (cualquier otra cosa).
 */
export async function leerDocumento(file: File): Promise<string> {
  const n = file.name.toLowerCase();
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return textoDePdf(await file.arrayBuffer());
  if (n.endsWith('.docx')) return textoDeDocx(file);
  if (n.endsWith('.doc')) throw new Error('doc');
  if (ES_TEXTO.test(n) || file.type.startsWith('text/')) return file.text();
  throw new Error('formato');
}

/** ¿Es un documento que se lee como texto (y no una imagen)? */
export const esDocumento = (file: File) =>
  /\.(pdf|docx?|txt|md|csv|tsv)$/i.test(file.name) || file.type === 'application/pdf' || file.type.startsWith('text/');

/** El mensaje para el docente cuando `leerDocumento` no puede. */
export function avisoDeLectura(e: unknown): string {
  const m = e instanceof Error ? e.message : '';
  if (m === 'escaneado') return 'Este PDF es una imagen escaneada y no tiene texto que leer. Para no enviar el archivo con los datos que lleve, copia su texto y pégalo, o pide el documento en Word.';
  if (m === 'doc') return 'Los Word antiguos (.doc) no se pueden leer aquí. Ábrelo y guárdalo como .docx o como PDF.';
  if (m === 'grande') return 'El archivo pesa demasiado (19 MB como máximo).';
  return 'No se pudo leer el documento. Usa un PDF, un Word (.docx) o un texto.';
}

const R = (s: string) => `[${s}]`;

/**
 * Etiquetas de un documento cuyo valor es una persona (el alumno, su familia, su tutor u orientador, quien firma) o
 * un lugar que la identifica (domicilio, centro). En castellano, catalán e inglés. Detrás va «:».
 */
const PERSONA = [
  'nombre(?:\\s+y\\s+apellidos)?', 'apellidos', 'nom(?:\\s+i\\s+cognoms)?', 'cognoms', '(?:full\\s+)?name', 'surnames?',
  'alumn[oa](?:\\/a)?', 'alumne', 'student', 'padre', 'madre', 'pare', 'mare', 'father', 'mother',
  'progenitor(?:[ae]s?)?', 'tutor(?:[ae])?(?:\\/a)?(?:\\s+legal(?:es)?)?', 'legal\\s+guardian', 'orientador(?:[ae])?(?:\\/a)?',
  'psic[oó]log[oa](?:\\/a)?', 'maestr[oa](?:\\/a)?', 'profesor(?:[ae])?(?:\\/a)?', 'professor(?:[ae])?', 'teacher', 'especialista',
  'director(?:[ae])?(?:\\/a)?', 'fdo\\.?', 'firmado(?:\\s+por)?', 'signat', 'signed(?:\\s+by)?',
];
const LUGAR = [
  'domicilio', 'direcci[oó]n', 'adre[cç]a', 'address', 'centro(?:\\s+educativo)?', 'centre(?:\\s+educatiu)?', 'colegio', 'school',
  'localidad', 'municipio', 'poblaci[oó]n', 'localitat',
];
/** Otras etiquetas habituales: no se tapan, pero marcan dónde acaba el valor de la anterior en la misma línea. */
const OTRAS = [
  'fecha(?:\\s+de\\s+\\p{L}+)?', 'data(?:\\s+de\\s+\\p{L}+)?', 'date(?:\\s+of\\s+\\p{L}+)?', 'nivel(?:\\s*\\/\\s*curso)?', 'curso', 'etapa',
  'grupo', 'edad', 'nia', 'sip', 'dni', 'nie', 'tel[eé]fono', 'm[oó]vil', 'correo(?:\\s+electr[oó]nico)?', 'e-?mail', 'nacionalidad',
  'sexo', 'g[eé]nero', 'level', 'year', 'class', 'age', 'curs', 'edat',
];
const etiquetas = (lista: string[]) => new RegExp(`(?<=^|[\\s(;,|])(?:${lista.join('|')})[ \\t]*:`, 'gimu');
const ETIQUETA_TAPAR = etiquetas([...PERSONA, ...LUGAR]);
const ETIQUETA_PERSONA = new RegExp(`^(?:${PERSONA.join('|')})[ \\t]*:$`, 'iu');
const ETIQUETA_CUALQUIERA = etiquetas([...PERSONA, ...LUGAR, ...OTRAS]);

/**
 * Tratamientos delante de un nombre: «D. Andrés Ferrer», «Dña. Marta Gil», «Dra. López», «Mrs. Smith», también en
 * mayúsculas o sin el punto («DÑA. MARTA GIL», «Sra Gil»; auditoría del 1-11-2026).
 */
const TRATAMIENTOS = 'D\\.|Dª\\.?|D[ñÑ]a\\.?|DÑA\\.?|Don|DON|Doña|DOÑA|Sr\\.?|SR\\.?|Sra\\.?|SRA\\.?|Srta\\.?|SRTA\\.?|Dr\\.|DR\\.|Dra\\.|DRA\\.|Mr\\.|Mrs\\.|Ms\\.';
const TRATAMIENTO = new RegExp(`(?<![\\p{L}])(${TRATAMIENTOS})(\\s+)\\p{Lu}[\\p{L}'-]+(?:\\s+(?:(?:de|del|de la|i)\\s+)?\\p{Lu}[\\p{L}'-]+){0,3}`, 'gu');
const TRATAMIENTO_INICIAL = new RegExp(`^(?:${TRATAMIENTOS})\\s+`, 'u');
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'van', 'von', 'da', 'do', 'dos']);
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tapa lo que identifica a una persona en un documento y que la lista del alumnado no cubre. No es perfecto (un
 * nombre suelto que no esté en la lista ni detrás de una etiqueta no se puede reconocer), por eso el texto se enseña
 * al docente antes de enviarlo cuando hay dónde.
 *
 * 1. Datos de contacto (`quitarDatosDeContacto`).
 * 2. El valor de cada etiqueta de persona o de lugar, esté al principio o en mitad de la línea (un PDF junta en una
 *    línea «Nivel / Curso: 4º … Tutor/a: D. Andrés Ferrer»), hasta la siguiente etiqueta o el final de la línea.
 * 3. Los nombres que había detrás de esas etiquetas, también donde vuelvan a salir en el documento: el informe dice
 *    arriba cómo se llama el alumno y luego lo nombra en el texto y en el pie de página (revisión del 31-10-2026,
 *    con un informe de prueba del dueño).
 * 4. Un nombre detrás de un tratamiento («D.», «Dña.», «Sr.»…).
 */
export function quitarIdentificadores(texto: string): string {
  let t = textoLibreParaIA(texto);

  // 2. Valores de las etiquetas, de la última a la primera para no mover las posiciones
  const cortes = [...t.matchAll(ETIQUETA_CUALQUIERA)].map(m => m.index!);
  const nombres: string[] = [];
  const tapar = [...t.matchAll(ETIQUETA_TAPAR)];
  for (const m of tapar.reverse()) {
    const desde = m.index! + m[0].length;
    const finLinea = t.indexOf('\n', desde) === -1 ? t.length : t.indexOf('\n', desde);
    const siguiente = cortes.find(c => c > m.index! && c < finLinea) ?? finLinea;
    let hasta = siguiente;
    while (hasta > desde && /\s/.test(t[hasta - 1])) hasta--;
    const valor = t.slice(desde, hasta).trim();
    // La etiqueta sola al final de su línea («Nombre y apellidos:» y el nombre debajo, como sale de muchas tablas en
    // PDF; auditoría del 1-11-2026): el valor es la línea siguiente, si es corta y no es otra etiqueta
    if (!valor && hasta === desde) {
      const inicio = finLinea + 1;
      const fin = t.indexOf('\n', inicio) === -1 ? t.length : t.indexOf('\n', inicio);
      const debajo = inicio <= t.length ? t.slice(inicio, fin).trim() : '';
      if (debajo && debajo.length <= 80 && !cortes.some(c => c >= inicio && c < fin) && debajo !== R('dato quitado')) {
        if (ETIQUETA_PERSONA.test(m[0].trim())) nombres.push(debajo);
        t = `${t.slice(0, inicio)}${R('dato quitado')}${t.slice(fin)}`;
        continue;
      }
    }
    if (!valor || valor === R('dato quitado')) continue;
    if (ETIQUETA_PERSONA.test(m[0].trim())) nombres.push(valor);
    t = `${t.slice(0, desde)} ${R('dato quitado')}${t.slice(hasta)}`;
  }

  // 3. Esos nombres, donde vuelvan a salir: entero y cada palabra (con mayúscula, de 3 letras o más)
  const palabras = new Set<string>();
  for (const v of nombres) {
    for (const w of v.replace(TRATAMIENTO_INICIAL, '').split(/[\s,]+/)) {
      const p = w.replace(/[.,;:()]+$/, '');
      if (p.length >= 3 && /^\p{Lu}/u.test(p) && !PARTICULAS.has(p.toLocaleLowerCase('es'))) palabras.add(p);
    }
  }
  if (palabras.size) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...palabras].sort((a, b) => b.length - a.length).map(escapar).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    t = t.replace(re, R('nombre')).replace(/\[nombre\](?:\s+(?:(?:de|del|de la|i|y)\s+)?\[nombre\])+/g, R('nombre'));
  }

  // 4. Tratamientos
  return t.replace(TRATAMIENTO, (_, tr: string, esp: string) => `${tr}${esp}${R('nombre')}`);
}

/** Apellidos detrás del código de un alumno («[ALU-7] Martínez Gómez»): el documento lo nombra con apellidos que en la app no tiene. */
const APELLIDOS_TRAS_CODIGO = /(\[ALU-\d+\])(?:\s+(?:(?:de|del|de la)\s+)?\p{Lu}[\p{Ll}'-]+){1,3}/gu;

/**
 * El texto de un documento del alumnado tal como va a la IA (y como se enseña al docente para revisarlo): primero los
 * nombres del alumnado de la app pasan a su código (`enmascarar`, de `services/privacy.ts`), después se quita lo que
 * identifica y la app no conoce (`quitarIdentificadores`) y, por último, los apellidos que hayan quedado detrás de un
 * código. En este orden, el alumno conserva su código y lo demás sale como «[nombre]» o «[dato quitado]».
 */
export function textoDeDocumento(texto: string, enmascarar: (t: string) => string): string {
  return quitarIdentificadores(enmascarar(texto)).replace(APELLIDOS_TRAS_CODIGO, '$1').replace(/(\[ALU-\d+\])(?:\s+\[nombre\])+/g, '$1').trim();
}

/**
 * Lo que identifica a alguien sin ser su nombre: correos, teléfonos, DNI y NIE, fechas de nacimiento y números
 * largos (expediente, NIA, SIP, tarjeta sanitaria). Sirve para los textos libres que el docente escribe sobre su
 * alumnado (avisos, anotaciones, observaciones, notas de una reunión): a diferencia de `quitarIdentificadores`, no
 * quita líneas enteras, así que «Madre: se compromete a revisar la agenda» se queda como está.
 */
export function quitarDatosDeContacto(texto: string): string {
  return texto
    // Correos y teléfonos (España, con o sin +34 o 0034). Los fijos se escriben a menudo de dos en dos tras el prefijo
    // de provincia («96 123 45 67», «91 234 56 78»; auditoría del 1-11-2026: antes se quedaban)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, R('correo'))
    .replace(/(?<![\w+])(?:(?:\+|00)34[\s.-]?)?(?:[6789]\d{2}(?:(?:[\s.-]?\d{3}){2}|(?:[\s.-]?\d{2}){3})|[89]\d[\s.-]?\d{3}(?:[\s.-]?\d{2}){2})(?!\d)/g, R('teléfono'))
    // DNI y NIE, también con puntos o guiones («12.345.678-Z», «X-1234567-L»)
    .replace(/(?<![\p{L}\d.])(?:[XYZ][\s-]?\d{7}|\d{7,8}|\d{1,2}\.\d{3}\.\d{3})[\s-]?[A-Z](?![\p{L}\d])/gu, R('DNI'))
    // Fechas de nacimiento, con su etiqueta
    .replace(/((?:fecha\s+de\s+)?nacimiento|data\s+de\s+naixement|naixement|date\s+of\s+birth|birth\s*date|nacid[oa]\s+el|nascu[dt]a?\s+el|born\s+on|f\.?\s?nac\.?|d\.?\s?o\.?\s?b\.?)(\s*[:.-]?\s*)(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}\s+de\s+\p{L}+\s+(?:de|del)\s+\d{4})/giu, `$1$2${R('fecha')}`)
    // Números largos: expediente, NIA, SIP, tarjeta sanitaria, seguridad social
    .replace(/(?<![\d.,/-])\d{7,}(?![\d.,/-])/g, R('número'));
}

/*
 * Datos de salud (revisión del abogado del dueño, 3-11-2026): un diagnóstico (TEA, TDAH, dislexia…), una discapacidad,
 * un trastorno o una medicación son datos especialmente protegidos (artículo 9 del RGPD) aunque el nombre vaya
 * cambiado por un código, así que no se envían a la IA. Lo que sí sale es lo que el alumno necesita en el aula («le
 * ayudan las instrucciones cortas», «necesita apoyo visual»): eso es lo que la IA usa para adaptar.
 */

// Siglas: se distinguen las mayúsculas («toc» es una palabra catalana; «TOC», un trastorno)
const SIGLAS_SALUD = /(?<![\p{L}\d])(?:TEA|TGD|TDAH|TDA-?H?|TEL|TDL|TOC|TND|TANV|TEPT|ASD|ADHD|ADD|OCD|ODD|PTSD|SLI|DLD)(?![\p{L}\d])/gu;

// Palabras que arrastran lo que las sigue hasta la puntuación (como mucho seis palabras): «trastorno del espectro del
// autismo», «discapacidad intelectual leve», «síndrome de Down», «diagnóstico de dislexia»
const CON_COLA = String.raw`trastorn\p{L}*|disorders?|s[íi]ndromes?|syndromes?|discapacidad(?:es)?|discapacitat(?:s)?|disabilit(?:y|ies)|diagn[oòó]s\p{L}*|diagnos\p{L}*|d[ée]ficit\s+de\s+atenci[oó]n|d[èe]ficit\s+d['’]atenci[oó]|attention\s+deficit|par[áà]lisis?\s+cerebral|cerebral\s+palsy|cociente\s+intelectual|coeficient\s+intel·lectual|\bCI\b|\bIQ\b`;

// Palabras sueltas (por su raíz, sin distinguir mayúsculas)
const SUELTAS = [
  String.raw`autis\p{L}*`, String.raw`asperger\p{L}*`, String.raw`disl[eéè]x\p{L}*`, String.raw`dyslex\p{L}*`, String.raw`discalc\p{L}*`, String.raw`dyscalc\p{L}*`,
  String.raw`disgraf\p{L}*`, String.raw`dysgraph\p{L}*`, String.raw`disortograf\p{L}*`, String.raw`dispr[àa]xi\p{L}*`, String.raw`dyspraxi\p{L}*`,
  String.raw`disfasi\p{L}*`, String.raw`dysphasi\p{L}*`, String.raw`disfem\p{L}*`, String.raw`hiperactiv\p{L}*`, String.raw`hyperactiv\p{L}*`,
  String.raw`hipoac[úu]si\p{L}*`, String.raw`sorder\p{L}*`, String.raw`sordesa`, String.raw`deafness`, String.raw`ceguer\p{L}*`, String.raw`ceguesa`, String.raw`blindness`,
  String.raw`baja\s+visi[oó]n`, String.raw`baixa\s+visi[oó]`, String.raw`low\s+vision`, String.raw`epil[eè]p\p{L}*`, String.raw`diabet\p{L}*`,
  String.raw`esquizofr\p{L}*`, String.raw`schizophr\p{L}*`, String.raw`bipolar\p{L}*`, String.raw`depresi\p{L}*`, String.raw`depressi\p{L}*`,
  String.raw`espina\s+b[íi]fida`, String.raw`spina\s+bifida`, String.raw`distrofi\p{L}*`, String.raw`dystroph\p{L}*`, String.raw`hemipar\p{L}*`,
  String.raw`hemipl[eè]j\p{L}*`, String.raw`hemipleg\p{L}*`, String.raw`tetrapl\p{L}*`, String.raw`parapl\p{L}*`, String.raw`x\s+fr[áà]gil`, String.raw`fragile\s+x`,
  String.raw`medicaci\p{L}*`, String.raw`medicad[oa]s?`, String.raw`medicat\p{L}*`, String.raw`medication\p{L}*`, String.raw`metilfenidat\p{L}*`,
  String.raw`methylphenidat\p{L}*`, String.raw`concerta`, String.raw`rubifen`, String.raw`elvanse`, String.raw`risperidon\p{L}*`, String.raw`neuropediatr\p{L}*`,
  String.raw`psiquiatr\p{L}*`, String.raw`psychiatr\p{L}*`, String.raw`salud\s+mental`, String.raw`salut\s+mental`, String.raw`mental\s+health`,
  String.raw`implante\s+coclear`, String.raw`implant\s+coclear`, String.raw`cochlear\s+implant`, String.raw`aud[íi]fonos?`, String.raw`hearing\s+aids?`,
  String.raw`cardiopat\p{L}*`, String.raw`cel[íi]ac\p{L}*`, String.raw`coeliac\p{L}*`, String.raw`celiac\p{L}*`, String.raw`asma`, String.raw`asthma`,
];

const RE_CON_COLA = new RegExp(`(?<![\\p{L}\\d])(?:${CON_COLA})(?![\\p{L}\\d])`, 'giu');
// Donde se corta la cola: una palabra que empieza otra idea («desde», «que», «necesita», «pero»…)
const CORTE_COLA = new Set(('desde que porque pero aunque y e i o u and or but since because with con amb sin sense without ' +
  'le la lo les los se li el en a al por per para for to que necesita necessita needs presenta present shows tiene té has ' +
  'muestra mostra trabaja treballa works').split(' '));

/** El final de la cola de una palabra con cola: hasta seis palabras, sin pasar de la puntuación ni de una palabra de corte. */
function finDeCola(t: string, desde: number): number {
  let fin = desde;
  const re = /^[ \t]+(\(?[\p{L}\d·'’-]+\)?)/u;
  for (let n = 0; n < 6; n++) {
    const m = re.exec(t.slice(fin));
    if (!m) break;
    const palabra = m[1].replace(/[()]/g, '').toLocaleLowerCase('es');
    if (CORTE_COLA.has(palabra) && !['de', 'del'].includes(palabra)) break;
    fin += m[0].length;
  }
  return fin;
}

const GRADO = String.raw`(?:[ \t]+(?:leve|lleu|moderad[oa]|moderat|grave|greu|sever[oa]?|profund[oa]?|mild|moderate|severe|profound))?`;
const RE_SUELTAS = new RegExp(`(?<![\\p{L}\\d])(?:${SUELTAS.join('|')})${GRADO}(?![\\p{L}\\d])`, 'giu');
const SALUD = R('dato de salud');
const escSalud = escapar(SALUD);

/**
 * Quita de un texto libre lo que habla de la salud del alumno: diagnósticos, trastornos, discapacidades, síndromes,
 * medicación y especialistas médicos. No puede reconocer una descripción sin esas palabras («le cuesta relacionarse»),
 * pero esa es justo la que sirve para adaptar. Se usa con todo lo que el docente escribe sobre su alumnado y con los
 * documentos del alumnado (`quitarIdentificadores`).
 */
export function quitarDatosDeSalud(texto: string): string {
  if (!texto) return texto;
  let t = '';
  let desde = 0;
  for (const m of texto.matchAll(RE_CON_COLA)) {
    if (m.index! < desde) continue;
    t += texto.slice(desde, m.index) + SALUD;
    desde = finDeCola(texto, m.index! + m[0].length);
  }
  t += texto.slice(desde);
  t = t.replace(RE_SUELTAS, SALUD).replace(SIGLAS_SALUD, SALUD);
  // «[dato de salud] y [dato de salud] ([dato de salud])» → uno solo
  const juntos = new RegExp(`${escSalud}(?:\\s*(?:,|;|/|\\+|y|e|i|and|o|or|\\(|\\))\\s*${escSalud}\\)?)+`, 'giu');
  t = t.replace(juntos, SALUD).replace(new RegExp(`\\(\\s*${escSalud}\\s*\\)`, 'g'), '').replace(/[ \t]{2,}/g, ' ');
  return t;
}

/** `true` si a un texto ya filtrado solo le quedan datos de salud quitados (un aviso que decía solo «Dislexia»). */
export const soloDatosDeSalud = (texto: string) => texto.includes(SALUD) && !texto.split(SALUD).join('').replace(/[\s.,;:()/+-]|\b(?:y|e|i|and)\b/gu, '');

/** Un texto libre sobre el alumnado tal como va a la IA: sin datos de contacto ni datos de salud. */
export const textoLibreParaIA = (texto: string) => quitarDatosDeSalud(quitarDatosDeContacto(texto));
