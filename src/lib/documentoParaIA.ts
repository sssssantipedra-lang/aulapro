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
 * Etiquetas de un documento cuyo valor es una persona (el alumno, su familia, su tutor u orientador, los especialistas
 * que lo atienden, quien firma o redacta) o un lugar que la identifica (domicilio, centro, código postal). En
 * castellano, catalán e inglés. Detrás va «:». Ampliadas en la auditoría del 5-11-2026 (familia, especialistas,
 * «Nombre del alumno», «Elaborado por», «Firma», «Profesora de PT»…).
 */
const PERSONA = [
  'nombre(?:\\s+(?:y\\s+apellidos|completo|del?\\s+alumn[oa](?:\\/a)?|de\\s+la\\s+alumna|del\\s+estudiante))?', 'apellidos(?:\\s+y\\s+nombre)?', 'apellidos?,\\s*nombre',
  'nom(?:\\s+(?:i\\s+cognoms|complet|de\\s+l[\'’]alumn[ea]))?', 'cognoms(?:\\s+i\\s+nom)?', '(?:full\\s+|student[\'’]?s?\\s+|pupil[\'’]?s?\\s+)?name', 'surnames?',
  'alumn[oa]s?(?:\\/a)?', 'alumne', 'student', 'pupil', 'padres?', 'madre', 'madre\\/padre', 'padre\\/madre', 'pares?', 'mare', 'father', 'mother', 'parents?',
  'progenitor(?:[ae]s?)?', 'herman[oa]s?(?:\\/a)?', 'germ[àa]n?s?', 'germanes', 'siblings?', 'brother', 'sister', 'abuel[oa]s?', 'avis?', '[àa]via', 'grandparents?',
  'tutor(?:[ae])?(?:\\/a)?(?:\\s+legal(?:es)?)?', 'representantes?\\s+legal(?:es)?', 'legal\\s+guardians?', 'persona\\s+de\\s+contacto', 'contacto', 'contact(?:\\s+person)?', 'emergencias?',
  'orientador(?:[ae])?(?:\\/a)?(?:\\s+(?:educativ[oa]|escolar))?', 'psic[oó]log[oa](?:\\/a)?', 'psicopedagog[oa](?:\\/a)?', 'logopeda', 'pediatra', 'm[eé]dic[oa](?:\\/a)?', 'neur[oó]log[oa]', 'psiquiatra',
  'maestr[oa](?:\\/a)?(?:\\s+de\\s+[\\p{L} ]{1,30}?)?', 'profesor(?:[ae])?(?:\\/a)?(?:\\s+de\\s+[\\p{L} ]{1,30}?)?', 'professor(?:[ae])?', 'teacher', 'especialista(?:\\s+(?:de|en)\\s+[\\p{L} ]{1,30}?)?',
  'pt', 'al', 'pt\\/al',
  'director(?:[ae])?(?:\\/a)?', 'jef[ea]\\s+de\\s+estudios', 'cap\\s+d[\'’]estudis', 'secretari[oa]', 'coordinador(?:a)?', 'responsable',
  'fdo\\.?', 'firmado(?:\\s+por)?', 'firma', 'signat', 'signatura', 'signature', 'signed(?:\\s+by)?', 'elaborado\\s+por', 'realizado\\s+por', 'redactado\\s+por', 'elaborat\\s+per',
  'redactat\\s+per', 'prepared\\s+by', 'written\\s+by', 'autor(?:a)?', 'author', 'v[ºo]\\.?\\s?b[ºo]\\.?', 'visto\\s+bueno',
];
const LUGAR = [
  'domicilio', 'direcci[oó]n', 'adre[cç]a', 'address', 'centro(?:\\s+educativo)?', 'centre(?:\\s+educatiu)?', 'colegio', 'school',
  'localidad', 'municipio', 'poblaci[oó]n', 'localitat', 'c[oó]digo\\s+postal', 'codi\\s+postal', 'c\\.\\s?p\\.', 'cp', 'postcode', 'zip(?:\\s+code)?', 'barrio', 'barri',
];
/** Otras etiquetas habituales: no se tapan, pero marcan dónde acaba el valor de la anterior en la misma línea. */
const OTRAS = [
  'fecha(?:\\s+de\\s+\\p{L}+)?', 'data(?:\\s+de\\s+\\p{L}+)?', 'date(?:\\s+of\\s+\\p{L}+)?', 'nivel(?:\\s*\\/\\s*curso)?', 'curso', 'etapa',
  'grupo', 'edad', 'nia', 'sip', 'dni', 'nie', 'tel[eé]fono', 'm[oó]vil', 'correo(?:\\s+electr[oó]nico)?', 'e-?mail', 'nacionalidad',
  'sexo', 'g[eé]nero', 'level', 'year', 'class', 'age', 'curs', 'edat', 'provincia', 'prov[íi]ncia', 'expediente',
];
const etiquetas = (lista: string[]) => new RegExp(`(?<=^|[\\s(;,|])(?:${lista.join('|')})[ \\t]*:`, 'gimu');
const ETIQUETA_TAPAR = etiquetas([...PERSONA, ...LUGAR]);
const ETIQUETA_PERSONA = new RegExp(`^(?:${PERSONA.join('|')})[ \\t]*:$`, 'iu');
const ETIQUETA_CUALQUIERA = etiquetas([...PERSONA, ...LUGAR, ...OTRAS]);

