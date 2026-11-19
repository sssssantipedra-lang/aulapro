/**
 * El orden del alumnado, el mismo en toda la aplicación (petición del dueño,
 * 18-10-2026: «que los alumnos siempre estén en orden de lista en cualquier
 * lugar; a veces se mezclan: el 1, después el 14, después el 5…»).
 *
 * El orden de lista es el alfabético por el nombre tal como está escrito en la
 * ficha (apellidos primero, si así se escribieron), con los números como
 * números: «Alumno 2» va antes que «Alumno 10» y sin distinguir mayúsculas ni
 * tildes. Antes cada pantalla ordenaba a su manera: unas por el orden en que se
 * dieron de alta, otras alfabéticamente sin contar los números (y salía 1, 10,
 * 11, 14, 2, 5…). Quien ordene alumnado tiene que usar esto, no
 * `localeCompare` a pelo. Ver `ordenarAlumnado`, que se aplica además al
 * entregar el alumnado a las pantallas (`useAppState`).
 */

const colador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Compara dos nombres en orden de lista. */
export function compararNombres(a: string, b: string): number {
  return colador.compare(a.trim(), b.trim());
}

/** Compara dos alumnos en orden de lista; si se llaman igual, por su identificador, para que el orden no salte. */
export function compararAlumnos(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return compararNombres(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Una copia del alumnado en orden de lista. */
export function ordenarAlumnado<T extends { name: string; id: string }>(alumnado: readonly T[]): T[] {
  return [...alumnado].sort(compararAlumnos);
}

/** Los identificadores, puestos en orden de lista según el alumnado de que se disponga; los que no se conocen, al final y en su orden. */
export function idsEnOrdenDeLista(ids: readonly string[], alumnado: readonly { name: string; id: string }[]): string[] {
  const por = new Map(alumnado.map(a => [a.id, a]));
  const conocidos = ids.filter(id => por.has(id)).sort((x, y) => compararAlumnos(por.get(x)!, por.get(y)!));
  return [...conocidos, ...ids.filter(id => !por.has(id))];
}

/**
 * El nombre para saber si dos alumnos se llaman igual: sin mayúsculas, sin tildes y sin espacios de más
 * («Lucía  Pérez» y «lucia pérez» son el mismo).
 */
export const claveDeNombre = (nombre: string) =>
  nombre.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');

/**
 * Otro alumno de la misma clase que se llama igual, si lo hay. Decisión del dueño (31-10-2026): no se pueden
 * guardar dos alumnos con el mismo nombre en la misma clase; para la IA serían el mismo código y se mezclarían
 * sus datos, y para el docente, dos filas que no se distinguen. Se pide añadir el segundo apellido o una inicial.
 */
export function mismoNombreEnClase<T extends { id: string; name: string; class_id: string }>(
  nombre: string, claseId: string, alumnado: readonly T[], salvoId?: string,
): T | undefined {
  const clave = claveDeNombre(nombre);
  return alumnado.find(a => a.class_id === claseId && a.id !== salvoId && claveDeNombre(a.name) === clave);
}

/* ── Importar un listado pegado ─────────────────────────────────────────────
 * Los listados llegan de tres maneras (19-11-2026; antes solo se entendía
 * «Nombre,Email», y lo demás entraba roto): una columna de nombres, varias
 * columnas copiadas de una hoja de cálculo (separadas por tabulador o punto y
 * coma) y «Apellidos, Nombre», que es como los dan las plataformas oficiales.
 */
export interface FilaDeListado { name: string; email: string }

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const limpiar = (s: string) => s.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ');
const CABECERAS_NOMBRE = new Set(['nombre', 'name', 'nom', 'first name', 'nombre de pila']);
const CABECERAS_APELLIDOS = new Set(['apellidos', 'apellido', 'cognoms', 'cognom', 'surname', 'surnames', 'last name']);
const CABECERAS_CORREO = new Set(['email', 'e-mail', 'correo', 'correu', 'correo electronico', 'mail']);
const CABECERAS_OTRAS = new Set(['alumno', 'alumna', 'alumnado', 'alumno/a', 'alumne', 'alumnes', 'student', 'students',
  'nombre y apellidos', 'apellidos y nombre', 'apellidos, nombre', 'nom i cognoms', 'cognoms i nom', 'n', 'no', 'n.o', 'num', 'numero', 'orden', 'lista']);

/** «Apellidos, Nombre» pasa a «Nombre Apellidos»; lo demás se queda como está. */
function nombreDeListado(texto: string): string {
  const partes = texto.split(',').map(limpiar).filter(Boolean);
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : partes.join(' ');
}

/** Las filas de un listado pegado: el nombre de cada alumno y su correo, si venía. */
export function leerListado(texto: string): FilaDeListado[] {
  const filas: FilaDeListado[] = [];
  let iNombre = -1, iApellidos = -1, columnas = 0;
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea) continue;
    // Tabulador o punto y coma separan columnas. La coma, solo si alguna parte es un correo
    // (el «Nombre,Email» de siempre) o si es la cabecera; si no, es «Apellidos, Nombre».
    const porComas = linea.split(',').map(limpiar);
    const celdas = (linea.includes('\t') ? linea.split('\t') : linea.includes(';') ? linea.split(';')
      : porComas.some(c => c.includes('@')) || porComas.every(c => esCabecera(c)) ? porComas : [linea]).map(limpiar);
    if (celdas.filter(Boolean).every(esCabecera)) {
      iNombre = celdas.findIndex(c => CABECERAS_NOMBRE.has(sinTildes(c)));
      iApellidos = celdas.findIndex(c => CABECERAS_APELLIDOS.has(sinTildes(c)));
      columnas = celdas.length;
      continue;
    }
    const email = celdas.find(c => c.includes('@')) ?? '';
    let name: string;
    // La cabecera solo manda en las filas que tienen sus mismas columnas
    if (iNombre >= 0 && iApellidos >= 0 && celdas.length === columnas && celdas[iNombre] && celdas[iApellidos]) {
      name = `${celdas[iNombre]} ${celdas[iApellidos]}`;
    } else {
      // Fuera el correo, las columnas vacías y el número de lista
      const deNombre = celdas.filter(c => c && !c.includes('@') && !/^\d+[.ºª)]?$/.test(c));
      name = deNombre.length === 1 ? nombreDeListado(deNombre[0]) : deNombre.join(' ');
    }
    name = limpiar(name);
    if (name) filas.push({ name, email });
  }
  return filas;
}

function esCabecera(celda: string): boolean {
  const c = sinTildes(celda).replace(/[.º]/g, '');
  return CABECERAS_NOMBRE.has(c) || CABECERAS_APELLIDOS.has(c) || CABECERAS_CORREO.has(c) || CABECERAS_OTRAS.has(c);
}
