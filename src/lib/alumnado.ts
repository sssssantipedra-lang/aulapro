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
 * Con cabecera, mandan sus columnas de nombre, apellidos y correo y lo demás
 * se ignora; sin ella, se quita lo que no es un nombre (número de lista,
 * fecha, DNI, grupo) y se une el resto.
 */
export interface FilaDeListado { name: string; email: string }

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const limpiar = (s: string) => s.replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ');
const CABECERAS_NOMBRE = new Set(['nombre', 'name', 'nom', 'first name', 'nombre de pila']);
const CABECERAS_APELLIDOS = new Set(['apellidos', 'apellido', 'cognoms', 'cognom', 'surname', 'surnames', 'last name']);
const CABECERAS_CORREO = new Set(['email', 'e-mail', 'correo', 'correu', 'correo electronico', 'mail']);
/** Una sola columna con el nombre entero. */
const CABECERAS_COMPLETO = new Set(['alumno', 'alumna', 'alumnado', 'alumno/a', 'alumne', 'alumnes', 'student', 'students',
  'nombre y apellidos', 'apellidos y nombre', 'nom i cognoms', 'cognoms i nom', 'nombre completo']);
const cabecera = (celda: string) => sinTildes(celda).replace(/[.º:]/g, '');

/** Lo que, en una columna suelta, no es parte del nombre: correo, número de lista, fecha, DNI o NIE y grupo («5ºA»). */
function noEsNombre(c: string): boolean {
  return !c || c.includes('@') || /^\d+[.ºª)]?$/.test(c) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(c)
    || /^[XYZ]?\d{7,8}[-\s]?[A-Za-z]$/i.test(c) || /^\d{1,2}\s*\.?[ºª°]?\s*[A-Za-z]$/.test(c);
}

/** «Apellidos, Nombre» pasa a «Nombre Apellidos»; lo demás se queda como está. */
function nombreDeListado(texto: string): string {
  const partes = texto.split(',').map(limpiar).filter(c => !noEsNombre(c));
  return partes.length === 2 ? `${partes[1]} ${partes[0]}` : partes.join(' ');
}

const separadorDe = (linea: string) => (linea.includes('\t') ? '\t' : linea.includes(';') ? ';' : linea.includes(',') ? ',' : null);

/** Las filas de un listado pegado: el nombre de cada alumno y su correo, si venía. */
export function leerListado(texto: string): FilaDeListado[] {
  const filas: FilaDeListado[] = [];
  let cab: { sep: string | null; nombre: number; apellidos: number; completo: number; correo: number } | null = null;
  for (const cruda of texto.split(/\r?\n/)) {
    // Los tabuladores del final son columnas vacías (un alumno sin correo): no se recortan
    const linea = cruda.replace(/^[ \u00a0]+|[ \u00a0\r]+$/g, '');
    const sep = separadorDe(linea);
    const celdas = (sep ? linea.split(sep) : [linea]).map(limpiar);
    if (!celdas.some(Boolean)) continue;

    // La cabecera solo puede ser la primera fila con texto: nombra alguna columna de nombre y no lleva datos
    if (!cab && filas.length === 0) {
      const tipos = celdas.map(cabecera);
      const hay = (lista: Set<string>) => tipos.findIndex(c => lista.has(c));
      const deNombre = hay(CABECERAS_NOMBRE) >= 0 || hay(CABECERAS_APELLIDOS) >= 0 || hay(CABECERAS_COMPLETO) >= 0;
      if (deNombre && !celdas.some(c => c.includes('@') || /\d/.test(c))) {
        cab = { sep, nombre: hay(CABECERAS_NOMBRE), apellidos: hay(CABECERAS_APELLIDOS), completo: hay(CABECERAS_COMPLETO), correo: hay(CABECERAS_CORREO) };
        continue;
      }
    }

    const email = (cab && sep === cab.sep && celdas[cab.correo]?.includes('@') ? celdas[cab.correo] : celdas.find(c => c.includes('@'))) ?? '';
    let name = '';
    // La cabecera manda en las filas que vienen con su mismo separador: solo cuentan sus columnas
    if (cab && cab.sep && sep === cab.sep) {
      const n = celdas[cab.nombre] ?? '', a = celdas[cab.apellidos] ?? '';
      if (n && a) name = `${n} ${a}`;
      else if (n || a) name = nombreDeListado(n || a);
      else if (celdas[cab.completo]) name = nombreDeListado(celdas[cab.completo]);
    }
    if (!name) {
      // Sin cabecera que valga: fuera lo que no es un nombre y, si queda una sola columna, puede ser «Apellidos, Nombre»
      const deNombre = celdas.filter(c => !noEsNombre(c));
      name = sep === ',' ? nombreDeListado(deNombre.join(', ')) : deNombre.length === 1 ? nombreDeListado(deNombre[0]) : deNombre.join(' ');
    }
    name = limpiar(name);
    if (name) filas.push({ name, email });
  }
  return filas;
}