/**
 * Las etiquetas que en una tabla de un PDF salen sin dos puntos, con el valor detrás separado por dos espacios o un
 * tabulador («Nombre y apellidos  Carla Sanz Mir»): se les pone el «:» para que se traten como las demás.
 */
const ETIQUETA_SIN_DOS_PUNTOS = /^([ \t]*(?:nombre\s+y\s+apellidos|apellidos\s+y\s+nombre|nombre\s+del?\s+alumn[oa](?:\/a)?|nombre\s+completo|alumn[oa]\/a|nom\s+i\s+cognoms|cognoms\s+i\s+nom|full\s+name|student\s+name|fecha\s+de\s+nacimiento|data\s+de\s+naixement|date\s+of\s+birth|domicilio|direcci[oó]n|adre[çc]a|address))(?:[ \t]{2,}|\t)(?=\S)/gimu;

/**
 * En una tabla con separadores («;», tabulador o «|», como un CSV exportado de la lista de clase), la cabecera dice qué
 * hay en cada columna: las columnas de persona, lugar, nacimiento, teléfono o documento se tapan en todas las filas.
 */
const CABECERA_TAPAR = new RegExp(`^(?:${[...PERSONA, ...LUGAR, 'fecha(?:\\s+de)?\\s+nac\\.?(?:imiento)?', 'data\\s+(?:de\\s+)?naix\\.?(?:ement)?', 'nacimiento', 'naixement', 'birth(?:\\s*date)?',
  'tel[eé]fonos?', 'tel\\.?', 'm[oó]vil', 'dni', 'nie', 'nif', 'correos?(?:\\s+electr[oó]nico)?', 'e-?mail', 'nia', 'sip', 'expediente', 'exp\\.?'].join('|')})\\s*[.:]?$`, 'iu');
function taparColumnas(t: string): string {
  const lineas = t.split('\n');
  let sep: string | null = null;
  let columnas: number[] = [];
  return lineas.map(linea => {
    if (sep && linea.split(sep).length > 1) {
      const celdas = linea.split(sep);
      return celdas.map((c, i) => (columnas.includes(i) && c.trim() ? R('dato quitado') : c)).join(sep);
    }
    sep = null; columnas = [];
    for (const s of [';', '\t', '|']) {
      const celdas = linea.split(s);
      if (celdas.length < 3) continue;
      const idx = celdas.map((c, i) => (CABECERA_TAPAR.test(c.trim()) ? i : -1)).filter(i => i >= 0);
      if (idx.length) { sep = s; columnas = idx; break; }
    }
    return linea;
  }).join('\n');
}

/**
 * Tratamientos delante de un nombre: «D. Andrés Ferrer», «Dña. Marta Gil», «Dra. López», «Mrs. Smith», también en
 * mayúsculas o sin el punto («DÑA. MARTA GIL», «Sra Gil»; auditoría del 1-11-2026), «D.ª», «Prof.», «Hno.» (5-11-2026).
 * El nombre no sigue en otra línea: ahí empieza otra cosa (una etiqueta, por ejemplo).
 */
