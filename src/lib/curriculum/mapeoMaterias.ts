/**
 * Empareja la asignatura tal y como la escribió el docente al crear la clase
 * (texto libre, ver `types/index.ts: Class.subjects`) con el nombre oficial
 * de la materia en el currículo (ver `./index.ts`).
 *
 * Es una tabla de alias hecha a mano, no una IA ni una búsqueda difusa: un
 * emparejamiento equivocado aquí haría que una situación de aprendizaje de
 * «Ciencias» se generara con las competencias de otra materia, un error
 * mucho peor que no emparejar nada. Por eso, ante la duda, esta función
 * devuelve `null` en vez de arriesgar una coincidencia parcial — la
 * asignatura se queda en modo libre (como toda la app antes de esto) en vez
 * de recibir un currículo que no le corresponde.
 *
 * Un caso real que ilustra por qué no se adivina: en la ESO, «Ciencias» podría
 * ser Biología y Geología, Física y Química, o las dos a la vez según el
 * curso y el centro — no hay una única respuesta correcta, así que aquí se
 * deja sin emparejar a propósito.
 */

import { materiasDe, type CurriculumEntry, type Etapa } from './index';

function normalizar(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[.,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alias → identificadores de materia candidatos (`CurriculumEntry.id`), en
 * orden. Cada currículo tiene sus propios identificadores: en el estatal son
 * el nombre («Matemáticas»); en los autonómicos, uno estable igual en todas
 * sus lenguas («matematicas»). Se usa el primero que exista en el currículo
 * activo, así que un mismo alias puede ir a materias distintas según la
 * comunidad: «Música» es «Educación Artística» en el estatal y «Música y
 * Danza» en la Comunitat Valenciana. Un alias nunca debe poder emparejar con
 * dos materias del mismo currículo (lo comprueban las pruebas).
 *
 * Van también las formas en valenciano y catalán («Matemàtiques»), porque
 * la asignatura la escribe el docente en la lengua en que trabaja.
 */
function tabla(pares: [string[], string[]][]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [alias, ids] of pares) {
    // Sin acentos, dos alias pueden quedar iguales («matemática», «matemàtica»)
    for (const a of alias) m.set(normalizar(a), [...new Set([...(m.get(normalizar(a)) ?? []), ...ids])]);
  }
  return m;
}

const ALIAS_PRIMARIA = tabla([
  [['matematicas', 'mates', 'matemática', 'matemàtiques', 'matemàtica'], ['Matemáticas', 'matematicas']],
  [['lengua', 'lengua castellana', 'castellano', 'lengua castellana y literatura', 'llengua castellana',
    'castellà', 'llengua castellana i literatura'],
    ['Lengua Castellana y Literatura', 'lengua-castellana']],
  // Solo en el estatal: en la Comunitat Valenciana puede ser cualquiera de las dos lenguas
  [['lengua y literatura'], ['Lengua Castellana y Literatura']],
  [['valenciano', 'valencià', 'valencia', 'llengua valenciana', 'valenciano lengua y literatura',
    'valencià llengua i literatura'], ['valenciano']],
  [['ingles', 'inglés', 'anglès', 'frances', 'francés', 'francès', 'idioma extranjero', 'lengua extranjera',
    'llengua estrangera'], ['Lengua Extranjera', 'lengua-extranjera']],
  [['conocimiento del medio', 'cono', 'conocimiento del medio natural social y cultural',
    'naturales', 'sociales', 'ciencias naturales', 'ciencias sociales', 'cc naturales', 'cc sociales',
    'coneixement del medi', 'coneixement del medi natural social i cultural', 'medi',
    'ciències naturals', 'ciències socials'],
    ['Conocimiento del Medio Natural, Social y Cultural', 'conocimiento-del-medio']],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física', 'educació física'],
    ['Educación Física', 'educacion-fisica']],
  [['música', 'musica', 'música y danza', 'música i dansa'], ['musica-y-danza', 'Educación Artística']],
  [['plástica', 'plastica', 'educación plástica', 'educación plástica y visual', 'educació plàstica i visual',
    'plàstica'], ['educacion-plastica-y-visual', 'Educación Artística']],
  // Solo en el estatal, que las tiene juntas: donde van por separado, es ambigua
  [['educacion artistica', 'artistica', 'educación artística', 'plastica y musica'], ['Educación Artística']],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos', 'valores civicos y eticos',
    'valors', 'educació en valors', 'educació en valors cívics i ètics'],
    ['Educación en Valores Cívicos y Éticos', 'educacion-en-valores']],
]);

const ALIAS_ESO = tabla([
  [['biologia', 'geologia', 'biología', 'geología', 'biologia y geologia'], ['Biología y Geología']],
  [['fisica', 'quimica', 'física', 'química', 'fisica y quimica'], ['Física y Química']],
  [['geografia', 'historia', 'geografía', 'sociales', 'geografia e historia'], ['Geografía e Historia']],
  [['lengua', 'lengua castellana', 'castellano', 'lengua y literatura', 'lengua castellana y literatura'],
    ['Lengua Castellana y Literatura']],
  [['ingles', 'inglés', 'lengua extranjera', 'primera lengua extranjera'], ['Lengua Extranjera']],
  [['segunda lengua extranjera', 'frances (2a lengua)', 'francés (2ª lengua)'], ['Segunda Lengua Extranjera']],
  [['matematicas', 'mates', 'matemática'], ['Matemáticas']],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física'], ['Educación Física']],
  [['plastica', 'dibujo', 'plástica', 'educacion plastica', 'educación plástica'],
    ['Educación Plástica, Visual y Audiovisual']],
  [['musica', 'música'], ['Música']],
  [['expresion artistica', 'expresión artística'], ['Expresión Artística']],
  [['tecnologia', 'tecnología', 'tecnologia y digitalizacion'], ['Tecnología y Digitalización']],
  [['digitalizacion', 'digitalización'], ['Digitalización']],
  [['latin', 'latín'], ['Latín']],
  [['economia', 'economía', 'emprendimiento', 'economia y emprendimiento'], ['Economía y Emprendimiento']],
  [['orientacion', 'orientación', 'fop', 'formacion y orientacion personal y profesional'],
    ['Formación y Orientación Personal y Profesional']],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos', 'valores civicos y eticos'],
    ['Educación en Valores Cívicos y Éticos']],
]);

/**
 * Nombre de la materia en `materias` (el currículo activo; por defecto, el
 * estatal) con que empareja la asignatura, o `null` si no hay un alias
 * reconocido. No lanza ni avisa: quien llame decide qué hacer con un `null`
 * (normalmente, preguntar o seguir en modo libre para esa área).
 */
export function emparejarMateria(
  asignatura: string, etapa: Etapa, materias: CurriculumEntry[] = materiasDe(etapa),
): string | null {
  const n = normalizar(asignatura);
  const igual = materias.find(m => normalizar(m.nombre) === n);
  if (igual) return igual.nombre;
  for (const id of (etapa === 'primaria' ? ALIAS_PRIMARIA : ALIAS_ESO).get(n) ?? []) {
    const m = materias.find(x => x.id === id);
    if (m) return m.nombre;
  }
  return null;
}

/** Para las pruebas: cada alias de una etapa con sus identificadores candidatos. */
export function tablaDeAlias(etapa: Etapa): [string, string[]][] {
  return [...(etapa === 'primaria' ? ALIAS_PRIMARIA : ALIAS_ESO).entries()];
}
