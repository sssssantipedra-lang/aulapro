/**
 * El cuaderno como una hoja de cálculo (22-11-2026, de la revisión a fondo de la app): pegar sobre una celda un
 * bloque copiado de una hoja de cálculo y poner una nota a quien no la tiene.
 *
 * Aquí va la lógica sin pantalla: leer lo que viene del portapapeles, decidir qué es una nota y preparar, sin
 * tocar nada, el plan de lo que cambiaría. La pantalla enseña ese plan antes de aplicarlo
 * (`components/cuaderno/VistaPreviaPegado.tsx`).
 *
 * **A quién va cada fila** (24-11-2026, tras probar con un listado oficial ordenado por apellido, que dejaba cinco
 * de seis notas en el alumno equivocado): si la hoja trae los nombres, cada fila va al alumno que se llama así
 * (`emparejarPorNombre`), en cualquier orden y escrito de cualquier forma («Apellidos, Nombre», sin tildes, en
 * mayúsculas, sin el segundo apellido, con la inicial). Una fila que no se parece a nadie, o que se parece igual a
 * dos, no se coloca: se enseña aparte y el docente elige a quién va. Si la hoja no trae nombres (o ninguno se parece
 * a nadie de la clase), se casa **por posición**: la primera fila va al alumno de la celda donde se pega, la segunda
 * al siguiente de la lista, y la pantalla pide confirmar que la hoja está en ese orden.
 *
 * Reglas:
 *  - Una nota es un número de 0 a 10, con coma o punto decimal. Lo demás («NP», «11», «7/10») se señala y no entra.
 *  - Una celda vacía de lo pegado no cambia nada: nunca borra una nota que ya estaba.
 *  - Si la primera fila trae títulos donde las demás traen notas, es la cabecera de la hoja y no se cuenta
 *    (el docente puede decir lo contrario). «NP», «-» o «Falta» no son un título: son un alumno sin nota. Tampoco
 *    lo es una nota mal escrita («11», «7'5», «7+», «7,5 (rec)»): es la del primer alumno, y se señala.
 *  - Las columnas de texto del principio (los nombres) y el número de lista que va delante no ocupan columna del cuaderno: se
 *    enseñan al lado de cada alumno para comprobar el orden, y se avisa si un nombre no se parece al de su fila.
 *  - Lo que no cabe (más filas que alumnado, más columnas que actividades) se dice y no entra.
 */
import type { GradeMap } from '../types';

/** Lo que se ha leído en una celda: una nota, nada, o algo que no es una nota. */
export type Lectura = { tipo: 'nota'; valor: number } | { tipo: 'vacia' } | { tipo: 'mal' };