const TRATAMIENTOS = 'D\\.ª|D\\.|Dª\\.?|D[ñÑ]a\\.?|DÑA\\.?|Don|DON|Doña|DOÑA|Sr\\.?|SR\\.?|Sra\\.?|SRA\\.?|Srta\\.?|SRTA\\.?|Dr\\.?|DR\\.|Dra\\.?|DRA\\.|Prof\\.|Profa\\.|PROF\\.|PROFA\\.|Hno\\.|Hna\\.|Mr\\.?|Mrs\\.?|Ms\\.?|Miss';
const TRATAMIENTO = new RegExp(`(?<![\\p{L}])(${TRATAMIENTOS})([ \\t]+)\\p{Lu}[\\p{L}'’-]+(?:[ \\t]+(?:(?:de|del|de la|i)[ \\t]+)?\\p{Lu}[\\p{L}'’-]+){0,3}`, 'gu');
const TRATAMIENTO_INICIAL = new RegExp(`^(?:${TRATAMIENTOS})\\s+`, 'u');
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'i', 'van', 'von', 'da', 'do', 'dos', 'el', 'els', 'les']);
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Tapa lo que identifica a una persona en un documento y que la lista del alumnado no cubre. No es perfecto (un
 * nombre suelto que no esté en la lista ni detrás de una etiqueta no se puede reconocer), por eso el texto se enseña
 * al docente antes de enviarlo cuando hay dónde.
 *
 * 1. Datos de contacto y de salud (`textoLibreParaIA`), y las columnas de una tabla cuya cabecera es una etiqueta.
 * 2. El valor de cada etiqueta de persona o de lugar, esté al principio o en mitad de la línea (un PDF junta en una
 *    línea «Nivel / Curso: 4º … Tutor/a: D. Andrés Ferrer»), hasta la siguiente etiqueta o el final de la línea.
 * 3. Los nombres que había detrás de esas etiquetas, también donde vuelvan a salir en el documento: el informe dice
 *    arriba cómo se llama el alumno y luego lo nombra en el texto y en el pie de página (revisión del 31-10-2026,
 *    con un informe de prueba del dueño).
 * 4. Un nombre detrás de un tratamiento («D.», «Dña.», «Sr.»…).
 */
