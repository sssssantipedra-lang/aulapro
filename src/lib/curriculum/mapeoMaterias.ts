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
 * Danza» en la Comunitat Valenciana; «Naturales» es Conocimiento del Medio
 * en el estatal y Ciencias de la Naturaleza en Madrid. Un alias nunca debe
 * poder emparejar con dos materias del mismo currículo (lo comprueban las
 * pruebas).
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
  [['ingles', 'inglés', 'anglès', 'idioma extranjero', 'lengua extranjera', 'llengua estrangera',
    'lengua extranjera inglés'], ['Lengua Extranjera', 'lengua-extranjera']],
  // En Madrid, la primera lengua extranjera es el inglés y el francés es la
  // segunda; en la Comunitat Valenciana podría ser cualquiera de las dos
  [['frances', 'francés', 'francès'], ['segunda-lengua-extranjera', 'Lengua Extranjera']],
  [['segunda lengua extranjera', 'segunda lengua', '2ª lengua extranjera', 'aleman', 'alemán', 'italiano',
    'portugues', 'portugués'], ['segunda-lengua-extranjera']],
  // En Madrid son dos áreas: Ciencias de la Naturaleza y Ciencias Sociales
  [['conocimiento del medio', 'cono', 'conocimiento del medio natural social y cultural',
    'coneixement del medi', 'coneixement del medi natural social i cultural', 'medi'],
    ['Conocimiento del Medio Natural, Social y Cultural', 'conocimiento-del-medio']],
  [['naturales', 'ciencias naturales', 'cc naturales', 'ciències naturals', 'ciencias de la naturaleza'],
    ['ciencias-de-la-naturaleza', 'Conocimiento del Medio Natural, Social y Cultural', 'conocimiento-del-medio']],
  [['sociales', 'ciencias sociales', 'cc sociales', 'ciències socials'],
    ['ciencias-sociales', 'Conocimiento del Medio Natural, Social y Cultural', 'conocimiento-del-medio']],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física', 'educació física'],
    ['Educación Física', 'educacion-fisica']],
  [['música', 'musica', 'música y danza', 'música i dansa'],
    ['musica-y-danza', 'Educación Artística', 'educacion-artistica']],
  [['plástica', 'plastica', 'educación plástica', 'educación plástica y visual', 'educació plàstica i visual',
    'plàstica'], ['educacion-plastica-y-visual', 'Educación Artística', 'educacion-artistica']],
  // Solo donde van juntas (el estatal y Madrid): donde van por separado, es ambigua
  [['educacion artistica', 'artistica', 'educación artística', 'plastica y musica'],
    ['Educación Artística', 'educacion-artistica']],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos', 'valores civicos y eticos',
    'valors', 'educació en valors', 'educació en valors cívics i ètics'],
    ['Educación en Valores Cívicos y Éticos', 'educacion-en-valores']],
  [['tecnologia', 'tecnología', 'robotica', 'robótica', 'tecnologia y robotica'], ['tecnologia-y-robotica']],
]);

