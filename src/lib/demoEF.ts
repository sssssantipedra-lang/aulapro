/**
 * Datos de ejemplo del perfil de Educación Física, para «Explorar con datos
 * de ejemplo». Todo es inventado. Las fechas se calculan desde hoy.
 */
import { isoDate } from './utils';
import type { CalEvent, Class, GradeCategory, GradeItem, GradeMap, ScheduleBlock, Student, Task } from '../types';
import type { EfData, MarcaPrueba } from '../types/ef';
import { EF_VACIO, hacerEquipos } from './ef';

export const DEMO_EF_USER = {
  full_name: 'Profesor',
  school: 'IES Ejemplo',
  subject: 'Educación Física',
};

const EF = 'Educación Física';

const clase = (id: string, name: string, curso: number, color: string): Class => ({
  id, name, subject: EF, subjects: [EF], etapa: 'eso', curso, room: 'Pabellón', color,
  materiasOficiales: { [EF]: EF },
});

const NOMBRES: [string, 'F' | 'M'][][] = [
  [['Alumno 1', 'F'], ['Alumno 2', 'M'], ['Alumno 3', 'F'], ['Alumno 4', 'M'],
    ['Alumno 5', 'F'], ['Alumno 6', 'M'], ['Alumno 7', 'F'], ['Alumno 8', 'M']],
  [['Alumno 9', 'F'], ['Alumno 10', 'M'], ['Alumno 11', 'F'], ['Alumno 12', 'M'],
    ['Alumno 13', 'F'], ['Alumno 14', 'M'], ['Alumno 15', 'F'], ['Alumno 16', 'M']],
  [['Alumno 17', 'F'], ['Alumno 18', 'M'], ['Alumno 19', 'F'], ['Alumno 20', 'M'],
    ['Alumno 21', 'F'], ['Alumno 22', 'M'], ['Alumno 23', 'F'], ['Alumno 24', 'M']],
];