export function quitarIdentificadores(texto: string): string {
  let t = taparColumnas(textoLibreParaIA(texto.replace(ETIQUETA_SIN_DOS_PUNTOS, '$1: ')));

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
      if (p.length >= 3 && /^\p{Lu}/u.test(p) && !PARTICULAS.has(p.toLocaleLowerCase('es')) && !/^\[/.test(p)) palabras.add(p);
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

/* ── Fechas de nacimiento sin etiqueta ──
 *
 * Una fecha completa (día, mes y año) de hace entre 3 y 22 años es, en un texto sobre un alumno, casi siempre su fecha
 * de nacimiento («Edad: 10 años (03/05/2015)»): se quita aunque no lleve etiqueta. Las fechas del curso (un examen, una
 * reunión) se quedan. Auditoría del 5-11-2026.
 */
const MESES = new Set(('enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre ' +
  'gener febrer març abril maig juny juliol agost setembre octubre novembre desembre ' +
  'january february march april may june july august september october november december').split(' '));
const FECHA_COMPLETA = /(?<![\d/.-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?![\d/.-])|(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<![\p{L}\d])(\d{1,2})\s+(?:de\s+|d['’])?(\p{L}+)\s+(?:de\s+|del\s+|d['’])?(\d{4})(?!\d)/giu;
/** El año de una fecha de `FECHA_COMPLETA`, o `null` si no es una fecha de verdad. */
function anioDe(m: RegExpExecArray | string[]): number | null {
  const [, d1, m1, a1, a2, m2, d2, d3, mes3, a3] = m;
  if (a1 !== undefined) {
    const d = Number(d1), mm = Number(m1);
    if (d < 1 || d > 31 || mm < 1 || mm > 12) return null;
    return a1.length === 4 ? Number(a1) : 2000 + Number(a1);
  }
  if (a2 !== undefined) return Number(m2) >= 1 && Number(m2) <= 12 && Number(d2) >= 1 && Number(d2) <= 31 ? Number(a2) : null;
  if (a3 !== undefined) return MESES.has(mes3.toLocaleLowerCase('es')) && Number(d3) >= 1 && Number(d3) <= 31 ? Number(a3) : null;
  return null;
}
export function esFechaDeNacimiento(fecha: string, hoy = new Date()): boolean {
  const re = new RegExp(FECHA_COMPLETA.source, 'iu');
  const m = re.exec(fecha);
  if (!m) return false;
  const anio = anioDe(m);
  return anio !== null && anio >= hoy.getFullYear() - 22 && anio <= hoy.getFullYear() - 3;
}

/** Centros educativos por su nombre («CEIP Las Acacias», «IES Pere Boïl», «Colegio San José», «Escola Pau Vila»). */
const CENTRO = new RegExp(
  String.raw`(?<![\p{L}])(?:CEIP|CEE|CPI|CRA|CEPA|CPEE|CEIPSO|CEIM|CPR|IES|IESO|CIFP|CFPA|EOI|EEI|ZER|Colegio|Col[·.]legi|Escola|Escuela|Instituto|Institut|Centro\s+(?:educativo|escolar|p[úu]blico|concertado)|Centre\s+(?:educatiu|escolar)|School|Academy)` +
  String.raw`\s+(?:(?:de|del|la|las|los|el|els|les|d['’]|l['’]|San|Sant|Santa|Nuestra\s+Señora(?:\s+de)?|Mare\s+de\s+D[ée]u(?:\s+de)?|Virgen(?:\s+de)?|Sagrad[oa]\s+\p{L}+|Nª\s+Sª|N\.ª\s+S\.ª)\s+)*[\p{Lu}][\p{L}'’·.-]+(?:[ \t]+(?:(?:de|del|la|las|los|el|els|les|i|y|d['’]|l['’])[ \t]+)?[\p{Lu}][\p{L}'’·.-]+){0,4}`, 'gu');

/**
 * Lo que identifica a alguien sin ser su nombre: correos (también disimulados, «lucia (at) gmail.com»), usuarios de
 * redes, teléfonos (de España con cualquier separación y de otros países con su prefijo), DNI y NIE (también en
 * minúscula), IBAN, números de expediente, NIA, SIP o tarjeta sanitaria con su etiqueta, fechas de nacimiento (con
 * etiqueta, o sin ella si son de hace entre 3 y 22 años), direcciones, códigos postales, centros educativos por su
 * nombre y números largos. Sirve para los textos libres que el docente escribe sobre su alumnado (avisos, anotaciones,
 * observaciones, notas de una reunión): a diferencia de `quitarIdentificadores`, no quita líneas enteras, así que
 * «Madre: se compromete a revisar la agenda» se queda como está.
 */
export function quitarDatosDeContacto(texto: string, hoy = new Date()): string {
  return texto
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, R('correo'))
    .replace(/[\w.+-]+\s*[([{]\s*(?:at|arroba)\s*[)\]}]\s*[\w-]+(?:\s*(?:\.|[([{]\s*(?:dot|punto|punt)\s*[)\]}])\s*[\w-]+)+/gi, R('correo'))
    .replace(/(?<![\w.@])@[\w.]{2,}\w/gu, R('usuario'))
    // Teléfonos de España: nueve cifras que empiezan por 6, 7, 8 o 9, con cualquier separación («612 345 678», «96 123 45 67»,
    // «96 12 34 567»), con o sin +34 o 0034, y con el prefijo entre paréntesis («(96) 123 45 67»)
    .replace(/(?<![\w+])(?:\(?(?:\+|00)34\)?[\s.-]?)?(?:\(\d{2,3}\)[\s.-]?\d(?:[\s.-]?\d){5,6}|[6789](?:[\s.-]?\d){8})(?!\d)/g, R('teléfono'))
    // Teléfonos de otros países, con su prefijo («+44 7911 123456», «0033 6 12 34 56 78»)
    .replace(/(?<![\w+])(?:\+|00)\d{1,3}[\s.-]?(?:\(0\)[\s.-]?)?\d(?:[\s.-]?\d){6,11}(?!\d)/g, R('teléfono'))
    // DNI y NIE, también con puntos o guiones y en minúscula («12.345.678-Z», «X-1234567-L», «12345678z»)
    .replace(/(?<![\p{L}\d.])(?:[XYZxyz][\s-]?\d{7}|\d{7,8}|\d{1,2}\.\d{3}\.\d{3})(?:[\s-]?[A-Z]|-?[a-z])(?![\p{L}\d])/gu, R('DNI'))
    // IBAN
    .replace(/(?<![\p{L}\d])[A-Z]{2}\d{2}(?:[\s-]?[\dA-Z]{4}){3,7}(?:[\s-]?[\dA-Z]{1,4})?(?![\p{L}\d])/gu, R('número'))
    // Identificadores con su etiqueta, aunque sean cortos («Exp. 2023/0456», «NIA 1234567», «tarjeta sanitaria 123 456 78 90»)
    .replace(/(?<![\p{L}])(NIA|SIP|CIP|NUSS|NSS|NIF|expediente|exp\.|n[ºo°]\s*(?:de\s+)?exp(?:ediente)?\.?|tarjeta\s+sanitaria|targeta\s+sanit[àa]ria|seguridad\s+social|seguretat\s+social|pasaporte|passaport|passport)(\s*[:.]?\s*(?:n[ºo°]\.?\s*)?[:.]?\s*)(?:[A-Z]{1,3}[-/ ]?)?\d[\d\s./-]*\d[A-Za-z]?(?![\p{L}\d])/giu, `$1$2${R('número')}`)
    // Fechas de nacimiento, con su etiqueta («fecha de nacimiento», «nacido el», «nació el», «F. Nac.», «DOB», «va néixer el»)
    .replace(/((?:fecha\s+de\s+)?nacimiento|fecha\s+nac\.?|f\.?\s?n(?:ac)?\.?|data\s+de\s+naixement|data\s+naix\.?|naixement|date\s+of\s+birth|birth\s*date|birth|nacid[oa]|naci[oó]|nascu[dt]a?|nasqu[eé]|va\s+n[éè]ixer|born|d\.?\s?o\.?\s?b\.?)(\s*(?:el|en|on|:|\.|-)?\s*)(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:de\s+|d['’])?\p{L}+\s+(?:de\s+|del\s+|d['’])?\d{4})/giu, `$1$2${R('fecha')}`)
    // Y sin etiqueta, si son de hace entre 3 y 22 años
    .replace(FECHA_COMPLETA, m => (esFechaDeNacimiento(m, hoy) ? R('fecha') : m))
    // Direcciones («C/ Mayor 12, 3ºB», «calle de la Paz nº 4») y códigos postales con su etiqueta
    .replace(/(?<![\p{L}])(?:c\/|calle|carrer|avda\.?|avinguda|avenida|av\.|plaza|pla[çc]a|pza\.?|paseo|passeig|carretera|ctra\.?|urb\.?|urbanizaci[oó]n|urbanitzaci[oó]|traves[ií]a|travessera|rambla|pasaje|passatge|street|road|avenue|lane)\s+(?:(?:de|del|la|les|los|las|el|els|d['’]|l['’])\s+)*[^\d\n;:]{2,40}?,?\s*(?:n[ºo°.]?\s*)?\d+[^\n;:,]{0,20}/giu, R('dirección'))
    .replace(/(?<![\p{L}])(c[oó]digo\s+postal|codi\s+postal|c\.\s?p\.|cp|postcode|zip(?:\s+code)?)(\s*[:.]?\s*)\d{5}(?!\d)/giu, `$1$2${R('dirección')}`)
    // Centros educativos por su nombre
    .replace(CENTRO, R('centro'))
    // Números largos: expediente, NIA, SIP, tarjeta sanitaria, seguridad social
    .replace(/(?<![\d.,/-])\d{7,}(?![\d.,/-])/g, R('número'));
}

/*
 * Datos de salud (revisión del abogado del dueño, 3-11-2026): un diagnóstico (TEA, TDAH, dislexia…), una discapacidad,
 * un trastorno o una medicación son datos especialmente protegidos (artículo 9 del RGPD) aunque el nombre vaya
 * cambiado por un código, así que no se envían a la IA. Lo que sí sale es lo que el alumno necesita en el aula («le
 * ayudan las instrucciones cortas», «necesita apoyo visual»): eso es lo que la IA usa para adaptar.
 *
 * Ampliado en la auditoría del 5-11-2026: siglas con puntos («T.D.A.H.») y en minúscula las que no son otra palabra
 * («tdah»), categorías de necesidades (NEE, NEAE, altas capacidades, dictamen), alergias e intolerancias, salud mental
 * (ansiedad, fobia, autolesiones…), habla (tartamudeo, dislalia, logopeda), enfermedades y hospital, movilidad (silla
 * de ruedas, muletas), medicación por su nombre y especialistas y servicios de salud (psicólogo, neurólogo, USMIJ).
 */

/** Siglas: se distinguen las mayúsculas («toc» es una palabra catalana; «TOC», un trastorno), también con puntos («T.E.A.»). */
const SIGLAS = ['TEA', 'TGD', 'TDAH', 'TDA', 'TEL', 'TDL', 'TOC', 'TND', 'TANV', 'TEPT', 'TEAF', 'TCA', 'ASD', 'ADHD', 'ADD', 'OCD', 'ODD', 'PTSD', 'SLI', 'DLD',
  'NEE', 'NEAE', 'ACNEE', 'ACNEAE', 'AACC', 'DEA', 'USMIJ', 'CSMIJ', 'CSMA', 'CSMIA', 'UTCA', 'CDIAP', 'CAIT', 'SAF', 'FASD'];
/** Las que en minúscula tampoco son otra palabra («tdah» sí; «tea», «toc» o «add» no). */
const SIGLAS_MINUSCULA = ['tdah', 'tgd', 'tanv', 'tept', 'adhd', 'ptsd', 'neae', 'acnee', 'acneae', 'aacc', 'usmij', 'csmij', 'cdiap', 'teaf', 'fasd'];
const conPuntos = (s: string) => `${[...s].join('\\.')}\\.?|${s}`;
const GRADO = String.raw`(?:[ \t]+(?:leve|lleu|moderad[oa]|moderat|grave|greu|sever[oa]?|profund[oa]?|mild|moderate|severe|profound))?(?:[ \t]+(?:de\s+)?(?:grado|grau|grade|level|nivel|nivell)\s+[123])?(?:[ \t]*\(?\d{2}\s?%\)?)?`;
const SIGLAS_SALUD = new RegExp(`(?<![\\p{L}\\d])(?:${SIGLAS.map(conPuntos).join('|')}|TDA-H|tda-h|${SIGLAS_MINUSCULA.join('|')})${GRADO}(?![\\p{L}\\d])`, 'gu');
/** El síndrome, con mayúscula, sin la palabra «síndrome» («niño Down»). */
const DOWN = /(?<![\p{L}])Down(?![\p{L}])/gu;

// Palabras que arrastran lo que las sigue hasta la puntuación (como mucho seis palabras): «trastorno del espectro del
// autismo», «discapacidad intelectual leve», «síndrome de Down», «diagnóstico de dislexia», «alergia a los frutos secos»
const CON_COLA = [
  String.raw`trastorn\p{L}*|disorders?|s[íi]ndromes?|syndromes?|discapacidad(?:es)?|discapacitat(?:s)?|disabilit(?:y|ies)|diagn[oòó]s\p{L}*|diagnos\p{L}*`,
  String.raw`d[ée]ficits?\s+(?:de\s+|d['’])?(?:atenci\p{L}*|auditiv\p{L}*|visual\p{L}*|motor\p{L}*|motriu|cognitiv\p{L}*|intel·lectual|intelectual|sensorial)|attention\s+deficit`,
  String.raw`par[áà]lisis?\s+cerebral|cerebral\s+palsy|cociente\s+intelectual|coeficient\s+intel·lectual|\bCI\b|\bIQ\b`,
  String.raw`retr[aà]s(?:o|os)?\s+(?:madurativ\p{L}*|psicomotor|psicomotriu|global|mental|cognitiv\p{L}*|(?:del?|en\s+el)\s+(?:lenguaje|llenguatge|habla|parla|desarrollo|desenvolupament))|developmental\s+delay`,
  String.raw`alt[ae]s\s+capaci(?:dades|tats)|high\s+abilit\p{L}*|superdotad\p{L}*|gifted(?:ness)?|dictamen(?:\s+(?:de\s+escolarizaci[oó]n|d['’]escolaritzaci[oó]))?`,
  String.raw`enfermedad(?:es)?|malalti\p{L}*|illness(?:es)?|deficiencia\s+(?:visual|auditiva|mental|intelectual|motora|f[íi]sica)`,
  String.raw`(?:al[eé]rgi\p{L}*|al[·.]l[eè]rgi\p{L}*|allerg\p{L}*)(?:\s+(?:a|al|als|to)\s+(?:l[oa]s?\s+|els?\s+|the\s+)?\p{L}+(?:\s+\p{L}+)?)?|an[aà]filaxi\p{L}*|anaphyla\p{L}*`,
  String.raw`intoleran\p{L}*\s+(?:a\s+|to\s+)?(?:la\s+|al\s+|el\s+|als?\s+|els?\s+|los\s+|las\s+)?(?:lactosa|lactose|gluten|fructosa|fructose|huevo|ou|leche|llet|frutos\s+secos|fruits\s+secs|nuts|dairy|eggs?)`,
  String.raw`crisis\s+(?:epil\p{L}*|convulsiv\p{L}*|de\s+ansiedad|d['’]ansietat|de\s+p[áa]nico|de\s+pànic)|panic\s+attacks?|ataques?\s+de\s+(?:p[áa]nico|ansiedad)|atacs?\s+de\s+(?:p[àa]nic|ansietat)`,
  String.raw`ideaci[oó]n?\s+suicida|suicidal\s+(?:thoughts|ideation)|mutismo|mutisme|mutism|atenci[oó]n?\s+temprana|atenci[oó]\s+precoç|early\s+intervention`,
  String.raw`terapia\s+ocupacional|ter[àa]pia\s+ocupacional|occupational\s+therap\p{L}*|(?:va|acude|asiste|assisteix|goes)\s+a\s+(?:terapia|ter[àa]pia|therapy)|unidad\s+de\s+salud\s+mental|unitat\s+de\s+salut\s+mental`,
  String.raw`bomba\s+de\s+insulina|insulin\s+pump|silla\s+de\s+ruedas|cadira\s+de\s+rodes|wheelchair|tics?\s+(?:nervios\p{L}*|motor\p{L}*|vocal\p{L}*)|operad[oa]s?\s+(?:de|del|d['’])`,
  // Lesiones (el motivo de una exención de Educación Física es un dato de salud)
  String.raw`lesi[oó]n(?:es)?|lesionad[oa]s?|injur(?:y|ies|ed)|esguince\p{L}*|fractura\p{L}*|rotura\s+(?:de|del)|luxaci[oó]n\p{L}*|tendinitis|artritis|artrosis|escoliosis|sprain\p{L}*|fracture\p{L}*`,
].join('|');

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
  // Salud mental y conducta clínica
  String.raw`ansiedad`, String.raw`ansietat`, String.raw`anxi\p{L}*`, String.raw`p[áa]nico`, String.raw`pànic`, String.raw`panic`, String.raw`fobi\p{L}*`, String.raw`phobi\p{L}*`,
  String.raw`autoles\p{L}*`, String.raw`self-?harm\p{L}*`, String.raw`suicid\p{L}*`, String.raw`anorexi\p{L}*`, String.raw`bulimi\p{L}*`, String.raw`enuresis`, String.raw`encopresis`, String.raw`tourette`,
  // Habla y lenguaje
  String.raw`tartamud\p{L}*`, String.raw`quequej\p{L}*`, String.raw`quequeig`, String.raw`stutter\p{L}*`, String.raw`stammer\p{L}*`, String.raw`disl[aà]li\p{L}*`, String.raw`disartri\p{L}*`,
  String.raw`dysarthri\p{L}*`, String.raw`afasi\p{L}*`, String.raw`aphasi\p{L}*`, String.raw`apraxi\p{L}*`, String.raw`logoped\p{L}*`, String.raw`speech\s+(?:and\s+language\s+)?therap\p{L}*`,
  // Especialistas y servicios de salud
  String.raw`psicoterap\p{L}*`, String.raw`fisioterap\p{L}*`, String.raw`physiotherap\p{L}*`, String.raw`psychotherap\p{L}*`, String.raw`psic[oòó]l[oe]g\p{L}*`, String.raw`psychologist`,
  String.raw`neur[oó]log\p{L}*`, String.raw`neurolog\p{L}*`, String.raw`pediatr\p{L}*`, String.raw`paediatric\p{L}*`, String.raw`pediatric\p{L}*`,
  // Enfermedad, hospital y movilidad
  String.raw`hospital\p{L}*`, String.raw`ingresad[oa]s?`, String.raw`quimio\p{L}*`, String.raw`chemo\p{L}*`, String.raw`radioterap\p{L}*`, String.raw`c[àá]ncer`, String.raw`cancer`,
  String.raw`leucemi\p{L}*`, String.raw`leuka?emi\p{L}*`, String.raw`tumor\p{L}*`, String.raw`tumour\p{L}*`, String.raw`cirug[íi]a`, String.raw`cirurgia`, String.raw`surgery`,
  String.raw`convulsi\p{L}*`, String.raw`seizures?`, String.raw`muletas`, String.raw`crosses`, String.raw`crutches`, String.raw`pr[oòó]tesis`, String.raw`prosthe\p{L}*`, String.raw`andador`,
  String.raw`minusval\p{L}*`, String.raw`invident\p{L}*`, String.raw`sordomud\p{L}*`, String.raw`discapacitad\p{L}*`,
  // Medicación y alimentación por salud
  String.raw`inhalador`, String.raw`inhaler`, String.raw`insulina`, String.raw`insulin`, String.raw`glucosa`, String.raw`glucose`, String.raw`gluten`, String.raw`lactosa`, String.raw`lactose`,
  String.raw`f[áa]rmac\p{L}*`, String.raw`pastillas?`, String.raw`comprimid\p{L}*`, String.raw`jarabe`, String.raw`xarop`, String.raw`pills?`,
  String.raw`medikinet`, String.raw`ritalin`, String.raw`equasym`, String.raw`strattera`, String.raw`atomoxetin\p{L}*`, String.raw`intuniv`, String.raw`guanfacin\p{L}*`, String.raw`lisdexa[mn]fetamin\p{L}*`,
  String.raw`aripiprazol`, String.raw`abilify`, String.raw`risperdal`, String.raw`melatonin\p{L}*`, String.raw`depakine`, String.raw`valproat\p{L}*`, String.raw`keppra`, String.raw`levetiracetam`,
  String.raw`lamotrigin\p{L}*`, String.raw`sertralin\p{L}*`, String.raw`fluoxetin\p{L}*`, String.raw`prozac`, String.raw`ventol[íi]n`, String.raw`salbutamol`, String.raw`epipen`, String.raw`adrenalin\p{L}*`,
  String.raw`antihistam[íi]nic\p{L}*`, String.raw`antiepil[eé]ptic\p{L}*`, String.raw`anticonvulsiv\p{L}*`,
];

