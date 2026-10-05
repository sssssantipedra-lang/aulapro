/**
 * Datos de ejemplo del perfil de PT y AL, para «Explorar con datos de
 * ejemplo». Todo es inventado. Las fechas se calculan desde hoy, para que
 * siempre haya sesiones recientes y objetivos del trimestre en curso.
 */
import { isoDate } from './utils';
import { diaDeLaSemana, trimestreDe } from './apoyo';
import type {
  AlumnoApoyo, ApoyoData, Cara, GrupoApoyo, Logro, ObjetivoApoyo, ProgramaApoyo, RegistroAlumno, SesionApoyo, Trimestre,
} from '../types/apoyo';

export const DEMO_APOYO_USER = {
  full_name: 'Laura Martí Navarro',
  school: 'CEIP Ejemplo',
  subject: 'Pedagogía Terapéutica y Audición y Lenguaje',
};

const LEC = 'Programa personalizado para el aprendizaje de la lectura y la escritura';
const MAT = 'Programa personalizado para el aprendizaje de las matemáticas';
const COM = 'Programa personalizado para la adquisición y uso funcional de la comunicación, el lenguaje y el habla';
const CON = 'Programa específico de conducta o plan terapéutico';

export function buildDemoApoyo(hoy: Date = new Date()): ApoyoData {
  const T = trimestreDe(isoDate(hoy));
  const sig = (T < 3 ? T + 1 : T) as Trimestre;
  const al = (id: string, nombre: string, clase: string, mat: number, niv: number, categorias: string[], diagnostico: string, necesidades: string): AlumnoApoyo => ({
    id, nombre, claseOrigen: clase, matricula: { etapa: 'primaria', curso: mat }, nivel: { etapa: 'primaria', curso: niv },
    categorias, diagnostico, necesidades, notas: '',
  });
  const alumnos = [
    al('demo-a1', 'Marta Gil Soler', '4º B', 4, 2, ['Discapacidad intelectual'], 'Discapacidad intelectual leve',
      'Le cuesta mantener la atención más de diez minutos. Aprende mejor con apoyo visual y tareas cortas. Se motiva con los juegos.'),
    al('demo-a2', 'Pau Ruiz Ferrer', '3º A', 3, 2, ['Dificultades específicas de aprendizaje (dislexia, discalculia…)', 'Trastorno por déficit de atención e hiperactividad (TDAH)'], 'Dislexia y TDAH',
      'Lectura lenta, con sustituciones de letras. Buena comprensión oral y mucho interés por los animales.'),
    al('demo-a3', 'Aitana López Vidal', '2º A', 2, 1, ['Trastorno del desarrollo del lenguaje y la comunicación'], 'Trastorno del desarrollo del lenguaje (TDL)',
      'Frases cortas y vocabulario reducido. Entiende mejor con imágenes y gestos.'),
    al('demo-a4', 'Hugo Sanz Moreno', '5º A', 5, 3, ['Trastorno del espectro del autismo (TEA)', 'Discapacidad motora'], 'TEA; hemiparesia leve en el lado derecho',
      'Necesita anticipación y agenda visual. Le cuesta la interacción en grupo y la escritura a mano; muy buena memoria visual.'),
  ];
  const f = (dia: number, inicio: string, fin: string) => ({ dia, inicio, fin });
  const grupos: GrupoApoyo[] = [
    { id: 'demo-g1', nombre: 'Lectoescritura, 2º ciclo', especialidad: 'PT', modalidad: 'fuera', color: '#6366f1', alumnos: ['demo-a1', 'demo-a2'],
      horario: [f(0, '09:00', '09:45'), f(2, '09:00', '09:45'), f(4, '09:00', '09:45')] },
    { id: 'demo-g2', nombre: 'Matemáticas en su aula', especialidad: 'PT', modalidad: 'dentro', color: '#10b981', alumnos: ['demo-a1', 'demo-a4'],
      horario: [f(1, '10:00', '10:45'), f(3, '10:00', '10:45')] },
    { id: 'demo-g3', nombre: 'Lenguaje oral', especialidad: 'AL', modalidad: 'fuera', color: '#f59e0b', alumnos: ['demo-a3', 'demo-a4'],
      horario: [f(0, '11:30', '12:15'), f(3, '11:30', '12:15')] },
    { id: 'demo-g4', nombre: 'Habilidades sociales', especialidad: 'PT', modalidad: 'fuera', color: '#ec4899', alumnos: ['demo-a4', 'demo-a3'],
      horario: [f(2, '12:15', '13:00'), f(4, '12:15', '13:00')] },
  ];
  const ob = (id: string, texto: string, trimestres: Trimestre[], criterios: ObjetivoApoyo['criterios'] = []): ObjetivoApoyo =>
    ({ id, texto, trimestres: [...new Set(trimestres)].sort() as Trimestre[], criterios });
  const programas: ProgramaApoyo[] = [
    { id: 'demo-p1', alumnoId: 'demo-a1', ambito: LEC, especialidad: 'PT', intensidad: 'alta', objetivos: [
      ob('demo-o1', 'Leer sílabas directas con fluidez', [T], [{ materia: 'lengua-castellana', codigo: '3.1' }]),
      ob('demo-o2', 'Segmentar palabras en sílabas', [T, sig]),
      ob('demo-o3', 'Leer frases sencillas comprendiendo su sentido', [sig], [{ materia: 'lengua-castellana', codigo: '3.2' }]) ] },
    { id: 'demo-p2', alumnoId: 'demo-a1', ambito: MAT, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o5', 'Contar y escribir números hasta el 100', [T], [{ materia: 'matematicas', codigo: '2.4' }]),
      ob('demo-o6', 'Sumar sin llevar con material manipulativo', [T, sig], [{ materia: 'matematicas', codigo: '3.2' }]) ] },
    { id: 'demo-p3', alumnoId: 'demo-a2', ambito: LEC, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o8', 'Discriminar sílabas trabadas al leer', [T]),
      ob('demo-o9', 'Leer un texto breve con menos sustituciones', [1, 2, 3], [{ materia: 'lengua-castellana', codigo: '3.1' }]) ] },
    { id: 'demo-p4', alumnoId: 'demo-a3', ambito: COM, especialidad: 'AL', intensidad: 'alta', objetivos: [
      ob('demo-o11', 'Ampliar el vocabulario de la escuela y de la casa', [T]),
      ob('demo-o12', 'Construir frases de sujeto, verbo y complemento', [T, sig]),
      ob('demo-o13', 'Narrar una secuencia de tres viñetas', [sig]) ] },
    { id: 'demo-p5', alumnoId: 'demo-a4', ambito: COM, especialidad: 'AL', intensidad: 'media', objetivos: [
      ob('demo-o14', 'Hacer una petición con una frase completa', [T, sig]),
      ob('demo-o15', 'Respetar el turno de palabra en una conversación', [1, 2, 3]) ] },
    { id: 'demo-p6', alumnoId: 'demo-a4', ambito: CON, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o16', 'Seguir la agenda visual de la sesión sin ayuda', [T]),
      ob('demo-o17', 'Aceptar un cambio de actividad anticipado', [T, sig]) ] },
    { id: 'demo-p7', alumnoId: 'demo-a4', ambito: MAT, especialidad: 'PT', intensidad: 'baja', objetivos: [
      ob('demo-o18', 'Resolver sumas y restas de dos cifras', [T]) ] },
  ];

  // Las sesiones de los diez días lectivos anteriores, con una progresión
  // creíble: al principio cuesta y al final se va consiguiendo. Cada grupo
  // trabaja los objetivos de sus ámbitos, y cada objetivo cuesta lo suyo: así
  // hay conseguidos, en proceso, uno atascado y uno sin trabajar, y el Inicio
  // enseña todos sus avisos.
  const ambitosDelGrupo: Record<string, string[]> = { 'demo-g1': [LEC], 'demo-g2': [MAT], 'demo-g3': [COM], 'demo-g4': [CON] };
  const dificultad: Record<string, number> = { 'demo-o2': 0.45, 'demo-o6': 0.35, 'demo-o8': 1, 'demo-o12': 0.4, 'demo-o17': 0.5 };
  const sinTrabajar = 'demo-o15';
  const sesiones: SesionApoyo[] = [];
  const temas = ['El abecedario y los nombres de la clase', 'Un cuento sobre el otoño', 'Las familias de palabras',
    'Los números hasta el 1.000', 'Sumas con llevadas', 'La familia', 'Los animales de la granja', 'Los adjetivos'];
  const notas = ['Con tarjetas grandes aguanta más tiempo.', 'Hoy ha leído sin ayuda.', 'Se ha cansado al final de la sesión.', ''];
  let n = 0;
  for (let atras = 14; atras >= 1; atras--) {
    const dia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - atras);
    const fecha = isoDate(dia);
    if (trimestreDe(fecha) !== T) continue;
    const ds = diaDeLaSemana(fecha);
    if (ds > 4) continue;
    for (const g of grupos.filter(x => x.horario.some(h => h.dia === ds))) {
      const avance = (14 - atras) / 14;
      const cara = (k: number): Cara => (avance + k * 0.15 > 0.5 ? 3 : 2);
      const alumnosSesion: RegistroAlumno[] = g.alumnos.map((alumnoId, i) => {
        const objs = programas
          .filter(p => p.alumnoId === alumnoId && p.especialidad === g.especialidad && ambitosDelGrupo[g.id].includes(p.ambito))
          .flatMap(p => p.objetivos.filter(o => o.trimestres.includes(T) && o.id !== sinTrabajar));
        const objetivos: Record<string, Logro> = {};
        // Dos por sesión, por turnos
        const turno = objs.length ? (n + i) % objs.length : 0;
        [...objs.slice(turno), ...objs.slice(0, turno)].slice(0, 2).forEach(o => {
          const nota = avance - (dificultad[o.id] ?? 0) + ((n + i) % 3) * 0.08;
          objetivos[o.id] = nota > 0.6 ? 'si' : nota > 0.25 ? 'proceso' : 'no';
        });
        return {
          alumnoId, objetivos,
          respuesta: { atencion: cara(i), motivacion: cara(i + 1), conducta: 3, autonomia: cara(i - 1) },
          nota: notas[(n + i) % notas.length],
        };
      });
      sesiones.push({ id: `demo-s${n}`, grupoId: g.id, fecha, temaClase: temas[n % temas.length], alumnos: alumnosSesion });
      n++;
    }
  }

  return { alumnos, grupos, programas, sesiones, documentos: [] };
}
