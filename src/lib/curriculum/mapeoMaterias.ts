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

import type { Etapa } from './index';

function normalizar(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[.,;]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alias → nombre oficial exacto (el mismo string que `CurriculumEntry.nombre`
 * en los datos). El propio nombre oficial, normalizado, es siempre un alias
 * de sí mismo: así una asignatura ya escrita igual que el decreto empareja
 * sin necesitar entrada aparte.
 */
function tabla(pares: [string[], string][]): Map<string, string> {
  const m = new Map<string, string>();
  for (const [alias, oficial] of pares) {
    m.set(normalizar(oficial), oficial);
    for (const a of alias) m.set(normalizar(a), oficial);
  }
  return m;
}

const ALIAS_PRIMARIA = tabla([
  [['matematicas', 'mates', 'matemática'], 'Matemáticas'],
  [['lengua', 'lengua castellana', 'lengua y literatura', 'castellano', 'lengua castellana y literatura'],
    'Lengua Castellana y Literatura'],
  [['ingles', 'inglés', 'frances', 'francés', 'idioma extranjero', 'lengua extranjera'],
    'Lengua Extranjera'],
  [['conocimiento del medio', 'cono', 'conocimiento del medio natural social y cultural',
    'naturales', 'sociales', 'ciencias naturales', 'ciencias sociales', 'cc naturales', 'cc sociales'],
    'Conocimiento del Medio Natural, Social y Cultural'],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física'], 'Educación Física'],
  [['plastica', 'música', 'musica', 'plástica', 'educacion artistica', 'artistica',
    'educación artística', 'plastica y musica'],
    'Educación Artística'],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos',
    'valores civicos y eticos'],
    'Educación en Valores Cívicos y Éticos'],
]);

const ALIAS_ESO = tabla([
  [['biologia', 'geologia', 'biología', 'geología', 'biologia y geologia'], 'Biología y Geología'],
  [['fisica', 'quimica', 'física', 'química', 'fisica y quimica'], 'Física y Química'],
  [['geografia', 'historia', 'geografía', 'sociales', 'geografia e historia'], 'Geografía e Historia'],
  [['lengua', 'lengua castellana', 'castellano', 'lengua y literatura', 'lengua castellana y literatura'],
    'Lengua Castellana y Literatura'],
  [['ingles', 'inglés', 'lengua extranjera', 'primera lengua extranjera'], 'Lengua Extranjera'],
  [['segunda lengua extranjera', 'frances (2a lengua)', 'francés (2ª lengua)'],
    'Segunda Lengua Extranjera'],
  [['matematicas', 'mates', 'matemática'], 'Matemáticas'],
  [['educacion fisica', 'ed fisica', 'ef', 'educación física'], 'Educación Física'],
  [['plastica', 'dibujo', 'plástica', 'educacion plastica', 'educación plástica'],
    'Educación Plástica, Visual y Audiovisual'],
  [['musica', 'música'], 'Música'],
  [['expresion artistica', 'expresión artística'], 'Expresión Artística'],
  [['tecnologia', 'tecnología', 'tecnologia y digitalizacion'], 'Tecnología y Digitalización'],
  [['digitalizacion', 'digitalización'], 'Digitalización'],
  [['latin', 'latín'], 'Latín'],
  [['economia', 'economía', 'emprendimiento', 'economia y emprendimiento'], 'Economía y Emprendimiento'],
  [['orientacion', 'orientación', 'fop', 'formacion y orientacion personal y profesional'],
    'Formación y Orientación Personal y Profesional'],
  [['valores', 'educacion en valores', 'educación en valores cívicos y éticos',
    'valores civicos y eticos'],
    'Educación en Valores Cívicos y Éticos'],
]);

/**
 * Nombre oficial de la materia, o `null` si no hay un alias reconocido para
 * esta asignatura. No lanza ni avisa: quien llame decide qué hacer con un
 * `null` (normalmente, seguir en modo libre para esa área).
 */
export function emparejarMateria(asignatura: string, etapa: Etapa): string | null {
  const tabla = etapa === 'primaria' ? ALIAS_PRIMARIA : ALIAS_ESO;
  return tabla.get(normalizar(asignatura)) ?? null;
}
