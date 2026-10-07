/**
 * Datos de ejemplo del perfil de PT y AL, para «Explorar con datos de
 * ejemplo». Todo es inventado. Las fechas se calculan desde hoy, para que
 * siempre haya sesiones recientes y objetivos del trimestre en curso. Los
 * textos van en el idioma de la aplicación (ver `i18n/demo.ts`); los
 * programas, con su nombre oficial del PAP valenciano en esa lengua.
 */
import { isoDate } from './utils';
import { ambitosDe, diaDeLaSemana, trimestreDe } from './apoyo';
import { translate, type Lang } from '../i18n/core';
import { nombreDeAlumnoDeEjemplo } from '../i18n/demo';
import type {
  AgendaVisual, AlumnoApoyo, ApoyoData, Cara, CoordinacionApoyo, GrupoApoyo, Logro, ObjetivoApoyo, ProgramaApoyo, RegistroAlumno, SesionApoyo, Trimestre,
} from '../types/apoyo';

export const DEMO_APOYO_USER = {
  full_name: 'Profesor',
  school: 'CEIP Ejemplo',
  subject: 'Pedagogía Terapéutica y Audición y Lenguaje',
};

export function buildDemoApoyo(hoy: Date = new Date(), lang: Lang = 'es'): ApoyoData {
  const tr = (s: string) => translate(lang, s);
  // Los programas del PAP de la Comunitat Valenciana (la comunidad del ejemplo), en el orden de `ambitosDe`
  const pap = ambitosDe('comunitat-valenciana', lang).ambitos.map(a => a.nombre);
  const [COM, LEC, MAT, , CON] = pap;
  const T = trimestreDe(isoDate(hoy));
  const sig = (T < 3 ? T + 1 : T) as Trimestre;
  const al = (id: string, nombre: string, clase: string, mat: number, niv: number, categorias: string[], diagnostico: string, necesidades: string): AlumnoApoyo => ({
    id, nombre, claseOrigen: clase, matricula: { etapa: 'primaria', curso: mat }, nivel: { etapa: 'primaria', curso: niv },
    categorias, diagnostico, necesidades, notas: '',
  });
  const alumnos = [
    al('demo-a1', nombreDeAlumnoDeEjemplo(1, lang), '4º B', 4, 2, ['Discapacidad intelectual'], tr('Discapacidad intelectual leve'),
      tr('Le cuesta mantener la atención más de diez minutos. Aprende mejor con apoyo visual y tareas cortas. Se motiva con los juegos.')),
    al('demo-a2', nombreDeAlumnoDeEjemplo(2, lang), '3º A', 3, 2, ['Dificultades específicas de aprendizaje (dislexia, discalculia…)', 'Trastorno por déficit de atención e hiperactividad (TDAH)'], tr('Dislexia y TDAH'),
      tr('Lectura lenta, con sustituciones de letras. Buena comprensión oral y mucho interés por los animales.')),
    al('demo-a3', nombreDeAlumnoDeEjemplo(3, lang), '2º A', 2, 1, ['Trastorno del desarrollo del lenguaje y la comunicación'], tr('Trastorno del desarrollo del lenguaje (TDL)'),
      tr('Frases cortas y vocabulario reducido. Entiende mejor con imágenes y gestos.')),
    al('demo-a4', nombreDeAlumnoDeEjemplo(4, lang), '5º A', 5, 3, ['Trastorno del espectro del autismo (TEA)', 'Discapacidad motora'], tr('TEA; hemiparesia leve en el lado derecho'),
      tr('Necesita anticipación y agenda visual. Le cuesta la interacción en grupo y la escritura a mano; muy buena memoria visual.')),
  ];
  const f = (dia: number, inicio: string, fin: string) => ({ dia, inicio, fin });
  const grupos: GrupoApoyo[] = [
    { id: 'demo-g1', nombre: tr('Lectoescritura, 2º ciclo'), especialidad: 'PT', modalidad: 'fuera', color: '#6366f1', alumnos: ['demo-a1', 'demo-a2'],
      horario: [f(0, '09:00', '09:45'), f(2, '09:00', '09:45'), f(4, '09:00', '09:45')] },
    { id: 'demo-g2', nombre: tr('Matemáticas en su aula'), especialidad: 'PT', modalidad: 'dentro', color: '#10b981', alumnos: ['demo-a1', 'demo-a4'],
      horario: [f(1, '10:00', '10:45'), f(3, '10:00', '10:45')] },
    { id: 'demo-g3', nombre: tr('Lenguaje oral'), especialidad: 'AL', modalidad: 'fuera', color: '#f59e0b', alumnos: ['demo-a3', 'demo-a4'],
      horario: [f(0, '11:30', '12:15'), f(3, '11:30', '12:15')] },
    { id: 'demo-g4', nombre: tr('Habilidades sociales'), especialidad: 'PT', modalidad: 'fuera', color: '#ec4899', alumnos: ['demo-a4', 'demo-a3'],
      horario: [f(2, '12:15', '13:00'), f(4, '12:15', '13:00')] },
  ];
  const ob = (id: string, texto: string, trimestres: Trimestre[], criterios: ObjetivoApoyo['criterios'] = []): ObjetivoApoyo =>
    ({ id, texto, trimestres: [...new Set(trimestres)].sort() as Trimestre[], criterios });
  const programas: ProgramaApoyo[] = [
    { id: 'demo-p1', alumnoId: 'demo-a1', ambito: LEC, especialidad: 'PT', intensidad: 'alta', objetivos: [
      ob('demo-o1', tr('Leer sílabas directas con fluidez'), [T], [{ materia: 'lengua-castellana', codigo: '3.1' }]),
      ob('demo-o2', tr('Segmentar palabras en sílabas'), [T, sig]),
      ob('demo-o3', tr('Leer frases sencillas comprendiendo su sentido'), [sig], [{ materia: 'lengua-castellana', codigo: '3.2' }]) ] },
    { id: 'demo-p2', alumnoId: 'demo-a1', ambito: MAT, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o5', tr('Contar y escribir números hasta el 100'), [T], [{ materia: 'matematicas', codigo: '2.4' }]),
      ob('demo-o6', tr('Sumar sin llevar con material manipulativo'), [T, sig], [{ materia: 'matematicas', codigo: '3.2' }]) ] },
    { id: 'demo-p3', alumnoId: 'demo-a2', ambito: LEC, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o8', tr('Discriminar sílabas trabadas al leer'), [T]),
      ob('demo-o9', tr('Leer un texto breve con menos sustituciones'), [1, 2, 3], [{ materia: 'lengua-castellana', codigo: '3.1' }]) ] },
    { id: 'demo-p4', alumnoId: 'demo-a3', ambito: COM, especialidad: 'AL', intensidad: 'alta', objetivos: [
      ob('demo-o11', tr('Ampliar el vocabulario de la escuela y de la casa'), [T]),
      ob('demo-o12', tr('Construir frases de sujeto, verbo y complemento'), [T, sig]),
      ob('demo-o13', tr('Narrar una secuencia de tres viñetas'), [sig]) ] },
    { id: 'demo-p5', alumnoId: 'demo-a4', ambito: COM, especialidad: 'AL', intensidad: 'media', objetivos: [
      ob('demo-o14', tr('Hacer una petición con una frase completa'), [T, sig]),
      ob('demo-o15', tr('Respetar el turno de palabra en una conversación'), [1, 2, 3]) ] },
    { id: 'demo-p6', alumnoId: 'demo-a4', ambito: CON, especialidad: 'PT', intensidad: 'media', objetivos: [
      ob('demo-o16', tr('Seguir la agenda visual de la sesión sin ayuda'), [T]),
      ob('demo-o17', tr('Aceptar un cambio de actividad anticipado'), [T, sig]) ] },
    { id: 'demo-p7', alumnoId: 'demo-a4', ambito: MAT, especialidad: 'PT', intensidad: 'baja', objetivos: [
      ob('demo-o18', tr('Resolver sumas y restas de dos cifras'), [T]) ] },
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
    'Los números hasta el 1.000', 'Sumas con llevadas', 'La familia', 'Los animales de la granja', 'Los adjetivos'].map(tr);
  const notas = ['Con tarjetas grandes aguanta más tiempo.', 'Hoy ha leído sin ayuda.', 'Se ha cansado al final de la sesión.'].map(tr).concat('');
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

  const haceDias = (n: number) => isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n));
  const coordinaciones: CoordinacionApoyo[] = [
    { id: 'demo-c1', alumnoId: 'demo-a1', fecha: haceDias(9), con: 'tutoria', asistentes: tr('Tutora de 4º B'),
      temas: tr('Cómo sigue en clase las fichas de lectura.'), acuerdos: tr('En clase, las mismas fichas con letra más grande y menos ejercicios por página.') },
    { id: 'demo-c2', alumnoId: 'demo-a4', fecha: haceDias(4), con: 'familia', asistentes: tr('Madre y padre'),
      temas: tr('Los cambios de rutina en casa y en el colegio.'), acuerdos: tr('Usar en casa la misma agenda visual de la mañana. Avisar con un día de antelación de las excursiones.') },
  ];
  const paso = (id: string, picto: string, texto: string) => ({ id, picto, texto: tr(texto) });
  const agendas: AgendaVisual[] = [
    { id: 'demo-ag1', alumnoId: 'demo-a4', titulo: tr('Mi sesión de apoyo'), pasos: [
      paso('demo-ag1-1', 'hello', 'Hola'), paso('demo-ag1-2', 'sit', 'Sentarse'), paso('demo-ag1-3', 'read-book', 'Leer'),
      paso('demo-ag1-4', 'roll-dice', 'Jugar a los dados'), paso('demo-ag1-5', 'tidy-2', 'Recoger'), paso('demo-ag1-6', 'class-room', 'Volver a clase'),
    ] },
    { id: 'demo-ag2', titulo: tr('Rutina de entrada'), pasos: [
      paso('demo-ag2-1', 'hang-coat', 'Colgar el abrigo'), paso('demo-ag2-2', 'wash-hands', 'Lavarse las manos'),
      paso('demo-ag2-3', 'circle-time', 'Asamblea'), paso('demo-ag2-4', 'calendar', 'Mirar el calendario'),
    ] },
  ];

  return { alumnos, grupos, programas, sesiones, documentos: [], coordinaciones, agendas, fotos: [] };
}