const ALIAS_ESO = tabla([
  [['biologia', 'geologia', 'biología', 'geología', 'biologia y geologia', 'biologia i geologia'],
    ['Biología y Geología', 'biologia-y-geologia']],
  [['fisica', 'quimica', 'física', 'química', 'fisica y quimica', 'fisica i quimica'], ['Física y Química', 'fisica-y-quimica']],
  [['geografia', 'historia', 'geografía', 'sociales', 'geografia e historia', 'geografia i historia', 'història',
    'socials', 'ciencias sociales', 'ciències socials'],
    ['Geografía e Historia', 'geografia-e-historia']],
  [['lengua', 'lengua castellana', 'castellano', 'lengua castellana y literatura', 'llengua castellana', 'castellà',
    'llengua castellana i literatura'],
    ['Lengua Castellana y Literatura', 'lengua-castellana']],
  // Solo en el estatal y en Madrid: en la Comunitat Valenciana puede ser cualquiera de las dos lenguas
  [['lengua y literatura'], ['Lengua Castellana y Literatura']],
  [['valenciano', 'valencià', 'valencia', 'llengua valenciana', 'valenciano lengua y literatura',
    'valencià llengua i literatura'], ['valenciano']],
  [['ingles', 'inglés', 'lengua extranjera', 'primera lengua extranjera', 'anglès', 'llengua estrangera'],
    ['Lengua Extranjera', 'lengua-extranjera']],
  [['segunda lengua extranjera', 'frances (2a lengua)', 'francés (2ª lengua)', 'segona llengua estrangera'],
    ['Segunda Lengua Extranjera', 'segunda-lengua-extranjera']],
  [['matematicas', 'mates', 'matemática', 'matemàtiques', 'matemàtica'], ['Matemáticas', 'matematicas']],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física', 'educació física'], ['Educación Física', 'educacion-fisica']],
  [['plastica', 'dibujo', 'plástica', 'educacion plastica', 'educación plástica', 'plàstica', 'educació plàstica', 'dibuix'],
    ['Educación Plástica, Visual y Audiovisual', 'educacion-plastica-visual-y-audiovisual']],
  [['musica', 'música'], ['Música', 'musica']],
  [['expresion artistica', 'expresión artística', 'expressió artística'], ['Expresión Artística', 'expresion-artistica']],
  // En Madrid y en la Comunitat Valenciana, «Tecnología» es también una
  // materia de cuarto: ese nombre exacto empareja con ella antes de llegar aquí
  [['tecnologia', 'tecnología', 'tecnologia y digitalizacion', 'tecnologia i digitalitzacio'],
    ['Tecnología y Digitalización', 'tecnologia-y-digitalizacion']],
  [['digitalizacion', 'digitalización', 'digitalització'], ['Digitalización', 'digitalizacion']],
  [['latin', 'latín', 'llatí'], ['Latín', 'latin']],
  [['economia', 'economía', 'emprendimiento', 'economia y emprendimiento', 'economia i emprenedoria', 'emprenedoria'],
    ['Economía y Emprendimiento', 'economia-y-emprendimiento']],
  [['orientacion', 'orientación', 'fop', 'formacion y orientacion personal y profesional', 'orientació',
    'formació i orientació personal i professional'],
    ['Formación y Orientación Personal y Profesional', 'formacion-y-orientacion']],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos', 'valores civicos y eticos',
    'valors', 'educació en valors', 'educació en valors cívics i ètics'],
    ['Educación en Valores Cívicos y Éticos', 'educacion-en-valores']],
  // Materias propias de Madrid
  [['computacion', 'computación', 'ciencias de la computacion', 'informatica', 'informática'],
    ['ciencias-de-la-computacion']],
  // De Madrid y de la Comunitat Valenciana
  [['cultura clasica', 'cultura clásica', 'clasica', 'clásica', 'cultura clàssica'], ['cultura-clasica']],
  [['filosofia', 'filosofía'], ['filosofia']],
  // Materias propias de la Comunitat Valenciana
  [['artes escenicas', 'artes escénicas', 'arts escèniques'], ['artes-escenicas']],
  [['creatividad musical', 'creativitat musical'], ['creatividad-musical']],
  [['emprendimiento social', 'emprendimiento social y sostenible', 'emprenedoria social',
    'emprenedoria social i sostenible'], ['emprendimiento-social-y-sostenible']],
  [['programacion', 'programación', 'robotica', 'robótica', 'inteligencia artificial', 'programació', 'robòtica',
    'intel·ligència artificial', 'inteligencia artificial programacion y robotica',
    'intel·ligència artificial programació i robòtica'], ['programacion-ia-y-robotica']],
  [['laboratorio de artes escenicas', 'laboratorio de artes escénicas', "laboratori d'arts escèniques",
    'laboratori d’arts escèniques'], ['laboratorio-de-artes-escenicas']],
  [['laboratorio de creacion audiovisual', 'laboratorio de creación audiovisual', 'creacion audiovisual',
    'creación audiovisual', 'laboratori de creació audiovisual', 'creació audiovisual'], ['laboratorio-de-creacion-audiovisual']],
  [['taller de economia', 'taller de economía', "taller d'economia", 'taller d’economia'], ['taller-de-economia']],
  [['taller de relaciones digitales', 'relaciones digitales', 'taller de relaciones digitales responsables',
    'taller de relacions digitals', 'relacions digitals', 'taller de relacions digitals responsables'],
    ['taller-de-relaciones-digitales']],
  [['finanzas', 'finanzas y consumo responsables', 'finances', 'finances i consum responsables'],
    ['finanzas-y-consumo-responsables']],
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
