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
  return nums.every(n => n >= 1) && new Set(nums).size === nums.length;
}

/** Una columna que cuenta 1, 2, 3… desde arriba (cinco filas o más): el número de lista, no una nota. */
function esNumeroDeLista(columna: string[]): boolean {
  return columna.length >= 5 && esCorrelativa(columna) && Number(columna[0].replace('.', '')) === 1;
}

/**
 * Una columna de texto sin ninguna nota: los nombres. Una columna entera de «NP» o de «-» no lo es: es una
 * actividad que nadie tiene calificada, y apartarla llevaría las notas de la siguiente a la actividad de antes.
 */
const esDeNombres = (columna: string[]) => !columna.some(esNota) && columna.some(x => hayTexto(x) && !esMarcaSinNota(x));

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
  const deNombre: number[] = [];
  while (primera < ancho) {
    const col = columna(primera);
    // El número de lista solo si detrás queda algo: una sola columna de 1 a 5 son notas. Con los nombres justo
    // detrás lo es aunque sean pocas filas o no empiece en 1 (un grupo pequeño, la mitad de la lista): si no,
    // esos números entrarían como notas de la primera actividad y las notas irían dos columnas más allá
    if (!numeroDeLista && deNombre.length === 0 && primera < ancho - 1
      && (esNumeroDeLista(col) || ((esCorrelativa(col) || esDeNumerosDistintos(col)) && esDeNombres(columna(primera + 1))))) { numeroDeLista = true; primera++; continue; }
    if (esDeNombres(col)) { deNombre.push(primera); primera++; continue; }
    break;
  }
  const etiquetas = deNombre.length ? cuerpo.map(f => deNombre.map(k => f[k] ?? '').filter(Boolean).join(' ')) : null;
  const numeros = numeroDeLista ? cuerpo.map(f => (f[0] ?? '').replace('.', '')) : null;
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

/* ── Emparejar por nombre ── */

/** Las palabras de un nombre, aparte las letras y las cifras («12 Marta», «Alumno 3»). */
function partesDeNombre(nombre: string, numero?: string): { letras: string[]; cifras: string[] } {
  const ws = palabras(nombre);
  const cifras = ws.filter(w => /^\d+$/.test(w)).map(w => String(Number(w)));
  if (numero && /^\d+$/.test(numero)) cifras.push(String(Number(numero)));
  return { letras: ws.filter(w => !/^\d+$/.test(w)), cifras };
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
 * Si dos palabras de un nombre son la misma: `igual`, o `parecida` si una es la inicial de la otra («P» y «Pérez»)
 * o, en palabras de cinco letras o más, si solo cambia una letra («Ibañez» e «Ibáñez» ya son iguales sin tildes;
 * «Gonzales» y «González», parecidas).
 */
function mismaPalabra(a: string, b: string): 'igual' | 'parecida' | null {
  if (a === b) return 'igual';
  if ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b))) return 'parecida';
  if (a.length >= 5 && b.length >= 5 && aUnaLetra(a, b)) return 'parecida';
  return null;
}

/** Cómo de seguro es que una fila de la hoja sea de un alumno. */
export type Parecido = 'seguro' | 'aproximado';

/**
 * Cuánto se parece el nombre de una fila de la hoja al de un alumno: 0 si no puede ser él. Puede ser si cada palabra
 * del nombre más corto está en el otro (en cualquier orden) y, si los dos llevan cifras («Alumno 3», «12 Marta»),
 * comparten alguna. Puntúan más las palabras iguales que las parecidas, y resta un poco lo que sobra del más largo:
 * entre «Ana Ruiz» y «Ana Ruiz Mora» o «Ana Ruiz Gil», ninguno gana; entre «Ana» y «Ana Ruiz», «Ana» solo encaja
 * si no hay otra Ana. `seguro` es todo igual y con dos palabras o más (o con la cifra en común).
 */