export function buildDemoEF(hoy: Date = new Date()) {
  const dias = (n: number) => isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n));
  const classes: Class[] = [
    clase('ef-c1', '1º ESO A', 1, '#0ea5e9'),
    clase('ef-c2', '1º ESO B', 1, '#10b981'),
    clase('ef-c3', '3º ESO A', 3, '#f59e0b'),
  ];
  const students: Student[] = classes.flatMap((c, i) => NOMBRES[i].map(([name], j) => ({
    id: `ef-s${i}${j}`, class_id: c.id, name, email: '', photo: null, alerts: [], notes: '',
  })));
  const sexos: EfData['sexos'] = {};
  const niveles: EfData['niveles'] = {};
  classes.forEach((_, i) => NOMBRES[i].forEach(([, sexo], j) => {
    sexos[`ef-s${i}${j}`] = sexo;
    niveles[`ef-s${i}${j}`] = ((i + j) % 3 + 1) as 1 | 2 | 3;
  }));

  const b = (id: string, day: number, inicio: string, fin: string, c: Class): ScheduleBlock =>
    ({ id, day, time_start: inicio, time_end: fin, subject: `${c.name} · ${EF}`, room: 'Pabellón', class_id: c.id, color: c.color });
  const blocks: ScheduleBlock[] = [
    b('ef-b1', 1, '08:30', '09:25', classes[0]), b('ef-b2', 1, '10:25', '11:20', classes[2]),
    b('ef-b3', 2, '09:25', '10:20', classes[1]), b('ef-b4', 3, '08:30', '09:25', classes[2]),
    b('ef-b5', 3, '11:50', '12:45', classes[0]), b('ef-b6', 4, '09:25', '10:20', classes[1]),
    b('ef-b7', 5, '08:30', '09:25', classes[0]), b('ef-b8', 5, '10:25', '11:20', classes[1]),
  ];

  const gradeCategories: GradeCategory[] = classes.flatMap(c => [
    { id: `${c.id}-g1`, class_id: c.id, name: 'Situaciones de aprendizaje', weight: 70, subject: EF },
    { id: `${c.id}-g2`, class_id: c.id, name: 'Condición física y salud', weight: 30, subject: EF },
  ]);
  const gradeItems: GradeItem[] = classes.flatMap(c => [
    { id: `${c.id}-i1`, class_id: c.id, category_id: `${c.id}-g1`, name: 'Juegos cooperativos', date: dias(-14) },
    { id: `${c.id}-i2`, class_id: c.id, category_id: `${c.id}-g2`, name: 'Plan personal de condición física', date: dias(-7) },
  ]);
  const grades: GradeMap = {};
  classes.forEach((c, i) => {
    const alumnos = students.filter(s => s.class_id === c.id);
    grades[`${c.id}-i1`] = Object.fromEntries(alumnos.map((s, j) => [s.id, 5 + ((i * 3 + j * 7) % 9) / 2]));
    grades[`${c.id}-i2`] = Object.fromEntries(alumnos.map((s, j) => [s.id, 5.5 + ((i * 5 + j * 3) % 8) / 2]));
  });

  const tasks: Task[] = [
    { id: 'ef-t1', text: 'Revisar el material de bádminton', priority: 'medium', done: false },
    { id: 'ef-t2', text: 'Reservar el autobús para la salida de orientación', priority: 'high', done: false },
  ];
  const events: CalEvent[] = [
    { id: 'ef-ev1', name: 'Salida de orientación, 3º ESO A', date: dias(9), time: '08:30', type: 'event', urgency: 'media', color: '#10b981', desc: 'Parque natural' },
    { id: 'ef-ev2', name: 'Reunión de departamento', date: dias(2), time: '14:00', type: 'meeting', urgency: 'baja', color: '#8b5cf6', desc: '' },
  ];

  // Dos tomas de dos pruebas, con una mejora creíble
  const marcas: MarcaPrueba[] = [];
  let n = 0;
  students.forEach((s, k) => {
    const base = 4 + (k % 5);
    marcas.push(
      { id: `ef-m${n++}`, pruebaId: 'course-navette', alumnoId: s.id, fecha: dias(-21), valor: base },
      { id: `ef-m${n++}`, pruebaId: 'course-navette', alumnoId: s.id, fecha: dias(-3), valor: base + (k % 3 === 0 ? 0 : 0.5 + (k % 2)) },
      { id: `ef-m${n++}`, pruebaId: 'salto-horizontal', alumnoId: s.id, fecha: dias(-21), valor: 130 + (k * 7) % 45 },
      { id: `ef-m${n++}`, pruebaId: 'salto-horizontal', alumnoId: s.id, fecha: dias(-3), valor: 133 + (k * 7) % 45 + (k % 4) * 2 },
    );
  });

  // Los equipos de 1º ESO A, hechos hace dos días (con un azar fijo, para que salgan siempre igual)
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
  const separar = [{ a: 'ef-s01', b: 'ef-s05' }];
  const equipos: EfData['equipos'] = {
    'ef-c1': { fecha: dias(-2), grupos: hacerEquipos(students.filter(s => s.class_id === 'ef-c1').map(s => s.id), 2, { niveles, sexos, separar }, { nivel: true, sexo: true, separar: true }, azar) },
  };

  const ef: EfData = {
    ...EF_VACIO,
    sexos, niveles, separar, equipos,
    exentos: [
      { id: 'ef-x1', alumnoId: 'ef-s03', limitaciones: ['correr', 'saltar'], otra: '', desde: dias(-4), hasta: dias(10),
        tarea: 'Arbitrar y anotar los resultados de su equipo.', justificante: true, motivo: 'Esguince de tobillo' },
      { id: 'ef-x2', alumnoId: 'ef-s22', limitaciones: ['esfuerzo-intenso'], otra: '', desde: dias(-30),
        tarea: 'Participa a su ritmo y descansa cuando lo necesita.', justificante: true, motivo: 'Asma' },
    ],
    marcas,
    instalaciones: [
      { id: 'ef-i1', nombre: 'Pabellón', cubierta: true, notas: 'Compartido con el colegio los martes por la tarde.' },
      { id: 'ef-i2', nombre: 'Pista exterior', cubierta: false, notas: '' },
      { id: 'ef-i3', nombre: 'Porche', cubierta: true, notas: 'Espacio reducido: juegos de poca movilidad.' },
    ],
    material: [
      { id: 'ef-mt1', nombre: 'Balones de baloncesto', cantidad: 14, estado: 'bien', ubicacion: 'Almacén del pabellón' },
      { id: 'ef-mt2', nombre: 'Raquetas de bádminton', cantidad: 20, estado: 'regular', ubicacion: 'Armario 2' },
      { id: 'ef-mt3', nombre: 'Volantes', cantidad: 12, estado: 'reponer', ubicacion: 'Armario 2' },
      { id: 'ef-mt4', nombre: 'Conos', cantidad: 40, estado: 'bien', ubicacion: 'Almacén del pabellón' },
      { id: 'ef-mt5', nombre: 'Petos de cuatro colores', cantidad: 32, estado: 'bien', ubicacion: 'Armario 1' },
    ],
    actividades: [
      { id: 'ef-a1', titulo: 'Rondo de pases 4 contra 2', tipo: 'deporte', origen: 'propia',
        descripcion: 'Cuatro jugadores en un cuadrado de 10 m se pasan el balón con la mano y dos defensores intentan tocarlo. Quien pierde el balón pasa a defender.',
        organizacion: 'Grupos de 6, un cuadrado de conos por grupo. 10 minutos.', material: 'Un balón y cuatro conos por grupo.',
        variantes: 'Pases solo con bote; tres defensores; pases con el pie.',
        inclusion: 'Quien no puede correr juega de pasador fijo en un vértice y no se le puede robar el balón.' },
    ],
    sesiones: [
      { id: 'ef-se1', titulo: 'Voleibol: el toque de dedos', claseId: 'ef-c1', fecha: dias(1), instalacionId: 'ef-i1', ia: true,
        objetivo: 'Pasar el balón con el toque de dedos a un compañero, colocando las manos en forma de triángulo por encima de la frente.',
        calentamiento: 'Pilla-pilla de movilidad (8 min): dos la paran y quien es tocado hace un ejercicio de movilidad de hombros y muñecas.\nPases por parejas atrapando (4 min): lanzar y atrapar el balón por encima de la cabeza.',
        principal: 'Toque de dedos por parejas (12 min): primero atrapando y soltando, después con un toque, contando los pases seguidos.\nVoleibol atrapa y lanza 3 contra 3 (20 min): el segundo pase de cada equipo tiene que ser de dedos.',
        calma: 'El semáforo de la sesión (5 min): cada uno se coloca según cómo le ha salido el toque de dedos.\nRecogida del material (3 min).',
        material: 'Balones de voleibol blandos, redes o cuerdas a 2 m, conos.',
        inclusion: 'No puede correr ni saltar: juega cerca de la red como colocador, con un balón de playa más lento, y sus pases valen doble.',
        planB: 'Si el pabellón está ocupado, en el porche: toque de dedos por parejas contra la pared y voleibol sentado con globo en un campo pequeño.' },
    ],
    circuitos: [
      { id: 'ef-ci1', nombre: 'Circuito de fuerza, 1º ESO', estaciones: ['Sentadillas', 'Plancha', 'Saltos a la comba', 'Abdominales', 'Fondos en el banco'],
        trabajo: 30, descanso: 15, rondas: 2, descansoRondas: 60 },
    ],
  };

  return { tasks, classes, students, blocks, events, gradeCategories, gradeItems, grades, ef };
}