const RE_CON_COLA = new RegExp(`(?<![\\p{L}\\d])(?:${CON_COLA})(?![\\p{L}\\d])`, 'giu');
// Donde se corta la cola: una palabra que empieza otra idea («desde», «que», «necesita», «pero»…)
const CORTE_COLA = new Set(('desde que porque pero aunque y e i o u and or but since because with con amb sin sense without ' +
  'le la lo les los se li el en a al por per para for to que necesita necessita needs presenta present shows tiene té has ' +
  'muestra mostra trabaja treballa works').split(' '));

/** El final de la cola de una palabra con cola: hasta seis palabras, sin pasar de la puntuación ni de una palabra de corte. */
function finDeCola(t: string, desde: number): number {
  let fin = desde;
  const re = /^[ \t]+(\(?[\p{L}\d·'’%-]+\)?)/u;
  for (let n = 0; n < 6; n++) {
    const m = re.exec(t.slice(fin));
    if (!m) break;
    const palabra = m[1].replace(/[()]/g, '').toLocaleLowerCase('es');
    if (CORTE_COLA.has(palabra) && !['de', 'del'].includes(palabra)) break;
    fin += m[0].length;
  }
  return fin;
}

const RE_SUELTAS = new RegExp(`(?<![\\p{L}\\d])(?:${SUELTAS.join('|')})${GRADO}(?![\\p{L}\\d])`, 'giu');
const SALUD = R('dato de salud');
const escSalud = escapar(SALUD);

/**
 * Quita de un texto libre lo que habla de la salud del alumno: diagnósticos, trastornos, discapacidades, síndromes,
 * medicación, alergias, enfermedades y especialistas médicos. No puede reconocer una descripción sin esas palabras («le
 * cuesta relacionarse», «aletea cuando se emociona»), pero esa es justo la que sirve para adaptar. Se usa con todo lo
 * que el docente escribe sobre su alumnado y con los documentos del alumnado (`quitarIdentificadores`).
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
  t = t.replace(RE_SUELTAS, SALUD).replace(SIGLAS_SALUD, SALUD).replace(DOWN, SALUD);
  // «[dato de salud] y [dato de salud] ([dato de salud])» → uno solo
  const juntos = new RegExp(`${escSalud}(?:\\s*(?:,|;|/|\\+|y|e|i|and|o|or|\\(|\\))\\s*${escSalud}\\)?)+`, 'giu');
  t = t.replace(juntos, SALUD).replace(new RegExp(`\\(\\s*${escSalud}\\s*\\)`, 'g'), '').replace(/[ \t]{2,}/g, ' ');
  return t;
}

/** `true` si a un texto ya filtrado solo le quedan datos de salud quitados (un aviso que decía solo «Dislexia»). */
export const soloDatosDeSalud = (texto: string) => texto.includes(SALUD) && !texto.split(SALUD).join('').replace(/[\s.,;:()/+-]|\b(?:y|e|i|and)\b/gu, '');

/** Un texto libre sobre el alumnado tal como va a la IA: sin datos de contacto ni datos de salud. */
export const textoLibreParaIA = (texto: string) => quitarDatosDeSalud(quitarDatosDeContacto(texto));