export function parecidoDeNombres(hoja: string, alumno: string, numero?: string): { puntos: number; parecido: Parecido } {
  const a = partesDeNombre(hoja, numero);
  const b = partesDeNombre(alumno);
  const nada = { puntos: 0, parecido: 'aproximado' as Parecido };
  const cifrasEnComun = a.cifras.some(c => b.cifras.includes(c));
  const ambosConCifras = a.cifras.length > 0 && b.cifras.length > 0;
  // «Alumno 1» y «Alumno 12» no son el mismo; un número de lista que no está en el nombre de la app, en cambio, no resta
  const cifrasDelNombre = partesDeNombre(hoja).cifras;
  if (cifrasDelNombre.length > 0 && b.cifras.length > 0 && !cifrasDelNombre.some(c => b.cifras.includes(c))) return nada;
  if (a.letras.length === 0 || b.letras.length === 0) {
    return cifrasEnComun && a.letras.length === b.letras.length ? { puntos: 8, parecido: 'seguro' } : nada;
  }
  const [corto, largo] = a.letras.length <= b.letras.length ? [a.letras, b.letras] : [b.letras, a.letras];
  const libres = [...largo];
  let iguales = 0;
  let parecidas = 0;
  // Primero las iguales, para que una inicial no se lleve la palabra que otra tiene entera
  const pendientes: string[] = [];
  for (const w of corto) {
    const k = libres.indexOf(w);
    if (k >= 0) { libres.splice(k, 1); iguales++; } else pendientes.push(w);
  }
  for (const w of pendientes) {
    const k = libres.findIndex(x => mismaPalabra(w, x) !== null);
    if (k < 0) return nada;
    libres.splice(k, 1);
    parecidas++;
  }
  // Una sola palabra que solo se parece («M.» con «Marta») no basta para colocar una nota
  if (iguales === 0) return nada;
  const puntos = 10 * iguales + 5 * parecidas + (cifrasEnComun ? 8 : 0) - libres.length;
  const seguro = parecidas === 0 && (iguales >= 2 || (cifrasEnComun && ambosConCifras));
  return { puntos, parecido: seguro ? 'seguro' : 'aproximado' };
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
export function emparejarPorNombre(
  etiquetas: string[], alumnado: { id: string; name: string }[], numeros: string[] | null = null, aMano: Record<number, string> = {},
): Emparejamiento[] {
  const deMano = new Set(Object.values(aMano));
  const puntos = etiquetas.map((e, f) => alumnado.map(a => (e.trim() === '' ? { puntos: 0, parecido: 'aproximado' as Parecido } : parecidoDeNombres(e, a.name, numeros?.[f]))));
  const res: Emparejamiento[] = etiquetas.map((_, f) => {
    if (aMano[f]) return { alumnoId: aMano[f], parecido: 'a mano' };
    const libres = alumnado.map((a, k) => ({ a, p: puntos[f][k] })).filter(x => x.p.puntos > 0 && !deMano.has(x.a.id));
    if (libres.length === 0) return { alumnoId: null, motivo: 'nadie', candidatos: [] };
    const mejor = Math.max(...libres.map(x => x.p.puntos));
    const top = libres.filter(x => x.p.puntos === mejor);
    if (top.length > 1) return { alumnoId: null, motivo: 'varios', candidatos: top.map(x => x.a.id) };
    return { alumnoId: top[0].a.id, parecido: top[0].p.parecido };
  });
  const puntosDe = (f: number, id: string) => puntos[f][alumnado.findIndex(a => a.id === id)]?.puntos ?? 0;
  // Dos filas al mismo alumno: gana la que más se parece; con empate, ninguna
  const quitarRepetidas = () => {
    const porAlumno = new Map<string, number[]>();
    res.forEach((r, f) => { if (r.alumnoId !== null && r.parecido !== 'a mano') porAlumno.set(r.alumnoId, [...(porAlumno.get(r.alumnoId) ?? []), f]); });
    for (const [id, filas] of porAlumno) {
      if (filas.length < 2) continue;
      const mejor = Math.max(...filas.map(f => puntosDe(f, id)));
      const ganan = filas.filter(f => puntosDe(f, id) === mejor);
      for (const f of filas) if (ganan.length > 1 || f !== ganan[0]) res[f] = { alumnoId: null, motivo: 'repetida', candidatos: [id] };
    }
  };
  quitarRepetidas();
  // Las que dudaban entre varios: si todos menos uno ya tienen su fila, es ese (y sigue siendo aproximado)
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const ocupados = new Set(res.flatMap(r => (r.alumnoId ? [r.alumnoId] : [])));
    let cambio = false;
    res.forEach((r, f) => {
      if (r.alumnoId !== null || r.motivo !== 'varios') return;
      const quedan = r.candidatos.filter(id => !ocupados.has(id));
      if (quedan.length === 1) { res[f] = { alumnoId: quedan[0], parecido: 'aproximado' }; ocupados.add(quedan[0]); cambio = true; }
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

  const emparejadas = pegado.etiquetas ? emparejarPorNombre(pegado.etiquetas, donde.alumnado, pegado.numeros, aMano) : null;
  const porNombre = !!emparejadas && emparejadas.some(e => e.alumnoId !== null);

  // Qué fila de la hoja va a qué alumno, en el orden de la lista
  let asignadas: { alumno: { id: string; name: string }; fila: number; parecido?: Parecido | 'a mano' }[];
  const sinColocar: FilaSinColocar[] = [];
  if (porNombre) {
    const deAlumno = new Map<string, { fila: number; parecido: Parecido | 'a mano' }>();
    emparejadas!.forEach((e, f) => {
      if (e.alumnoId !== null) deAlumno.set(e.alumnoId, { fila: f, parecido: e.parecido });
      else sinColocar.push({ fila: f, etiqueta: pegado.etiquetas![f] ?? '', motivo: e.motivo, candidatos: e.candidatos, textos: pegado.celdas[f].slice(0, actividades.length) });
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