/** Una nota escrita: uno o dos dígitos y, si acaso, decimales con coma o con punto. */
const NOTA = /^(?:\d{1,2}(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * Lee una nota escrita a mano o pegada: de 0 a 10, con coma o punto decimal, a dos decimales como mucho.
 * Es la misma regla para la celda del cuaderno, la lista de «Calificar esta actividad» y lo pegado.
 */
export function leerNota(texto: string): Lectura {
  const limpio = texto.replace(/\s+/g, '');
  if (limpio === '') return { tipo: 'vacia' };
  if (!NOTA.test(limpio)) return { tipo: 'mal' };
  const n = Number(limpio.replace(',', '.'));
  if (Number.isNaN(n) || n < 0 || n > 10) return { tipo: 'mal' };
  return { tipo: 'nota', valor: Math.round(n * 100) / 100 };
}

/** Tope de filas y de columnas que se leen de lo pegado: más que cualquier clase, y no se atasca con un texto enorme. */
export const MAX_FILAS = 300;
export const MAX_COLUMNAS = 60;

/**
 * Parte en filas y columnas lo que una hoja de cálculo deja en el portapapeles: columnas con tabulador y filas
 * con salto de línea; una celda con saltos o comillas va entre comillas dobles. Sin ningún tabulador, vale
 * también el punto y coma (un CSV abierto como texto). La coma nunca separa: es el decimal.
 * Las filas vacías del final se quitan (las hojas añaden una); las de en medio se conservan, porque la posición manda.
 */
export function leerPegado(texto: string): string[][] {
  const t = texto.replace(/\r\n?/g, '\n');
  const sep = t.includes('\t') ? '\t' : t.includes(';') ? ';' : '\t';
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let i = 0;
  const cerrarCelda = () => { fila.push(celda.replace(/\s+/g, ' ').trim()); celda = ''; };
  const cerrarFila = () => { cerrarCelda(); filas.push(fila); fila = []; };
  while (i < t.length && filas.length < MAX_FILAS) {
    const c = t[i];
    if (c === '"' && celda === '') {
      // Celda entre comillas: llega hasta la comilla de cierre (dos seguidas son una comilla escrita)
      let j = i + 1;
      let dentro = '';
      let cerrada = false;
      while (j < t.length) {
        if (t[j] === '"') {
          if (t[j + 1] === '"') { dentro += '"'; j += 2; continue; }
          cerrada = true; j++; break;
        }
        dentro += t[j]; j++;
      }
      if (cerrada && (j >= t.length || t[j] === sep || t[j] === '\n')) { celda = dentro; i = j; continue; }
      // No era una celda entre comillas (una comilla suelta): se lee tal cual
      celda += c; i++; continue;
    }
    if (c === sep) { cerrarCelda(); i++; continue; }
    if (c === '\n') { cerrarFila(); i++; continue; }
    celda += c; i++;
  }
  if (filas.length < MAX_FILAS && (celda !== '' || fila.length > 0)) cerrarFila();
  while (filas.length && filas[filas.length - 1].every(x => x === '')) filas.pop();
  if (filas.length === 0) return [];
  // Rectángulo: todas las filas con las mismas columnas, sin las del final que vienen vacías enteras
  let ancho = Math.min(MAX_COLUMNAS, Math.max(...filas.map(f => f.length)));
  while (ancho > 1 && filas.every(f => (f[ancho - 1] ?? '') === '')) ancho--;
  return filas.map(f => Array.from({ length: ancho }, (_, k) => f[k] ?? ''));
}

/** Si lo pegado es un bloque (más de una celda): entonces se enseña la vista previa; una sola celda se pega como siempre. */
export function esBloque(filas: string[][]): boolean {
  return filas.length > 1 || (filas[0]?.length ?? 0) > 1;
}

/** Lo pegado, ya entendido: las notas en su rejilla y lo que venía alrededor. */
export interface Pegado {
  /** Las celdas que van al cuaderno, fila a fila, sin la cabecera ni las columnas de nombre o de número de lista. */
  celdas: string[][];
  /** El texto que acompañaba a cada fila (el nombre que traía la hoja), o `null` si no traía ninguno. */
  etiquetas: string[] | null;
  /** El título de cada columna en la hoja, si traía cabecera. */
  titulos: string[] | null;
  /** Si la primera fila se ha tomado como cabecera. */
  cabecera: boolean;
  /** Si la primera fila parece una cabecera (lo que se propone de partida). */
  pareceCabecera: boolean;
  /** Si se ha apartado una columna con el número de lista (1, 2, 3…). */
  numeroDeLista: boolean;
  /** El número de lista de cada fila, si se ha apartado esa columna: ayuda a emparejar con «12 Marta». */
  numeros: string[] | null;
}

const esNota = (x: string) => leerNota(x).tipo === 'nota';
const hayTexto = (x: string) => leerNota(x).tipo === 'mal';

/**
 * Lo que un docente escribe en la casilla de un alumno en vez de una nota («NP», «-», «Falta», «Exento», «IN»…),
 * ya sin tildes, mayúsculas ni puntos. No es el título de una columna.
 */
const SIN_NOTA: ReadonlySet<string> = new Set([
  'np', 'ne', 'nc', 'ns', 'sc', 'nd', 'na', 'n/a', 'n/p', 'n/e', 'n/c', 's/c', 's/n', 'sn', 'x', 'f', 'fj', 'fi', 'no',
  'falta', 'faltas', 'falto', 'ausente', 'absent', 'absente', 'exento', 'exenta', 'exempt', 'exempta',
  'pendiente', 'pendent', 'pending', 'missing',
  'no presentado', 'no presentada', 'no presentat', 'no se presenta', 'no es presenta', 'not submitted',
  'no entregado', 'no entregada', 'no entregat', 'sin entregar', 'sense entregar', 'sense lliurar',
  'sin nota', 'sense nota', 'no evaluado', 'no evaluada', 'no avaluat', 'no avaluada', 'no calificado', 'no calificada',
  'in', 'su', 'bi', 'nt', 'sb', 'insuficiente', 'suficiente', 'bien', 'notable', 'sobresaliente',
  'insuficient', 'suficient', 'be', 'excel·lent', 'apto', 'apta', 'no apto', 'no apta', 'apte', 'no apte',
]);

/** Un texto, para compararlo: sin tildes, sin mayúsculas, sin puntos y con un solo espacio entre palabras. */
function comparable(x: string): string {
  return x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

/** Si un texto es de los que se ponen en vez de una nota: una de esas marcas, o solo signos («-», «—», «?»). */
export function esMarcaSinNota(x: string): boolean {
  const c = comparable(x);
  return c !== '' && (SIN_NOTA.has(c) || !/[\p{L}\p{N}]/u.test(c));
}

/** Una fecha con su año («12/11/2026», «12-11-26», «12.11.2026»): una hoja titula así las columnas del día a día. */
const FECHA_CON_ANO = /^\d{1,2}([/.-])\d{1,2}\1\d{2,4}$/;
/** Un día y un mes con barra («12/11»). */
const DIA_Y_MES = /^(\d{1,2})\/(\d{1,2})$/;

function pareceFecha(x: string): boolean {
  const s = x.replace(/\s+/g, '');
  if (FECHA_CON_ANO.test(s)) return true;
  const m = DIA_Y_MES.exec(s);
  if (!m) return false;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  // «7/10» es también «un 7 sobre 10»: ante la duda no es un título
  return dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && !(mes === 10 && dia <= 10);
}

/** Una nota con una aclaración entre paréntesis detrás («7,5 (rec)»): es de un alumno, no un título. */
const esNotaAnotada = (x: string) => x.includes('(') && esNota(x.slice(0, x.indexOf('(')));

/**
 * Si un texto puede ser el título de una columna: lleva alguna letra («Examen T3», «1.ª ev.») o es una fecha, y no
 * es de lo que se escribe en vez de una nota. Una nota mal escrita («11», «7'5», «7+», «5-6», «7,5 (rec)») no es un
 * título: es la del primer alumno, que no entra y se señala. Tomarla por la cabecera se la llevaría sin decir nada y
 * correría una fila hacia arriba todas las demás (23-11-2026).
 */
export function puedeSerTitulo(x: string): boolean {
  return hayTexto(x) && !esMarcaSinNota(x) && !esNotaAnotada(x) && (/\p{L}/u.test(x) || pareceFecha(x));
}

/**
 * La primera fila parece la cabecera de la hoja: en las columnas que debajo traen notas no trae ninguna nota y
 * sí algún título (`puedeSerTitulo`). Un título no es lo que se escribe en vez de una nota («NP», «-», «Falta»),
 * ni una nota mal escrita, ni un texto que se repite más abajo en su columna: eso es la fila del primer alumno,
 * y tomarla por cabecera correría una fila todas las notas (23-11-2026). Las columnas de nombres no cuentan:
 * «Alumno 1» con la casilla vacía es un alumno sin nota, no una cabecera.
 */
export function pareceCabecera(filas: string[][]): boolean {
  if (filas.length < 2) return false;
  const primera = filas[0];
  const debajo = filas.slice(1);
  let hayTitulo = false;
  for (let k = 0; k < primera.length; k++) {
    const columna = debajo.map(f => f[k] ?? '');
    if (!columna.some(esNota)) continue; // una columna de nombres, o vacía
    const x = primera[k] ?? '';
    if (esNota(x)) return false;
    if (!puedeSerTitulo(x)) continue;
    const c = comparable(x);
    if (!columna.some(y => comparable(y) === c)) hayTitulo = true;
  }
  return hayTitulo;
}

/** Una columna de números enteros seguidos (3, 4, 5…), de dos filas o más. */
function esCorrelativa(columna: string[]): boolean {
  if (columna.length < 2 || !columna.every(x => /^\d+\.?$/.test(x))) return false;
  const primero = Number(columna[0].replace('.', ''));
  return primero >= 1 && columna.every((x, k) => Number(x.replace('.', '')) === primero + k);
}

/**
 * Una columna de números enteros distintos (3, 7, 12…): con los nombres justo detrás es el número de lista de un
 * listado oficial, que no tiene por qué ir seguido (un grupo partido, alumnado de otra lista).
 */
function esDeNumerosDistintos(columna: string[]): boolean {
  if (columna.length < 2 || !columna.every(x => /^\d{1,3}\.?$/.test(x))) return false;
  const nums = columna.map(x => Number(x.replace('.', '')));
  // Un número de lista va de menos a más; unas notas en enteros, casi nunca
  return nums.every((n, k) => n >= 1 && (k === 0 || n > nums[k - 1]));
}

/** El título de una columna con el número de lista («Nº», «N.º», «Núm.», «#», «Orden»). */
const TITULO_NUMERO = /^(n[º°o]?\.?|n\.?\s?[º°o]\.?|n[uú]m(ero)?\.?|#|orden|lista|n[º°o]?\s*(de\s*)?lista)$/i;
/** Títulos de columnas de texto que no son el nombre del alumno. */
const TITULO_NO_NOMBRE = /tutor|grupo|grup\b|curso|curs\b|clase|classe|unidad|nivel|nivell|sexo|sexe|g[eé]nero|g[eè]nere|repite|repetidor|observ|centro|centre|nia\b|\bid\b|expediente|expedient|dni|nif|nie\b|correo|correu|e-?mail|mail|tel[eéè]f|m[oó]vil|phone|fecha|data\b|naix|nacimiento|birth|date|edad|edat|\bage\b|optativa|religi|materia|mat[eè]ria|asignatura|assignatura|profesor|professor|teacher|familia|fam[ií]lia|padre|madre|pare\b|mare\b/i;
/** Títulos de las columnas de los apellidos y del nombre, cuando vienen separadas. */
const TITULO_APELLIDOS = /apellid|cognom|surname|last\s*name|family\s*name/i;
const TITULO_NOMBRE = /^(nom|nombre|nombres|noms|name|first\s*name|given\s*name|nom\s+de\s+pila)\.?$/i;

/** Una columna que cuenta 1, 2, 3… desde arriba (cinco filas o más): el número de lista, no una nota. */
function esNumeroDeLista(columna: string[]): boolean {
  return columna.length >= 5 && esCorrelativa(columna) && Number(columna[0].replace('.', '')) === 1;
}

/**
 * Una columna de texto sin ninguna nota: los nombres. Una columna entera de «NP» o de «-» no lo es: es una
 * actividad que nadie tiene calificada, y apartarla llevaría las notas de la siguiente a la actividad de antes.
 */
/** Si un texto lleva al menos dos letras de verdad (no «3ºA», ni una fecha, ni un teléfono). */
const dosLetras = (x: string) => (x.match(/[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]/g)?.length ?? 0) >= 2;
const esDeNombres = (columna: string[]) => !columna.some(esNota)
  && columna.some(x => hayTexto(x) && !esMarcaSinNota(x) && dosLetras(x) && !x.includes('@') && !esDato(x));

/**
 * Una columna de datos que no es ni el nombre ni una nota (24-11-2026): fechas de nacimiento, teléfonos, edades, el
 * grupo («3ºA»), correos. Va junto a los nombres en muchos listados; no se cuenta como nota ni como parte del nombre,
 * porque sus cifras decidían a qué alumno iba la fila («12 Marta»). Una columna entera de «NP» o de «-» no lo es:
 * es una actividad sin calificar y conserva su sitio.
 */
/**
 * Valores que se ven en las columnas de datos de los listados y no son un nombre: una fecha con el mes en letras, el
 * grupo («3º ESO B», «2n A»), la edad («13 años»), un DNI o NIE, «Sí», «No», el sexo o un número de teléfono.
 */
const MES = '(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|gen|febr|mai|juny|jul|ag|des|jan|apr|aug|dec)[a-z]*\\.?';
const DATO = new RegExp([
  `^\\d{1,2}[\\s./-]*(de\\s+)?${MES}[\\s./-]*(de\\s+)?\\d{2,4}$`,
  '^\\d{1,2}\\s*[ºª°]?\\s*(n|r|t|º|ª)?\\s*(eso|bach|batx|ep|pri|prim|primaria|fp|cfgm|cfgs|ei|inf)?\\.?\\s*[a-h]?$',
  '^\\d{1,2}\\s*(años|anys|years|a)\\.?$',
  '^[xyz]?-?\\d{7,8}-?[a-z]$',
  '^(s[ií]|no|yes|h|m|v|f|home|dona|hombre|mujer|var[oó]n|chico|chica|ni[ñn]o|ni[ñn]a|nen|nena|masculino|femenino|male|female|x|✓|✔|✗)$',
  '^\\+?[\\d\\s().-]{7,}$',
].join('|'), 'i');
const esDato = (x: string) => DATO.test(x.normalize('NFC').trim());

function esDeDatos(columna: string[], titulo: string | null): boolean {
  // Por el título, solo si no parece de nombres: una sola columna de nombres titulada «Lista de clase» o «Tutoría
  // 4.º B» sigue siendo la de los nombres (las de nombre con título de dato se apartan después, si queda otra)
  if (titulo !== null && TITULO_NO_NOMBRE.test(titulo) && !columna.some(esNota) && !esDeNombres(columna)) return true;
  const llenas = columna.filter(x => x !== '');
  // Casi todo son datos (fechas, grupos, edades, «Sí/No»…): una columna de datos aunque lleve letras
  if (llenas.length > 0 && !columna.some(esNota) && llenas.filter(esDato).length >= Math.max(1, Math.ceil(llenas.length * 0.8))) return true;
  if (columna.some(esNota) || columna.every(x => x === '' || esMarcaSinNota(x))) return false;
  return columna.every(x => x === '' || x.includes('@') || !dosLetras(x));
}

/**
 * Entiende lo pegado: aparta la cabecera y las columnas del principio que no son notas (el número de lista y los
 * nombres). Solo las del principio: una columna de texto en medio conserva su sitio y sus celdas se señalan, para
 * que una columna entera de «NP» no desplace a la siguiente. `cabecera` fuerza si la primera fila lo es.
 */
export function entenderPegado(filas: string[][], opciones: { cabecera?: boolean } = {}): Pegado {
  const parece = pareceCabecera(filas);
  const conCabecera = (opciones.cabecera ?? parece) && filas.length > 1;
  const cuerpo = conCabecera ? filas.slice(1) : filas;
  const ancho = filas[0]?.length ?? 0;
  const columna = (k: number) => cuerpo.map(f => f[k] ?? '');

  let primera = 0;
  let numeroDeLista = false;
  let columnaDelNumero = 0;
  const deNombre: number[] = [];
  while (primera < ancho) {
    const col = columna(primera);
    const titulo = conCabecera ? (filas[0][primera] ?? '') : null;
    // El número de lista solo si detrás queda algo: una sola columna de 1 a 5 son notas. Con los nombres justo
    // detrás lo es aunque sean pocas filas o no empiece en 1 (un grupo pequeño, la mitad de la lista): si no,
    // esos números entrarían como notas de la primera actividad y las notas irían dos columnas más allá
    const tituloNumero = conCabecera && TITULO_NUMERO.test((filas[0][primera] ?? '').trim()) && col.every(x => /^\d{1,3}\.?$/.test(x) || x === '');
    if (!numeroDeLista && deNombre.length === 0 && primera < ancho - 1
      && (tituloNumero || esNumeroDeLista(col) || ((esCorrelativa(col) || esDeNumerosDistintos(col)) && esDeNombres(columna(primera + 1))))) { numeroDeLista = true; columnaDelNumero = primera; primera++; continue; }
    // Una columna de datos entre las del principio (fecha, teléfono, grupo) se salta, si detrás quedan notas
    if (primera < ancho - 1 && esDeDatos(col, titulo)) { primera++; continue; }
    if (esDeNombres(col)) { deNombre.push(primera); primera++; continue; }
    break;
  }
  // De las columnas de texto, las que no son el nombre (el tutor, el grupo, el sexo) no cuentan para el nombre: por su
  // título o, sin cabecera, porque traen lo mismo en todas las filas
  const delNombre = deNombre.filter(k => {
    if (conCabecera && TITULO_NO_NOMBRE.test(filas[0][k] ?? '')) return false;
    const col = columna(k).filter(Boolean);
    return !(deNombre.length > 1 && col.length >= 2 && col.every(x => x === col[0]));
  });
  const usadas = delNombre.length ? delNombre : deNombre;
  // Con los apellidos y el nombre en columnas con su título, se juntan como «Apellidos, Nombre»: sin la coma, un
  // nombre que también es apellido («Martín», «Vicente») se podía leer al revés
  const deApellidos = conCabecera ? usadas.filter(k => TITULO_APELLIDOS.test(filas[0][k] ?? '')) : [];
  const deNombrePila = conCabecera ? usadas.filter(k => TITULO_NOMBRE.test((filas[0][k] ?? '').trim())) : [];
  const separadas = deApellidos.length > 0 && deNombrePila.length > 0;
  const junta = (f: string[], ks: number[]) => ks.map(k => (f[k] ?? '').replace(/,/g, ' ')).filter(Boolean).join(' ');
  // Varias columnas de nombre sin títulos que digan cuál es cuál: se separan con « | » y se prueban en los dos órdenes
  // (`parecidoDeNombres`), porque «Martín García | Lucía» puede ser Martín o Lucía
  const etiquetas = usadas.length
    ? cuerpo.map(f => (separadas ? `${junta(f, deApellidos)}, ${junta(f, deNombrePila)}`
      : usadas.map(k => (f[k] ?? '').replace(/\|/g, ' ')).filter(Boolean).join(' | ')))
    : null;
  const numeros = numeroDeLista ? cuerpo.map(f => (f[columnaDelNumero] ?? '').replace('.', '')) : null;
  return {
    celdas: cuerpo.map(f => f.slice(primera)),
    etiquetas,
    titulos: conCabecera ? filas[0].slice(primera) : null,
    cabecera: conCabecera,
    pareceCabecera: parece,
    numeroDeLista,
    numeros,
  };
}

/** Un nombre, en palabras comparables: sin tildes, sin mayúsculas y sin signos («Pérez Navarro, Lucía»). */
function palabras(nombre: string): string[] {
  return nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9ñç]+/).filter(Boolean);
}

/**
 * Si el nombre que traía la hoja puede ser el del alumno de su fila: todas las palabras del más corto están en el
 * otro, en cualquier orden («Pérez Navarro, Lucía» y «Lucía Pérez Navarro»; «Lucía» y «Lucía Pérez»). Sirve para
 * avisar con ≠ cuando se coloca por posición; por nombre se empareja con `parecidoDeNombres`.
 */
export function nombresParecidos(a: string, b: string): boolean {
  const pa = palabras(a);
  const pb = palabras(b);
  if (pa.length === 0 || pb.length === 0) return true;
  const [corto, largo] = pa.length <= pb.length ? [pa, new Set(pb)] : [pb, new Set(pa)];
  return corto.every(p => largo.has(p));
}

/* ── Emparejar por nombre ──
 * Revisado el 24-11-2026 tras un ataque con hojas reales (nombres compuestos, catalanes, listados oficiales, iniciales y
 * números de lista): «seguro» es solo lo que no deja ninguna duda, y lo demás o se marca con ≈ o no se coloca.
 */

/** Partículas que no distinguen a nadie: «de la Fuente», «Puig i Soler», «D'Amico». */
const PARTICULAS: ReadonlySet<string> = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos']);

/** Formas cortas de un nombre que no son su principio («Álex» y «Alejandro», «Pepe» y «José»). */
const APODOS: Record<string, string[]> = {
  alex: ['alejandro', 'alexandre', 'alexandra', 'alexis', 'alejandra'], dani: ['daniel', 'daniela'], fran: ['francisco', 'francesc', 'francisca'],
  pepe: ['jose'], paco: ['francisco'], nacho: ['ignacio'], lola: ['dolores'], pili: ['pilar'], javi: ['javier'], rafa: ['rafael'],
  manu: ['manuel', 'manuela'], quique: ['enrique'], kike: ['enrique'], lucho: ['luis'], toni: ['antonio', 'antoni'],
  tono: ['antonio'], merche: ['mercedes'], montse: ['montserrat'], rodri: ['rodrigo'], valen: ['valentina', 'valentin'],
  sebas: ['sebastian'], fede: ['federico'], lupe: ['guadalupe'], paqui: ['francisca'], encarni: ['encarnacion'], inma: ['inmaculada'], pau: [], jordi: [], xavi: ['xavier', 'javier'], cesc: ['francesc'], quim: ['joaquim'], pep: ['josep'], berta: ['bertha'],
  marga: ['margarita'], tere: ['teresa'], isa: ['isabel'], eli: ['elisabet', 'elisa', 'elena'],
  sole: ['soledad'], concha: ['concepcion'], charo: ['rosario'], rocio: [], nico: ['nicolas'], santi: ['santiago'], guille: ['guillermo'],
  edu: ['eduardo'], fer: ['fernando'], migue: ['miguel'], adri: ['adrian', 'adriana'], gabi: ['gabriel', 'gabriela'], sergi: ['sergio'],
};

/** Palabras que no son el nombre de nadie: con el alumnado guardado solo con su número, la fila no puede traer otras. */
const GENERICAS: ReadonlySet<string> = new Set(['alumno']);
/** «Alumna», «Alumne», «Student»: la misma palabra genérica que «Alumno» de los datos de ejemplo. */
const GENERICA: Record<string, string> = { alumna: 'alumno', alumne: 'alumno', student: 'alumno', pupil: 'alumno', estudiante: 'alumno', estudiant: 'alumno' };

/** Abreviaturas de nombres y apellidos que se ven en las listas. */
const ABREVIATURAS: Record<string, string> = {
  fco: 'francisco', fdo: 'fernando', fdez: 'fernandez', fndez: 'fernandez', glez: 'gonzalez', gzlez: 'gonzalez',
  rguez: 'rodriguez', rdguez: 'rodriguez', rodz: 'rodriguez', mtz: 'martinez', mtnez: 'martinez', hdez: 'hernandez',
  hndez: 'hernandez', sanchz: 'sanchez', mjose: 'mariajose', chema: 'josemaria', maite: 'mariateresa', mayte: 'mariateresa',
  mjesus: 'mariajesus', mcarmen: 'mariacarmen', mangeles: 'mariaangeles', maribel: 'mariaisabel', marisa: 'mariaisabel',
  fdz: 'fernandez', fz: 'fernandez', hdz: 'hernandez', jmnez: 'jimenez', jmz: 'jimenez', jimz: 'jimenez', dguez: 'dominguez',
  dgz: 'dominguez', alvz: 'alvarez', rdz: 'rodriguez', rgz: 'rodriguez', gtz: 'gutierrez', gtrrez: 'gutierrez', mrtz: 'martinez',
  sz: 'sanchez', snchz: 'sanchez', lpz: 'lopez', gcia: 'garcia', grcia: 'garcia',
};

/** Las palabras de un nombre para emparejar: sin tildes ni mayúsculas, «l·l» como «ll» y las abreviaturas desplegadas. */
function palabrasDeNombre(nombre: string): string[] {
  // Lo que va entre paréntesis o corchetes es una anotación del docente («(rep.)», «[ACIS]»), no el nombre
  let t = nombre.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/ŀl/gi, 'll').replace(/l[·•.‧∙]l/gi, 'll');
  // «D'Amico», «L'Hereu»: el apóstrofo une; la letra de delante no es la inicial de nadie
  t = t.replace(/(^|[\s,])([dl])['’´`]\s*(?=\p{L})/giu, '$1$2');
  // El grupo escrito junto al nombre («Lucía 3ºA», «3º ESO B») no es parte del nombre
  t = t.replace(/(^|\s)\d{1,2}\s*[ºª°]\s*(eso|bach|batx|ep|pri|prim|fp)?\.?\s*[a-h]?(?=\s|$)/giu, ' ');
  // «Alumno7»: la cifra pegada a la palabra va aparte
  t = t.replace(/(\p{L})(\d)/gu, '$1 $2');
  return palabras(t).map(w => GENERICA[w] ?? ABREVIATURAS[w] ?? w);
}

const esCifra = (w: string) => /^\d+$/.test(w);
/** Sin letras dobles: «Anna» y «Ana», «Marcella» y «Marcela». */
const sinDobles = (w: string) => w.replace(/(.)\1+/g, '$1');

/** Si las letras de `c` están en `l` en el mismo orden. */
function enOrden(c: string, l: string): boolean {
  let k = 0;
  for (const ch of l) if (ch === c[k]) k++;
  return k === c.length;
}

/** Si dos palabras solo se diferencian en dos letras seguidas cambiadas de sitio («Matrín» y «Martín»). */
function dosCambiadas(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const d = [...a].map((ch, i) => (ch === b[i] ? -1 : i)).filter(i => i >= 0);
  return d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]];
}

/** Si dos palabras se diferencian en una letra como mucho (una de más, una de menos o una cambiada). */
function aUnaLetra(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/**
 * Si dos palabras de un nombre son la misma: `igual`, o `parecida` si una es la inicial de la otra («P» y «Pérez»),
 * una abreviatura del principio («Ma» y «María», «Fran» y «Francisco»), cambian en las letras dobles («Anna» y «Ana»)
 * o, con cuatro letras o más, en una sola letra («Mari» y «María», «Gonzales» y «González»).
 */
function mismaPalabra(a: string, b: string): 'igual' | 'parecida' | null {
  if (a === b) return 'igual';
  const [c, l] = a.length <= b.length ? [a, b] : [b, a];
  if (c.length === 1) return l.startsWith(c) ? 'parecida' : null;
  if (c.length <= 6 && l.length >= c.length + 2 && l.startsWith(c)) return 'parecida';
  // Una abreviatura de consonantes («Hdz.», «Jmnez.»): sus letras, en orden, dentro de la palabra larga
  if (c.length <= 5 && l.length >= c.length + 3 && c[0] === l[0] && !/[aeiou]/.test(c.slice(1)) && enOrden(c, l)) return 'parecida';
  if (sinDobles(a) === sinDobles(b)) return 'parecida';
  if (APODOS[a]?.includes(b) || APODOS[b]?.includes(a)) return 'parecida';
  if (c.length >= 4 && (aUnaLetra(a, b) || dosCambiadas(a, b))) return 'parecida';
  return null;
}

/**
 * Junta en una palabra las que en el otro nombre van juntas: «San Juan» y «Sanjuán», «de la Fuente» y «Delafuente»,
 * «M. P. G.» y «MPG».
 */
function juntar(ws: string[], otras: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < ws.length; i++) {
    // Solo se juntan palabras de la misma clase: iniciales con iniciales («M. P. G.») o palabras con palabras («San
    // Juan»). Una inicial pegada a una palabra formaba otro nombre («Luis A.» era «Luisa»; «Martí N.», «Martín»)
    const mismaClase = (trozo: string[]) => trozo.every(w => w.length === 1) || trozo.every(w => w.length >= 2);
    const tres = ws.slice(i, i + 3);
    const dos = ws.slice(i, i + 2);
    if (i + 2 < ws.length && mismaClase(tres) && otras.has(tres.join('')) && !otras.has(ws[i])) { out.push(tres.join('')); i += 2; continue; }
    if (i + 1 < ws.length && mismaClase(dos) && otras.has(dos.join('')) && !otras.has(ws[i])) { out.push(dos.join('')); i += 1; continue; }
    out.push(ws[i]);
  }
  return out;
}

/** Cómo de seguro es que una fila de la hoja sea de un alumno. */
export type Parecido = 'seguro' | 'aproximado';

export interface ParecidoDeNombres {
  /** 0 si no puede ser él; más, cuanto más se parece. */
  puntos: number;
  parecido: Parecido;
  /** Si lo decide el número de lista de la hoja (que puede estar renumerada). */
  porNumero: boolean;
  /** Cuántas palabras de la hoja encajan (iguales o parecidas). */
  cubiertas: number;
  /** Las palabras de la hoja que encajan iguales, las que encajan iguales o como inicial, y todas las que encajan. */
  palabrasExactas: string[];
  palabrasCompatibles: string[];
  palabrasCubiertas: string[];
  /** Las palabras de la hoja que no encajan con este alumno. */
  palabrasSobrantes: string[];
  /** Cuántas encajan iguales y cuántas solo parecidas. */
  iguales: number;
  parecidas: number;
  /** Cuántas palabras sobran, entre la hoja y el alumno. */
  sobran: number;
  /** Todas iguales y no sobra ninguna: el mismo nombre. */
  exacto: boolean;
  /** Lo que sobra va al final (el segundo apellido que uno no escribió). */
  alFinal: boolean;
  ordenado: boolean;
  /** Si se ha leído la hoja tal cual o dándole la vuelta (sin coma, con los apellidos delante). */
  tal: boolean;
  /** Si se ha leído el nombre del alumno tal cual o dándole la vuelta. */
  alumnoTal: boolean;
}

const NADA: ParecidoDeNombres = { puntos: 0, parecido: 'aproximado', porNumero: false, cubiertas: 0, palabrasExactas: [], palabrasCompatibles: [], palabrasCubiertas: [], palabrasSobrantes: [], iguales: 0, parecidas: 0, sobran: 0, exacto: false, alFinal: false, ordenado: false, tal: true, alumnoTal: true };
/** Lo que se decide solo por números. */
const porCifras = (puntos: number, parecido: Parecido, porNumero: boolean): ParecidoDeNombres =>
  ({ puntos, parecido, porNumero, cubiertas: 1, palabrasExactas: [], palabrasCompatibles: [], palabrasCubiertas: [], palabrasSobrantes: [], iguales: 1, parecidas: 0, sobran: 0, exacto: parecido === 'seguro', alFinal: true, ordenado: true, tal: true, alumnoTal: true });

/**
 * Quita la conjunción entre apellidos («Puig i Soler», «Gil y Sanz»): en minúscula entre dos palabras, o en un
 * listado en mayúsculas, solo en la parte de los apellidos (antes de la coma). Una letra sola al final o detrás de
 * la coma es una inicial («ANA I», «José E»), no una conjunción.
 */
function sinConjunciones(nombre: string): string {
  const quitar = (parte: string, mayusculas: boolean) =>
    parte.replace(mayusculas ? /(\s)[IYE](?=\s+\p{L}{2,})/gu : /(\s)[iye](?=\s+\p{L}{2,})/gu, '$1');
  const todoMayusculas = !/\p{Ll}/u.test(nombre);
  if (!nombre.includes(',')) return todoMayusculas ? nombre : quitar(nombre, false);
  const [antes, ...despues] = nombre.split(',');
  return `${quitar(antes, todoMayusculas)},${despues.join(',')}`;
}

/** Da la vuelta a «Apellidos, Nombre». */
function sinComa(nombre: string): string {
  const limpio = sinConjunciones(nombre);
  if (!limpio.includes(',')) return limpio;
  const [antes, ...despues] = limpio.split(',');
  return `${despues.join(' ')} ${antes}`;
}

/** Compara las palabras de la hoja (en el orden natural: nombre y apellidos) con las del alumno, en su orden. */
function compararPalabras(hoja: string[], alumno: string[]): {
  iguales: number; parecidas: number; ordenado: boolean; sobranHoja: number; sobranAlumno: number; alFinal: boolean;
  exactas: string[]; compatibles: string[]; cubiertas: string[]; particulasSueltas: number; sobrantes: string[];
} | null {
  const h = juntar(hoja, new Set(alumno));
  const a = juntar(alumno, new Set(hoja));
  const parejas: [number, number][] = [];
  const usadaH = new Set<number>();
  const usadaA = new Set<number>();
  let iguales = 0;
  let parecidas = 0;
  // Primero las iguales (en orden), para que una inicial no se lleve la palabra que otra tiene entera
  h.forEach((w, i) => {
    const k = a.findIndex((x, j) => !usadaA.has(j) && x === w);
    if (k >= 0) { usadaH.add(i); usadaA.add(k); parejas.push([i, k]); if (!PARTICULAS.has(w)) iguales++; }
  });
  h.forEach((w, i) => {
    if (usadaH.has(i) || PARTICULAS.has(w)) return;
    const k = a.findIndex((x, j) => !usadaA.has(j) && !PARTICULAS.has(x) && mismaPalabra(w, x) !== null);
    if (k >= 0) { usadaH.add(i); usadaA.add(k); parejas.push([i, k]); parecidas++; }
  });
  // Una partícula de más («María del Pino» y «María Pino») no hace a otra persona, pero tampoco deja el nombre exacto
  const sueltaH = h.filter((w, i) => !usadaH.has(i) && PARTICULAS.has(w)).length;
  const sueltaA = a.filter((w, j) => !usadaA.has(j) && PARTICULAS.has(w)).length;
  const sobranHoja = h.length - usadaH.size - sueltaH;
  const sobranAlumno = a.length - usadaA.size - sueltaA;
  // Palabras de más en los dos lados («Pérez Gil» y «Pérez Navarro»): son personas distintas
  if (sobranHoja > 0 && sobranAlumno > 0) return null;
  parejas.sort((x, y) => x[0] - y[0]);
  const ordenado = parejas.every((p, k) => k === 0 || p[1] > parejas[k - 1][1]);
  // Lo que sobra solo da igual al final (el segundo apellido que uno de los dos no escribió); al principio o en
  // medio es otro nombre de pila («Ma José» y «José», «Joan Pau» y «Pau», «Ana Belén» y «Ana»)
  const ultimaH = Math.max(-1, ...parejas.map(p => p[0]));
  const ultimaA = Math.max(-1, ...parejas.map(p => p[1]));
  const alFinal = h.every((w, i) => usadaH.has(i) || PARTICULAS.has(w) || i > ultimaH) && a.every((w, j) => usadaA.has(j) || PARTICULAS.has(w) || j > ultimaA);
  const sinParticulas = parejas.filter(([i]) => !PARTICULAS.has(h[i]));
  const exactas = sinParticulas.filter(([i, k]) => h[i] === a[k]).map(([i]) => h[i]);
  // Compatibles: iguales o la inicial de la otra («V.» y «Vicente», «S.» y «Sanz»); no lo es una errata («Martín» y «Martina»)
  const compatibles = sinParticulas.filter(([i, k]) => h[i] === a[k] || h[i].length === 1 || a[k].length === 1).map(([i]) => h[i]);
  return {
    iguales, parecidas, ordenado, sobranHoja, sobranAlumno, alFinal, exactas, compatibles,
    cubiertas: sinParticulas.map(([i]) => h[i]), particulasSueltas: sueltaH + sueltaA,
    sobrantes: h.filter((w, i) => !usadaH.has(i) && !PARTICULAS.has(w)),
  };
}

/** Las formas de leer el nombre de la hoja en el orden de la app: «Apellidos, Nombre» se da la vuelta; sin coma, se prueba también con los apellidos delante. */
function ordenesDeLaHoja(letras: string[], conComa: boolean): { ws: string[]; tal: boolean }[] {
  if (conComa || letras.length < 2) return [{ ws: letras, tal: true }];
  const out = [{ ws: letras, tal: true }];
  for (let k = 1; k <= Math.min(2, letras.length - 1); k++) out.push({ ws: [...letras.slice(k), ...letras.slice(0, k)], tal: false });
  return out;
}

/**
 * Cuánto se parece el nombre de una fila de la hoja al de un alumno (`puntos` 0 si no puede ser él).
 *
 * `seguro` solo si no deja dudas: dos palabras iguales o más, ninguna solo parecida, en el mismo orden, y lo que
 * sobra (el segundo apellido que uno no escribió) va al final. Lo demás que puede ser él es `aproximado`: se marca con
 * ≈ y, si hay otro alumno posible, no se coloca. Las cifras del nombre deciden («Alumno 1» no es «Alumno 12»); el
 * número de lista de la hoja (`numero`) ayuda, pero lo que decide él es aproximado, porque una lista se renumera.
 */
export function parecidoDeNombres(hojaOriginal: string, alumno: string, numeroDeColumna?: string): ParecidoDeNombres {
  // El número de lista escrito delante del nombre en la misma celda («12. López Gil, Marta», «12 - LÓPEZ…») es un
  // número de lista como el de su columna: ayuda, pero lo que decide él se marca con ≈ (una lista se renumera)
  const delante = /^\s*(?:n[º°o]?\.?\s*|#\s*)?(\d{1,3})\s*[º°ª]?\s*[.)\-–:]*\s*(?=\p{L})/iu.exec(hojaOriginal);
  // El mismo texto que en la app, número incluido: el mismo alumno
  if (textoIgual(hojaOriginal, alumno) && palabras(alumno).length > 0) return porCifras(40, 'seguro', false);
  const hoja = delante ? hojaOriginal.slice(delante[0].length) : hojaOriginal;
  const numero = numeroDeColumna ?? (delante ? delante[1] : undefined);
  // Columnas de nombre sin título: «A | B» se lee como «A, B» y como «B, A», y solo es seguro lo que es exacto
  const columnas = hoja.split('|').map(x => x.trim()).filter(Boolean);
  if (columnas.length >= 2) {
    const formas = [`${columnas.slice(1).join(' ')}, ${columnas[0]}`, `${columnas.slice(0, -1).join(' ')}, ${columnas[columnas.length - 1]}`,
      columnas.join(' '), [...columnas].reverse().join(' ')];
    let mejor = NADA;
    for (const forma of formas) {
      const p = parecidoDeNombres(forma, alumno, numero);
      const q = p.parecido === 'seguro' && !p.exacto ? { ...p, parecido: 'aproximado' as Parecido } : p;
      if ((q.parecido === 'seguro' && mejor.parecido !== 'seguro') || (q.parecido === mejor.parecido && q.puntos > mejor.puntos)) mejor = q;
    }
    return mejor;
  }
  const conComa = hoja.includes(',');
  const wh = palabrasDeNombre(sinComa(hoja));
  // El alumno también puede estar guardado como «Apellidos, Nombre»
  const wa = palabrasDeNombre(sinComa(alumno));
  const cifrasH = wh.filter(esCifra).map(w => String(Number(w)));
  const cifrasA = wa.filter(esCifra).map(w => String(Number(w)));
  const letrasH = wh.filter(w => !esCifra(w));
  const letrasA = wa.filter(w => !esCifra(w));
  const num = numero && /^\d+$/.test(numero) ? String(Number(numero)) : null;

  // Las cifras del nombre: si los dos las llevan, tienen que coincidir
  if (cifrasH.length > 0 && cifrasA.length > 0 && !cifrasH.some(c => cifrasA.includes(c))) return NADA;
  const cifrasEnNombre = cifrasH.some(c => cifrasA.includes(c));
  const cifraDeLista = !!num && cifrasA.includes(num) && !cifrasEnNombre;
  // El número de lista de la hoja que no coincide con el del nombre del alumno no lo descarta (la lista se renumera),
  // pero lo que decida entonces el nombre se confirma
  const numeroContradice = !!num && cifrasA.length > 0 && !cifrasA.includes(num) && !cifrasEnNombre;

  // El alumno guardado solo con números («3»): basta con que la hoja los lleve
  // y no traiga otras palabras que «Alumno» («Media 2.ª ev.» no es el alumno 2)
  if (letrasA.length === 0) {
    if (!letrasH.every(w => GENERICAS.has(w))) return NADA;
    if (cifrasEnNombre && cifrasA.every(c => cifrasH.includes(c))) return porCifras(20, 'seguro', false);
    if (cifraDeLista) return porCifras(12, 'aproximado', true);
    return NADA;
  }
  // La hoja sin nombre, solo con su número de lista
  if (letrasH.length === 0) return cifraDeLista ? porCifras(12, 'aproximado', true) : NADA;

  let mejor: ParecidoDeNombres = NADA;
  // El alumno guardado con los apellidos delante y sin coma («Ruiz Gil Ana») también se lee dándole la vuelta
  const ordenesAlumno = ordenesDeLaHoja(letrasA, alumno.includes(','));
  const lecturas = ordenesDeLaHoja(letrasH, conComa).flatMap(h => ordenesAlumno.map(a => ({ ws: h.ws, wa: a.ws, tal: h.tal, alumnoTal: a.tal })));
  for (const { ws, wa: letrasDelAlumno, tal, alumnoTal } of lecturas) {
    const c = compararPalabras(ws, letrasDelAlumno);
    if (!c || c.iguales === 0) continue;
    const puntos = 10 * c.iguales + 5 * c.parecidas + (c.ordenado ? 3 : 0) + (tal ? 1 : 0) - 2 * c.sobranHoja - c.sobranAlumno
      + (cifrasEnNombre ? 8 : 0) + (cifraDeLista ? 8 : 0);
    // Dándole la vuelta al nombre del alumno, solo es seguro si no sobra nada («Ruiz Gil Ana» y «Ana Ruiz Gil»): si
    // no, «Joan Pau Ferrer» leído como «Pau Ferrer Joan» sería el «Pau Ferrer» de la hoja
    const seguro = !numeroContradice && c.parecidas === 0 && c.ordenado && c.alFinal && (c.iguales >= 2 || (c.iguales >= 1 && cifrasEnNombre))
      && (alumnoTal || c.sobranHoja + c.sobranAlumno === 0)
      // Una partícula que está en un lado y no en el otro («María del Pino» y «María Pino») se confirma
      && c.particulasSueltas === 0;
    const este: ParecidoDeNombres = {
      puntos, parecido: seguro ? 'seguro' : 'aproximado', porNumero: cifraDeLista, cubiertas: c.iguales + c.parecidas,
      palabrasExactas: c.exactas, palabrasCompatibles: c.compatibles, palabrasCubiertas: c.cubiertas, palabrasSobrantes: c.sobrantes,
      iguales: c.iguales, parecidas: c.parecidas,
      sobran: c.sobranHoja + c.sobranAlumno, exacto: seguro && c.sobranHoja + c.sobranAlumno + c.particulasSueltas === 0, alFinal: c.alFinal, ordenado: c.ordenado, tal, alumnoTal,
    };
    if ((este.parecido === 'seguro' && mejor.parecido !== 'seguro') || (este.parecido === mejor.parecido && puntos > mejor.puntos)) mejor = este;
  }
  return mejor;
}

/** Por qué una fila de la hoja no se ha colocado. */
export type MotivoSinColocar = 'nadie' | 'varios' | 'repetida';

/** A quién va cada fila de la hoja, o por qué no va a nadie. */
export type Emparejamiento =
  | { alumnoId: string; parecido: Parecido | 'a mano' }
  | { alumnoId: null; motivo: MotivoSinColocar; candidatos: string[] };

/**
 * Empareja cada fila de la hoja con un alumno por su nombre. Una fila va al alumno con el que más se parece si no
 * hay empate; si dos filas van al mismo alumno, se queda la que más se parece y la otra no se coloca (si empatan,
 * ninguna). Una fila que dudaba entre varios se resuelve si los demás ya tienen su fila. `aMano` son las que el
 * docente ha colocado él (fila → alumno): mandan sobre todo lo demás.
 */
/** Si dos nombres de la hoja son el mismo texto (sin tildes, mayúsculas ni signos). */
const mismoTexto = (a: string, b: string) => palabras(a).join(' ') === palabras(b).join(' ');
/** El mismo texto, con la coma en el mismo sitio: «Ramón, Vicente» no es «Ramón Vicente». */
const textoIgual = (a: string, b: string) => {
  const t = (x: string) => x.split(',').map(p => palabras(p).join(' ')).join(',');
  return t(a) === t(b);
};

export function emparejarPorNombre(
  etiquetas: string[], alumnado: { id: string; name: string }[], numeros: string[] | null = null, aMano: Record<number, string> = {},
): Emparejamiento[] {
  const deMano = new Set(Object.values(aMano));
  const puntos = etiquetas.map((e, f) => alumnado.map(a => (e.trim() === '' && !numeros?.[f] ? NADA : parecidoDeNombres(e, a.name, numeros?.[f]))));
  // El orden de la hoja sin coma: lo deciden las filas que encajan exactas con alguien, leídas tal cual o al revés
  let votosTal = 0;
  let votosRevés = 0;
  etiquetas.forEach((e, f) => {
    if (e.includes(',') || e.includes('|')) return;
    // Leer la hoja tal cual y el nombre del alumno al revés es lo mismo que leer la hoja al revés
    const exactos = puntos[f].filter(p => p.exacto && p.parecido === 'seguro' && palabras(e).length >= 2);
    if (exactos.some(p => p.tal === p.alumnoTal)) votosTal++;
    else if (exactos.length > 0) votosRevés++;
  });
  const ordenDeLaHoja: 'tal' | 'reves' | 'dudoso' = votosTal > votosRevés ? 'tal' : votosRevés > votosTal ? 'reves' : 'dudoso';
  const elegir = (f: number, fuera: ReadonlySet<string>): Emparejamiento => {
    if (aMano[f]) return { alumnoId: aMano[f], parecido: 'a mano' };
    const posibles = alumnado.map((a, k) => ({ id: a.id, p: puntos[f][k] })).filter(x => x.p.puntos > 0 && !fuera.has(x.id));
    if (posibles.length === 0) return { alumnoId: null, motivo: 'nadie', candidatos: [] };
    const hayLiteral = posibles.some(x => x.p.tal);
    // Otro alumno que tiene iguales todas las palabras de este y explica tantas o más de la hoja: a este le sobra algo,
    // así que no se puede saber cuál es («Lucía Pérez» en la hoja, con «Lucía Pérez Navarro» y «Lucía Pérez N.»)
    const otroExplicaMas = (x: (typeof posibles)[number]) => posibles.some(y => y.id !== x.id && y.p.cubiertas >= x.p.cubiertas
      && ((x.p.palabrasExactas.every(w => y.p.palabrasCompatibles.includes(w)) && y.p.palabrasCompatibles.length >= x.p.palabrasExactas.length)
        // o explica una palabra que a este le sobra («Martín Soler, Pablo» con «Pablo Martín» y «Pablo Martí Soler»)
        || x.p.palabrasSobrantes.some(w => y.p.palabrasCubiertas.includes(w))));
    // En una hoja sin coma, el orden de toda la hoja: si las filas que encajan exactas lo hacen leídas al revés
    // (apellidos delante), una fila leída tal cual con algo que sobra no es segura, y al revés
    const sinComaEnLaFila = !etiquetas[f].includes(',') && !etiquetas[f].includes('|');
    const contraElOrden = (x: (typeof posibles)[number]) => sinComaEnLaFila && !x.p.exacto
      && (ordenDeLaHoja === 'dudoso' ? x.p.tal !== x.p.alumnoTal : (ordenDeLaHoja === 'tal') !== (x.p.tal === x.p.alumnoTal));
    // Un «seguro» deja de serlo si otro alumno explica más palabras de la hoja (la «S.» de «Daniel Ruiz S.» es el
    // «Sanz» que al otro le sobraba), o si solo sale dándole la vuelta a la hoja y otro alumno encaja con ella tal
    // cual (sin coma, «Martín Ruiz Pablo» se lee de dos maneras)
    const seguros = posibles.filter(x => x.p.parecido === 'seguro'
      && (x.p.exacto || !otroExplicaMas(x))
      && !contraElOrden(x)
      && (x.p.tal || !hayLiteral || posibles.every(y => y.id === x.id || !y.p.tal))
      // y al revés: lo que sale leyendo la hoja tal cual no es seguro si, dándole la vuelta, sale seguro otro alumno
      && (!x.p.tal || !posibles.some(y => y.id !== x.id && y.p.parecido === 'seguro' && !y.p.tal))
      // Leyendo al revés el nombre del alumno, solo si no hay otro seguro leído tal cual («Vicente Ramón» y «Ramón Vicente»)
      && (x.p.alumnoTal || !posibles.some(y => y.id !== x.id && y.p.parecido === 'seguro' && y.p.alumnoTal)));
    if (seguros.length === 1) return { alumnoId: seguros[0].id, parecido: 'seguro' };
    if (seguros.length > 1) {
      // Dos posibles seguros: solo gana el que es el mismo nombre, sin nada que sobre
      const exactos = seguros.filter(x => x.p.exacto);
      return exactos.length === 1 ? { alumnoId: exactos[0].id, parecido: 'seguro' } : { alumnoId: null, motivo: 'varios', candidatos: seguros.map(x => x.id) };
    }
    // Sin ninguno seguro: el único posible, o el que lo decide el número de lista, o el que mejor encaja por este
    // orden (lo que sobra al final, en el mismo orden, más palabras, menos que sobran) si no empata con otro; con ≈
    if (posibles.length === 1) return { alumnoId: posibles[0].id, parecido: 'aproximado' };
    const porNumero = posibles.filter(x => x.p.porNumero);
    if (porNumero.length === 1) return { alumnoId: porNumero[0].id, parecido: 'aproximado' };
    const clave = (x: (typeof posibles)[number]) => [x.p.alFinal ? 1 : 0, x.p.ordenado ? 1 : 0, x.p.iguales, -x.p.parecidas, x.p.cubiertas, -x.p.sobran];
    const compara = (x: number[], y: number[]) => x.reduce((r, v, i) => r || v - y[i], 0);
    const orden = [...posibles].sort((x, y) => compara(clave(y), clave(x)));
    if (compara(clave(orden[0]), clave(orden[1])) > 0) return { alumnoId: orden[0].id, parecido: 'aproximado' };
    return { alumnoId: null, motivo: 'varios', candidatos: posibles.map(x => x.id) };
  };
  const res: Emparejamiento[] = etiquetas.map((_, f) => elegir(f, deMano));
  const puntosDe = (f: number, id: string) => puntos[f][alumnado.findIndex(a => a.id === id)]?.puntos ?? 0;
  // Dos filas al mismo alumno: gana la que más se parece; con empate, ninguna
  const quitarRepetidas = () => {
    const porAlumno = new Map<string, number[]>();
    res.forEach((r, f) => { if (r.alumnoId !== null && r.parecido !== 'a mano') porAlumno.set(r.alumnoId, [...(porAlumno.get(r.alumnoId) ?? []), f]); });
    for (const [id, filas] of porAlumno) {
      if (filas.length < 2) continue;
      // Gana la fila colocada como segura; entre iguales, la que más se parece
      const valor = (f: number) => ((res[f] as { parecido?: string }).parecido === 'seguro' ? 1000 : 0) + puntosDe(f, id);
      const mejor = Math.max(...filas.map(valor));
      const ganan = filas.filter(f => valor(f) === mejor);
      for (const f of filas) if (ganan.length > 1 || f !== ganan[0]) res[f] = { alumnoId: null, motivo: 'repetida', candidatos: [id] };
    }
  };
  quitarRepetidas();
  // Las que no se han colocado: se vuelve a mirar sin los alumnos que ya tienen su fila («Ana» cuando la otra Ana
  // ya tiene la suya; el mellizo al que la otra fila le quitó el sitio)
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const ocupados = new Set([...deMano, ...res.flatMap(r => (r.alumnoId !== null ? [r.alumnoId] : []))]);
    let cambio = false;
    res.forEach((r, f) => {
      if (r.alumnoId !== null || r.motivo === 'nadie') return;
      // Dos filas con el mismo nombre en la hoja: no hay forma de saber cuál es cuál, ninguna se coloca
      if (r.motivo === 'repetida' && etiquetas.some((e, g) => g !== f && mismoTexto(e, etiquetas[f]))) return;
      // Una fila repetida no vuelve a pedir el alumno que se disputaba
      const otra = elegir(f, r.motivo === 'repetida' ? new Set([...ocupados, ...r.candidatos]) : ocupados);
      if (otra.alumnoId !== null) {
        // Lo que se decide quitando a los demás se marca siempre con ≈: no se ha decidido por el nombre solo
        res[f] = { alumnoId: otra.alumnoId, parecido: 'aproximado' };
        ocupados.add(otra.alumnoId);
        cambio = true;
      }
    });
    if (!cambio) break;
    quitarRepetidas();
  }
  return res;
}

/** Una nota que se va a escribir (o a quitar, con `null`). */
export interface CambioDeNota { itemId: string; studentId: string; value: number | null }

/**
 * Qué pasaría con una celda: `nueva` (no había nota), `cambia` (pisa la que había), `igual` (ya tenía esa),
 * `vacia` (lo pegado no trae nada: no se toca) o `mal` (no es una nota de 0 a 10: no entra).
 */
export type EstadoDeCelda = 'nueva' | 'cambia' | 'igual' | 'vacia' | 'mal';

export interface CeldaDelPlan {
  /** Lo que venía escrito en lo pegado. */
  texto: string;
  estado: EstadoDeCelda;
  /** La nota que hay ahora en el cuaderno. */
  antes: number | null;
  /** La nota que quedaría (la de antes, si la celda no entra). */
  valor: number | null;
}

export interface FilaDelPlan {
  alumnoId: string;
  nombre: string;
  /** El nombre que traía la hoja en esa fila, si traía. */
  etiqueta?: string;
  /** Si ese nombre no se parece al del alumno de la fila (posible fila descolocada; solo al colocar por posición). */
  descuadra: boolean;
  /** Al colocar por nombre: si el nombre de la hoja es igual, solo se parece o lo ha elegido el docente. */
  parecido?: Parecido | 'a mano';
  /** La fila de la hoja (sin la cabecera) de la que salen estas notas. */
  fila: number;
  celdas: CeldaDelPlan[];
}

/** Una fila de la hoja que no se ha colocado al emparejar por nombre: no entra hasta que el docente diga de quién es. */
export interface FilaSinColocar {
  fila: number;
  etiqueta: string;
  motivo: MotivoSinColocar;
  /** Los alumnos con los que dudaba (o el que ya tiene otra fila). */
  candidatos: string[];
  /** Lo que trae en las columnas que se pegan. */
  textos: string[];
}

export interface PlanDePegado {
  /** `nombre`: cada fila va al alumno que se llama así; `posicion`: por orden, desde la celda donde se pega. */
  modo: 'nombre' | 'posicion';
  /** Las actividades del cuaderno que reciben algo, en orden. */
  columnas: { id: string; nombre: string; titulo?: string }[];
  filas: FilaDelPlan[];
  /** Lo que se escribiría al aplicar: solo las notas nuevas y las que cambian. */
  cambios: CambioDeNota[];
  nuevas: number;
  cambian: number;
  iguales: number;
  /** Celdas que no son una nota de 0 a 10. */
  mal: number;
  /** Filas pegadas que no caben: van más allá del último alumno. */
  filasQueSobran: number;
  /** Columnas pegadas que no caben: van más allá de la última actividad. */
  columnasQueSobran: number;
  /** Filas cuyo nombre en la hoja no se parece al del alumno (al colocar por posición). */
  descuadradas: number;
  /** Al colocar por nombre: las filas de la hoja que no van a nadie hasta que el docente lo diga. */
  sinColocar: FilaSinColocar[];
  /** Al colocar por nombre: cuántas filas se han colocado porque el nombre se parece, sin ser igual. */
  aproximadas: number;
  /** Al colocar por nombre: el alumnado de la tabla que no sale en la hoja (sus notas no se tocan). */
  noEstan: { id: string; nombre: string }[];
  /**
   * Al colocar por nombre: la mitad de las filas o más no se parecen a nadie de la clase. Puede ser la hoja de otro
   * grupo con algún nombre que coincide: la pantalla lo avisa y pide confirmar.
   */
  pareceOtroGrupo: boolean;
}

export interface DondePegar {
  /** El alumnado de la tabla, en el orden en que se ve. */
  alumnado: { id: string; name: string }[];
  /** Las actividades de la tabla donde se puede escribir, en el orden en que se ven. */
  actividades: { id: string; name: string }[];
  /** La celda sobre la que se pega. */
  alumnoId: string;
  actividadId: string;
  /** Las notas que hay ahora. */
  notas: GradeMap;
}

/**
 * El plan de pegar: qué celda del cuaderno recibe cada celda pegada. Las columnas van hacia la derecha desde la
 * actividad donde se pega. Las filas, por nombre si la hoja los trae y alguno se parece a alguien de la clase
 * (`emparejarPorNombre`); si no, hacia abajo desde el alumno donde se pega. No toca nada: es lo que enseña la
 * vista previa. `aMano` son las filas que el docente ha colocado él (fila de la hoja → alumno). Devuelve `null` si
 * la celda de partida no está en la tabla.
 */
export function planDePegado(pegado: Pegado, donde: DondePegar, aMano: Record<number, string> = {}): PlanDePegado | null {
  const f0 = donde.alumnado.findIndex(a => a.id === donde.alumnoId);
  const c0 = donde.actividades.findIndex(a => a.id === donde.actividadId);
  if (f0 < 0 || c0 < 0) return null;
  const anchoPegado = pegado.celdas[0]?.length ?? 0;
  const actividades = donde.actividades.slice(c0, c0 + anchoPegado);

  // Sin nombres, el número de lista de la hoja sirve si el alumnado de la app lo lleva en el nombre («12 Marta»)
  const etiquetas = pegado.etiquetas ?? (pegado.numeros && donde.alumnado.some(a => /\d/.test(a.name)) ? pegado.numeros.map(() => '') : null);
  const emparejadas = etiquetas ? emparejarPorNombre(etiquetas, donde.alumnado, pegado.numeros, aMano) : null;
  // Por nombre en cuanto alguna fila se parece a alguien de la clase, aunque haya que elegir a quién va; por
  // posición solo si ninguna se parece a nadie (la hoja de otro grupo, una columna que no son nombres)
  const porNombre = !!emparejadas && emparejadas.some(e => e.alumnoId !== null || e.motivo !== 'nadie');

  // Qué fila de la hoja va a qué alumno, en el orden de la lista
  let asignadas: { alumno: { id: string; name: string }; fila: number; parecido?: Parecido | 'a mano' }[];
  const sinColocar: FilaSinColocar[] = [];
  if (porNombre) {
    const deAlumno = new Map<string, { fila: number; parecido: Parecido | 'a mano' }>();
    emparejadas!.forEach((e, f) => {
      if (e.alumnoId !== null) deAlumno.set(e.alumnoId, { fila: f, parecido: e.parecido });
      else sinColocar.push({ fila: f, etiqueta: etiquetas![f] || (pegado.numeros?.[f] ? `Nº ${pegado.numeros[f]}` : ''), motivo: e.motivo, candidatos: e.candidatos, textos: pegado.celdas[f].slice(0, actividades.length) });
    });
    asignadas = donde.alumnado.filter(a => deAlumno.has(a.id)).map(a => ({ alumno: a, ...deAlumno.get(a.id)! }));
  } else {
    asignadas = donde.alumnado.slice(f0, f0 + pegado.celdas.length).map((alumno, f) => ({ alumno, fila: f }));
  }

  const plan: PlanDePegado = {
    modo: porNombre ? 'nombre' : 'posicion',
    columnas: actividades.map((a, k) => ({ id: a.id, nombre: a.name, ...(pegado.titulos?.[k] ? { titulo: pegado.titulos[k] } : {}) })),
    filas: [], cambios: [], nuevas: 0, cambian: 0, iguales: 0, mal: 0,
    filasQueSobran: porNombre ? 0 : pegado.celdas.length - asignadas.length,
    columnasQueSobran: anchoPegado - actividades.length,
    descuadradas: 0,
    sinColocar,
    aproximadas: 0,
    pareceOtroGrupo: porNombre && pegado.celdas.length >= 3 && sinColocar.filter(f => f.motivo === 'nadie').length * 2 >= pegado.celdas.length,
    noEstan: porNombre ? donde.alumnado.filter(a => !asignadas.some(x => x.alumno.id === a.id)).map(a => ({ id: a.id, nombre: a.name })) : [],
  };
  for (const { alumno, fila: f, parecido } of asignadas) {
    const etiqueta = pegado.etiquetas?.[f] || undefined;
    const descuadra = !porNombre && !!etiqueta && !nombresParecidos(etiqueta, alumno.name);
    if (descuadra) plan.descuadradas++;
    if (parecido === 'aproximado') plan.aproximadas++;
    const celdas = actividades.map((act, c): CeldaDelPlan => {
      const texto = pegado.celdas[f][c] ?? '';
      const actual = donde.notas[act.id]?.[alumno.id];
      const antes = typeof actual === 'number' ? actual : null;
      const leida = leerNota(texto);
      if (leida.tipo === 'vacia') return { texto, estado: 'vacia', antes, valor: antes };
      if (leida.tipo === 'mal') { plan.mal++; return { texto, estado: 'mal', antes, valor: antes }; }
      if (antes === leida.valor) { plan.iguales++; return { texto, estado: 'igual', antes, valor: antes }; }
      plan.cambios.push({ itemId: act.id, studentId: alumno.id, value: leida.valor });
      if (antes === null) { plan.nuevas++; return { texto, estado: 'nueva', antes, valor: leida.valor }; }
      plan.cambian++;
      return { texto, estado: 'cambia', antes, valor: leida.valor };
    });
    plan.filas.push({ alumnoId: alumno.id, nombre: alumno.name, ...(etiqueta ? { etiqueta } : {}), descuadra, ...(parecido ? { parecido } : {}), fila: f, celdas });
  }
  return plan;
}

/* ── Poner una nota a quien no tiene ── */

/** Quién no tiene nota en una actividad, en el orden de la lista. */
export function sinNota<A extends { id: string }>(alumnado: A[], notasDeActividad: Record<string, number | null> | undefined): A[] {
  return alumnado.filter(a => typeof notasDeActividad?.[a.id] !== 'number');
}

/** Los cambios de poner `valor` a quien no tiene nota en una actividad: nunca pisa una nota que ya está. */
export function cambiosDeRelleno(
  itemId: string, alumnado: { id: string }[], notasDeActividad: Record<string, number | null> | undefined, valor: number,
): CambioDeNota[] {
  return sinNota(alumnado, notasDeActividad).map(a => ({ itemId, studentId: a.id, value: valor }));
}

/** De los cambios pedidos, los que de verdad cambian algo respecto a las notas que hay. */
export function cambiosReales(cambios: CambioDeNota[], notas: GradeMap): CambioDeNota[] {
  return cambios.filter(c => (notas[c.itemId]?.[c.studentId] ?? null) !== c.value);
}

/** Las notas con los cambios puestos (sin tocar el mapa que llega). */
export function conCambios(notas: GradeMap, cambios: CambioDeNota[]): GradeMap {
  if (cambios.length === 0) return notas;
  const out: GradeMap = { ...notas };
  const copiadas = new Set<string>();
  for (const c of cambios) {
    if (!copiadas.has(c.itemId)) { out[c.itemId] = { ...(out[c.itemId] ?? {}) }; copiadas.add(c.itemId); }
    out[c.itemId][c.studentId] = c.value;
  }
  return out;
}

/** Si la pantalla se maneja con el dedo (tableta o móvil): ahí calificar en lista es más cómodo que en la tabla. */
export function pantallaTactil(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches; } catch { return false; }
}
