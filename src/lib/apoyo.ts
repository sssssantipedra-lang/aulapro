/**
 * Lógica del módulo de PT y AL, sin React. Ver `docs/PTAL.md`.
 */
import type { ComunidadId } from './curriculum/comunidades';
import type { ScheduleBlock } from '../types';
import type {
  AgendaVisual, AlumnoApoyo, ApoyoData, AspectoRespuesta, Cara, ConQuien, CoordinacionApoyo, CursoDe, DocumentoApoyo, EvaluacionObjetivo,
  Especialidad, FotoApoyo, GrupoApoyo, Logro, ObjetivoApoyo, ObjetivoOrientacion, PasoAgenda, ProgramaApoyo, RegistroAlumno, SesionApoyo, Trimestre,
} from '../types/apoyo';

export const APOYO_VACIO: ApoyoData = {
  alumnos: [], grupos: [], programas: [], sesiones: [], documentos: [], coordinaciones: [], evaluaciones: [], agendas: [], fotos: [],
};

export function nuevoIdApoyo(prefijo: string): string {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Las especialidades guardadas en el perfil; lo que no se entienda, fuera. */
export function especialidadesDePerfil(valor: unknown): Especialidad[] {
  if (!Array.isArray(valor)) return [];
  return (['PT', 'AL'] as const).filter(e => valor.includes(e));
}

/**
 * La especialidad que se escribe en el perfil de PT y AL cuando el docente no
 * ha escrito otra. Es una clave del diccionario: se traduce al guardarla.
 */
export function especialidadTexto(especialidades: readonly Especialidad[]): string {
  if (especialidades.includes('PT') && especialidades.includes('AL')) return 'Pedagogía Terapéutica y Audición y Lenguaje';
  return especialidades.includes('AL') ? 'Audición y Lenguaje' : 'Pedagogía Terapéutica';
}

/* ── Ámbitos ── */

export interface Ambito {
  nombre: string;
  /** Quién lo trabaja normalmente; el docente lo puede cambiar. */
  especialidad: Especialidad;
}

/**
 * Comunitat Valenciana: los programas personalizados del apartado D del PAP
 * (Documento 7 de la Conselleria) que lleva el profesorado de PT y AL, más la
 * ACIS. Texto literal del modelo, en sus dos lenguas, con su «personalitzat»
 * en la línea castellana de la autonomía personal.
 */
const AMBITOS_CV: Record<'es' | 'va', Ambito[]> = {
  es: [
    { nombre: 'Programa personalizado para la adquisición y uso funcional de la comunicación, el lenguaje y el habla', especialidad: 'AL' },
    { nombre: 'Programa personalizado para el aprendizaje de la lectura y la escritura', especialidad: 'PT' },
    { nombre: 'Programa personalizado para el aprendizaje de las matemáticas', especialidad: 'PT' },
    { nombre: 'Programa personalitzat para el desarrollo de la autonomía personal', especialidad: 'PT' },
    { nombre: 'Programa específico de conducta o plan terapéutico', especialidad: 'PT' },
    { nombre: 'Adaptación curricular individual significativa (ACIS)', especialidad: 'PT' },
  ],
  va: [
    { nombre: 'Programa personalitzat per a l’adquisició i ús funcional de la comunicació, el llenguatge i la parla', especialidad: 'AL' },
    { nombre: 'Programa personalitzat per a l’aprenentatge de la lectura i l’escriptura', especialidad: 'PT' },
    { nombre: 'Programa personalitzat per a l’aprenentatge de les matemàtiques', especialidad: 'PT' },
    { nombre: 'Programa personalitzat per al desenvolupament de l’autonomia personal', especialidad: 'PT' },
    { nombre: 'Programa específic de conducta o pla terapèutic', especialidad: 'PT' },
    { nombre: 'Adaptació curricular individual significativa (ACIS)', especialidad: 'PT' },
  ],
};

/** El resto de comunidades: ámbitos de partida, en castellano (se traducen al mostrarlos). */
export const AMBITOS_GENERALES: readonly Ambito[] = [
  { nombre: 'Lectoescritura', especialidad: 'PT' },
  { nombre: 'Razonamiento lógico-matemático', especialidad: 'PT' },
  { nombre: 'Atención, memoria y funciones ejecutivas', especialidad: 'PT' },
  { nombre: 'Autonomía personal', especialidad: 'PT' },
  { nombre: 'Habilidades sociales y regulación emocional', especialidad: 'PT' },
  { nombre: 'Fonética y fonología', especialidad: 'AL' },
  { nombre: 'Morfosintaxis', especialidad: 'AL' },
  { nombre: 'Semántica y vocabulario', especialidad: 'AL' },
  { nombre: 'Pragmática', especialidad: 'AL' },
  { nombre: 'Voz y fluidez', especialidad: 'AL' },
  { nombre: 'Discriminación auditiva', especialidad: 'AL' },
  { nombre: 'Conciencia fonológica', especialidad: 'AL' },
  { nombre: 'Comunicación aumentativa y alternativa', especialidad: 'AL' },
];

/**
 * Los ámbitos que se ofrecen al crear un programa. `oficial` dice si son el
 * texto literal de un modelo oficial (y no se traducen) o los de partida.
 */
export function ambitosDe(
  comunidad: ComunidadId | undefined, idiomaApp: 'es' | 'en' | 'ca',
): { oficial: boolean; ambitos: readonly Ambito[] } {
  if (comunidad === 'comunitat-valenciana') {
    return { oficial: true, ambitos: AMBITOS_CV[idiomaApp === 'ca' ? 'va' : 'es'] };
  }
  return { oficial: false, ambitos: AMBITOS_GENERALES };
}

/* ── Fechas ── */

/**
 * El trimestre de una fecha del curso, sin calendario escolar: de septiembre
 * a diciembre el 1º, de enero a marzo el 2º y de abril en adelante el 3º.
 */
export function trimestreDe(fechaIso: string): Trimestre {
  const mes = Number(fechaIso.slice(5, 7));
  if (mes >= 9) return 1;
  if (mes <= 3) return 2;
  return 3;
}

/** Día de la semana de una fecha, 0 = lunes … 6 = domingo. */
export function diaDeLaSemana(fechaIso: string): number {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** Los grupos que tienen sesión ese día, por la hora de la primera franja. */
export function gruposDelDia(grupos: readonly GrupoApoyo[], fechaIso: string): GrupoApoyo[] {
  const dia = diaDeLaSemana(fechaIso);
  const inicio = (g: GrupoApoyo) => g.horario.filter(f => f.dia === dia).map(f => f.inicio).sort()[0] ?? '';
  return grupos.filter(g => g.horario.some(f => f.dia === dia)).sort((a, b) => inicio(a).localeCompare(inicio(b)));
}

/**
 * El horario de los grupos de apoyo como bloques de la Agenda, para que el
 * especialista no tenga que apuntarlo dos veces. La Agenda cuenta los días
 * de 1 (lunes) a 5; el apoyo, de 0 a 4.
 */
export function bloquesDeApoyo(grupos: readonly GrupoApoyo[]): ScheduleBlock[] {
  return grupos.flatMap(g => g.horario.map((f, i) => ({
    id: `apoyo-${g.id}-${i}`, day: f.dia + 1, time_start: f.inicio, time_end: f.fin,
    subject: g.nombre, room: g.especialidad, class_id: '', color: g.color,
  })));
}

/** El grupo de un bloque de `bloquesDeApoyo`: su identificador va entre «apoyo-» y el número de la franja. */
export function grupoDeBloque(blockId: string): string | undefined {
  const m = /^apoyo-(.+)-\d+$/.exec(blockId);
  return m?.[1];
}

/* ── Alumnado ── */

export function alumnoVacio(): AlumnoApoyo {
  return {
    id: nuevoIdApoyo('alu'), nombre: '', claseOrigen: '',
    categorias: [], diagnostico: '', necesidades: '', notas: '',
  };
}

/**
 * Lo que se está editando en la ventana de un alumno: él, los grupos marcados
 * y, si se está creando uno en el mismo paso, el grupo nuevo (sin nombre = no
 * se crea).
 */
export interface AlumnoEnEdicion { alumno: AlumnoApoyo; grupos: string[]; grupoNuevo?: GrupoApoyo }

export const PALETA_GRUPOS = ['#6366f1', '#0284c7', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'] as const;

/** Un grupo de apoyo por rellenar: lunes de 9:00 a 9:45, fuera del aula, con el siguiente color de la paleta. */
export function grupoVacio(especialidad: Especialidad, n: number): GrupoApoyo {
  return {
    id: nuevoIdApoyo('gru'), nombre: '', especialidad, modalidad: 'fuera',
    horario: [{ dia: 0, inicio: '09:00', fin: '09:45' }], alumnos: [],
    color: PALETA_GRUPOS[n % PALETA_GRUPOS.length],
  };
}

/** El horario de un grupo sin sesiones repetidas ni vacías. */
export function horarioLimpio(horario: GrupoApoyo['horario']): GrupoApoyo['horario'] {
  const vistas = new Set<string>();
  return horario.filter(f => {
    const k = `${f.dia}|${f.inicio}|${f.fin}`;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

/** Si alguna sesión del horario acaba antes de empezar (o está sin hora). */
export function horarioIncorrecto(horario: GrupoApoyo['horario']): boolean {
  return horario.some(f => !f.inicio || !f.fin || f.fin <= f.inicio);
}

/** Para abrir la ventana con un alumno: con los grupos en los que ya está. */
export function enEdicion(a: AlumnoApoyo, d: ApoyoData): AlumnoEnEdicion {
  return { alumno: a, grupos: d.grupos.filter(g => g.alumnos.includes(a.id)).map(g => g.id) };
}

/** El curso cuyo currículo trabaja: su nivel, o el de su matrícula. */
export function nivelDe(a: AlumnoApoyo): CursoDe | undefined {
  return a.nivel ?? a.matricula;
}

/** Su nivel está por debajo del curso en que está matriculado. */
export function tieneDesfase(a: AlumnoApoyo): boolean {
  if (!a.nivel || !a.matricula) return false;
  const orden = (c: CursoDe) => (c.etapa === 'eso' ? 6 : 0) + c.curso;
  return orden(a.nivel) < orden(a.matricula);
}

/**
 * Necesidades específicas de apoyo educativo para marcar en la ficha (un
 * alumno puede tener varias). Las necesidades educativas especiales, por lo
 * que las origina (discapacidad o trastornos graves de conducta, de la
 * comunicación y del lenguaje, LOE artículo 73), y el resto de las del
 * artículo 71.2, con el TDAH y las dificultades específicas de aprendizaje
 * por separado, que es como se registran en los centros.
 */
export const GRUPOS_NEAE: readonly { titulo: string; categorias: readonly string[] }[] = [
  {
    titulo: 'Necesidades educativas especiales',
    categorias: [
      'Discapacidad intelectual',
      'Discapacidad motora',
      'Discapacidad auditiva',
      'Discapacidad visual',
      'Trastorno del espectro del autismo (TEA)',
      'Trastorno grave de conducta',
      'Trastorno grave de la comunicación y del lenguaje',
      'Pluridiscapacidad',
    ],
  },
  {
    titulo: 'Otras necesidades específicas de apoyo educativo',
    categorias: [
      'Retraso madurativo',
      'Trastorno del desarrollo del lenguaje y la comunicación',
      'Trastorno por déficit de atención e hiperactividad (TDAH)',
      'Dificultades específicas de aprendizaje (dislexia, discalculia…)',
      'Desconocimiento grave de la lengua de aprendizaje',
      'Situación de vulnerabilidad socioeducativa',
      'Altas capacidades intelectuales',
      'Incorporación tardía al sistema educativo',
      'Condiciones personales o de historia escolar',
    ],
  },
];

export const CATEGORIAS_NEAE: readonly string[] = GRUPOS_NEAE.flatMap(g => g.categorias);

/* ── Programas y sesiones ── */

/** Los objetivos de un alumno que tocan en un trimestre, de los programas de esa especialidad. */
export function objetivosDelTrimestre(
  programas: readonly ProgramaApoyo[], alumnoId: string, especialidad: Especialidad, trimestre: Trimestre,
): { programa: ProgramaApoyo; objetivo: ObjetivoApoyo }[] {
  return programas
    .filter(p => p.alumnoId === alumnoId && p.especialidad === especialidad)
    .flatMap(programa => programa.objetivos
      .filter(o => o.trimestres.includes(trimestre))
      .map(objetivo => ({ programa, objetivo })));
}

export function registroVacio(alumnoId: string): RegistroAlumno {
  return { alumnoId, objetivos: {}, respuesta: {}, nota: '' };
}

/** La sesión de un grupo en una fecha, o una nueva con su alumnado de hoy. */
export function sesionDe(
  sesiones: readonly SesionApoyo[], grupo: GrupoApoyo, fechaIso: string,
): SesionApoyo {
  const hecha = sesiones.find(s => s.grupoId === grupo.id && s.fecha === fechaIso);
  if (hecha) {
    // Un alumno que se ha añadido al grupo después también aparece
    const faltan = grupo.alumnos.filter(id => !hecha.alumnos.some(r => r.alumnoId === id));
    return faltan.length ? { ...hecha, alumnos: [...hecha.alumnos, ...faltan.map(registroVacio)] } : hecha;
  }
  return {
    id: nuevoIdApoyo('ses'), grupoId: grupo.id, fecha: fechaIso, temaClase: '',
    alumnos: grupo.alumnos.map(registroVacio),
  };
}

/** Si la sesión tiene algo anotado; una vacía no se guarda. */
export function sesionConDatos(s: SesionApoyo): boolean {
  return s.temaClase.trim() !== '' || Object.values(s.adaptaciones ?? {}).some(x => x.trim() !== '') || s.alumnos.some(r =>
    r.ausente || Object.keys(r.objetivos).length > 0 || Object.keys(r.respuesta).length > 0 || r.nota.trim() !== '');
}

export interface ResumenObjetivo {
  si: number;
  proceso: number;
  no: number;
  /** El último registro, el que dice cómo va ahora. */
  ultimo?: Logro;
}

/** Cuántas veces se ha registrado cada logro de un objetivo, en orden de fecha. */
export function resumenObjetivo(
  sesiones: readonly SesionApoyo[], alumnoId: string, objetivoId: string, trimestre?: Trimestre,
): ResumenObjetivo {
  const r: ResumenObjetivo = { si: 0, proceso: 0, no: 0 };
  [...sesiones]
    .filter(s => trimestre === undefined || trimestreDe(s.fecha) === trimestre)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .forEach(s => {
      const logro = s.alumnos.find(x => x.alumnoId === alumnoId)?.objetivos[objetivoId];
      if (!logro) return;
      r[logro] += 1;
      r.ultimo = logro;
    });
  return r;
}

export const ASPECTOS: readonly AspectoRespuesta[] = ['atencion', 'motivacion', 'conducta', 'autonomia'];

/** El nombre de cada aspecto de cómo ha respondido. Son claves del diccionario. */
export const ASPECTO_LABEL: Record<AspectoRespuesta, string> = {
  atencion: 'Atención', motivacion: 'Motivación', conducta: 'Conducta', autonomia: 'Autonomía',
};

/** Las tres caras de cómo ha ido, de mejor a peor, con su nombre (clave del diccionario). */
export const CARAS: readonly { id: Cara; cara: string; label: string }[] = [
  { id: 3, cara: '🙂', label: 'Ha ido bien' },
  { id: 2, cara: '😐', label: 'Ha ido regular' },
  { id: 1, cara: '🙁', label: 'Ha ido mal' },
];

/* ── Objetivos que vienen de la orientación ── */

const igual = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');

/** Si el objetivo de la orientación ya está en alguno de los programas del alumno. */
export function yaEstaEnPrograma(d: ApoyoData, alumnoId: string, o: ObjetivoOrientacion): boolean {
  return d.programas.some(p => p.alumnoId === alumnoId && p.objetivos.some(x => igual(x.texto, o.texto)));
}

/** Los de la orientación que aún no están en ningún programa. */
export const objetivosPendientes = (d: ApoyoData, a: AlumnoApoyo): ObjetivoOrientacion[] =>
  (a.objetivosOrientacion ?? []).filter(o => !yaEstaEnPrograma(d, a.id, o));

/** Suma objetivos a la lista de la orientación sin repetir los que ya hay (por su texto). */
export function conObjetivosOrientacion(a: AlumnoApoyo, nuevos: readonly ObjetivoOrientacion[]): AlumnoApoyo {
  const actuales = a.objetivosOrientacion ?? [];
  const de = nuevos.filter(n => n.texto.trim() && !actuales.some(x => igual(x.texto, n.texto)));
  return de.length ? { ...a, objetivosOrientacion: [...actuales, ...de.map(n => ({ ...n, texto: n.texto.trim() }))] } : a;
}

/**
 * Pasa los objetivos de la orientación a los programas del alumno: cada uno va al programa de su ámbito (se crea si
 * no existe) y conserva su origen. Los que no tienen ámbito, o ya están, se quedan donde estaban. Devuelve también
 * cuántos pasaron.
 */
export function pasarAProgramas(
  d: ApoyoData, alumnoId: string, objetivos: readonly ObjetivoOrientacion[],
  especialidadDe: (ambito: string) => Especialidad, idNuevo: (prefijo: string) => string = nuevoIdApoyo,
): { data: ApoyoData; pasados: number } {
  let programas = d.programas;
  let pasados = 0;
  for (const o of objetivos) {
    if (!o.ambito || yaEstaEnPrograma({ ...d, programas }, alumnoId, o)) continue;
    const objetivo: ObjetivoApoyo = { id: idNuevo('obj'), texto: o.texto, trimestres: o.trimestres, criterios: [], origen: o.origen };
    const existe = programas.some(p => p.alumnoId === alumnoId && p.ambito === o.ambito);
    programas = existe
      ? programas.map(p => (p.alumnoId === alumnoId && p.ambito === o.ambito ? { ...p, objetivos: [...p.objetivos, objetivo] } : p))
      : [...programas, { id: idNuevo('pro'), alumnoId, ambito: o.ambito, especialidad: especialidadDe(o.ambito), objetivos: [objetivo] }];
    pasados++;
  }
  return { data: { ...d, programas }, pasados };
}

/* ── Cierre de trimestre ── */

/** Cómo va un objetivo al cerrar el trimestre: un logro, o «sin trabajar». */
export type ResultadoObjetivo = Logro | 'sin';

/** Lo que sugiere el registro de un objetivo: lo último que se anotó, o «sin trabajar». */
export const resultadoSugerido = (r: ResumenObjetivo): ResultadoObjetivo => r.ultimo ?? 'sin';

/** La valoración del especialista de un objetivo en un trimestre, si ya cerró ese trimestre. */
export function evaluacionDe(d: ApoyoData, alumnoId: string, objetivoId: string, trimestre: Trimestre): EvaluacionObjetivo | undefined {
  return d.evaluaciones.find(e => e.alumnoId === alumnoId && e.objetivoId === objetivoId && e.trimestre === trimestre);
}

/** Una fila del cierre: el objetivo, lo que dice el registro y lo que el especialista va a dar por bueno. */
export interface FilaCierre {
  programa: ProgramaApoyo;
  objetivo: ObjetivoApoyo;
  resumen: ResumenObjetivo;
  resultado: ResultadoObjetivo;
  comentario: string;
  /** Seguir trabajándolo el trimestre siguiente. */
  seguir: boolean;
  /** Ya estaba guardada. */
  guardada: boolean;
}

/**
 * Las filas del cierre de un trimestre, una por objetivo que se trabaja en él. Si ya se cerró, lo que se
 * guardó; si no, lo que sugiere el registro. Se propone seguir con lo que está en proceso o sin conseguir
 * (y no llega al 3.º, donde ya no hay siguiente).
 */
export function filasDeCierre(d: ApoyoData, alumnoId: string, trimestre: Trimestre): FilaCierre[] {
  const sesiones = d.sesiones.filter(s => s.alumnos.some(r => r.alumnoId === alumnoId));
  return d.programas.filter(p => p.alumnoId === alumnoId).flatMap(programa => programa.objetivos
    .filter(o => o.trimestres.includes(trimestre))
    .map(objetivo => {
      const resumen = resumenObjetivo(sesiones, alumnoId, objetivo.id, trimestre);
      const previa = evaluacionDe(d, alumnoId, objetivo.id, trimestre);
      const resultado = previa?.resultado ?? resultadoSugerido(resumen);
      const siguiente = trimestre < 3 ? ((trimestre + 1) as Trimestre) : undefined;
      return {
        programa, objetivo, resumen, resultado, comentario: previa?.comentario ?? '',
        seguir: siguiente !== undefined && objetivo.trimestres.includes(siguiente)
          ? true
          : siguiente !== undefined && resultado !== 'si',
        guardada: !!previa,
      };
    }));
}

/** Si el trimestre ya está cerrado: tiene objetivos y todos tienen valoración. */
export function trimestreCerrado(d: ApoyoData, alumnoId: string, trimestre: Trimestre): boolean {
  const filas = filasDeCierre(d, alumnoId, trimestre);
  return filas.length > 0 && filas.every(f => f.guardada);
}

/**
 * Guarda el cierre de un trimestre: la valoración de cada objetivo y, en los que se siguen trabajando, el
 * trimestre siguiente en sus trimestres. Lo que no se sigue ya no se quita de ningún trimestre: solo se
 * añade, para no borrar la programación.
 */
export function cerrarTrimestre(
  d: ApoyoData, alumnoId: string, trimestre: Trimestre,
  filas: readonly { objetivoId: string; resultado: ResultadoObjetivo; comentario: string; seguir: boolean }[], hoy: string,
): ApoyoData {
  const ids = new Set(filas.map(f => f.objetivoId));
  const evaluaciones = [
    ...d.evaluaciones.filter(e => !(e.alumnoId === alumnoId && e.trimestre === trimestre && ids.has(e.objetivoId))),
    ...filas.map(f => ({ alumnoId, objetivoId: f.objetivoId, trimestre, resultado: f.resultado, comentario: f.comentario.trim(), fecha: hoy })),
  ];
  const siguiente = trimestre < 3 ? ((trimestre + 1) as Trimestre) : undefined;
  const seguir = new Set(filas.filter(f => f.seguir).map(f => f.objetivoId));
  const programas = siguiente === undefined ? d.programas : d.programas.map(p => p.alumnoId !== alumnoId ? p : {
    ...p,
    objetivos: p.objetivos.map(o => seguir.has(o.id) && !o.trimestres.includes(siguiente)
      ? { ...o, trimestres: [...o.trimestres, siguiente].sort() as Trimestre[] } : o),
  });
  return { ...d, evaluaciones, programas };
}

export interface DatosTrimestre {
  /** Sesiones de sus grupos en que tiene registro, y en cuántas no vino. */
  sesiones: number;
  ausencias: number;
  /** Cada objetivo del trimestre, con su programa y cómo ha ido. */
  objetivos: { programa: ProgramaApoyo; objetivo: ObjetivoApoyo; resumen: ResumenObjetivo; evaluacion?: EvaluacionObjetivo }[];
  /** Media de cada aspecto de 1 a 3 y en cuántas sesiones se anotó. */
  respuesta: Record<AspectoRespuesta, { media: number | null; veces: number }>;
  /** Las notas del docente, con su fecha, de la más antigua a la más reciente. */
  notas: { fecha: string; texto: string }[];
  /** Lo que trabajaba su clase en cada sesión. */
  temas: { fecha: string; texto: string }[];
  /** Las coordinaciones del trimestre sobre el alumno, por orden de fecha. */
  coordinaciones: CoordinacionApoyo[];
}

/** Con quién es cada coordinación. Son claves del diccionario. */
export const CON_QUIEN: Record<ConQuien, string> = {
  tutoria: 'Tutoría', familia: 'Familia', orientacion: 'Orientación', equipo: 'Equipo docente', otros: 'Otros',
};

/** Las coordinaciones sobre un alumno, por orden de fecha; con trimestre, solo las de ese trimestre. */
export function coordinacionesDe(d: ApoyoData, alumnoId: string, trimestre?: Trimestre): CoordinacionApoyo[] {
  return d.coordinaciones
    .filter(c => c.alumnoId === alumnoId && (trimestre === undefined || (c.fecha !== '' && trimestreDe(c.fecha) === trimestre)))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Lo que dice el registro de un alumno en un trimestre: los datos que la IA solo redacta. */
export function datosDelTrimestre(d: ApoyoData, alumnoId: string, trimestre: Trimestre): DatosTrimestre {
  const sesiones = d.sesiones
    .filter(s => trimestreDe(s.fecha) === trimestre && s.alumnos.some(r => r.alumnoId === alumnoId))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const registros = sesiones.map(s => ({ s, r: s.alumnos.find(r => r.alumnoId === alumnoId)! }));
  const respuesta = {} as DatosTrimestre['respuesta'];
  for (const a of ASPECTOS) {
    const valores = registros.map(x => x.r.respuesta[a]).filter((v): v is Cara => v !== undefined);
    respuesta[a] = {
      media: valores.length ? Math.round((valores.reduce((n, v) => n + v, 0) / valores.length) * 10) / 10 : null,
      veces: valores.length,
    };
  }
  return {
    sesiones: registros.length,
    ausencias: registros.filter(x => x.r.ausente).length,
    objetivos: d.programas
      .filter(p => p.alumnoId === alumnoId)
      .flatMap(programa => programa.objetivos
        .filter(o => o.trimestres.includes(trimestre))
        .map(objetivo => ({
          programa, objetivo, resumen: resumenObjetivo(sesiones, alumnoId, objetivo.id, trimestre),
          evaluacion: evaluacionDe(d, alumnoId, objetivo.id, trimestre),
        }))),
    respuesta,
    notas: registros.filter(x => x.r.nota.trim()).map(x => ({ fecha: x.s.fecha, texto: x.r.nota.trim() })),
    temas: [...new Map(sesiones.filter(s => s.temaClase.trim()).map(s => [s.temaClase.trim(), { fecha: s.fecha, texto: s.temaClase.trim() }])).values()],
    coordinaciones: coordinacionesDe(d, alumnoId, trimestre),
  };
}

/**
 * Lo que se cuenta a la IA de un alumno para hacerle una ficha adaptada, en
 * el campo «Cómo es el grupo» de Recursos, donde el docente lo ve y lo puede
 * cambiar antes de enviarlo. Ni su nombre ni su diagnóstico: para adaptar una
 * ficha bastan sus necesidades y sus objetivos.
 */
export function contextoFichaApoyo(
  a: AlumnoApoyo, objetivos: readonly string[], t: (k: string, vars?: Record<string, string | number>) => string,
): string {
  return [
    t('Ficha para un alumno o una alumna de apoyo.'),
    a.categorias.length ? t('Necesidades específicas de apoyo educativo: {lista}.', { lista: a.categorias.map(c => t(c)).join(', ') }) : '',
    a.necesidades.trim() ? t('Cómo aprende: {texto}', { texto: a.necesidades.trim() }) : '',
    objetivos.length ? t('Objetivos que trabaja este trimestre: {lista}.', { lista: objetivos.join('; ') }) : '',
    t('Adáptala: enunciados cortos y claros, pocas actividades por página, apoyo visual y letra grande.'),
  ].filter(Boolean).join(' ');
}

/* ── Carga segura ── */

const esTexto = (v: unknown): v is string => typeof v === 'string';
const lista = <T,>(v: unknown, f: (x: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(f).filter((x): x is T => x !== null) : [];
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

function curso(v: unknown): CursoDe | undefined {
  const o = obj(v);
  if (!o || (o.etapa !== 'primaria' && o.etapa !== 'eso')) return undefined;
  const n = Number(o.curso);
  const max = o.etapa === 'primaria' ? 6 : 4;
  return Number.isInteger(n) && n >= 1 && n <= max ? { etapa: o.etapa, curso: n } : undefined;
}

const especialidad = (v: unknown): Especialidad => (v === 'AL' ? 'AL' : 'PT');

/**
 * Lo que llega del disco o de una copia de seguridad, con la forma que espera
 * la app. Lo que no se entiende se descarta en vez de romper la pantalla.
 */
export function normalizarApoyo(raw: unknown): ApoyoData {
  const o = obj(raw);
  if (!o) return APOYO_VACIO;
  const alumnos = lista<AlumnoApoyo>(o.alumnos, v => {
    const a = obj(v);
    if (!a || !esTexto(a.id) || !esTexto(a.nombre)) return null;
    const objetivosOrientacion = lista<ObjetivoOrientacion>(a.objetivosOrientacion, v => {
      const x = obj(v);
      if (!x || !esTexto(x.id) || !esTexto(x.texto) || !x.texto.trim()) return null;
      const trimestres = lista<Trimestre>(x.trimestres, t => (t === 1 || t === 2 || t === 3 ? t : null));
      return {
        id: x.id, texto: x.texto, ...(esTexto(x.ambito) && x.ambito ? { ambito: x.ambito } : {}),
        trimestres: trimestres.length ? [...new Set(trimestres)].sort() : [1, 2, 3],
        origen: x.origen === 'informe' ? 'informe' : 'orientacion',
      };
    });
    const inf = obj(a.informe);
    const informe = inf && esTexto(inf.fecha)
      ? {
        fecha: inf.fecha, ...(esTexto(inf.archivo) && inf.archivo ? { archivo: inf.archivo } : {}),
        fortalezas: esTexto(inf.fortalezas) ? inf.fortalezas : '', orientaciones: esTexto(inf.orientaciones) ? inf.orientaciones : '',
        ambitos: lista<string>(inf.ambitos, x => (esTexto(x) && x.trim() ? x : null)),
      }
      : undefined;
    return {
      id: a.id, nombre: a.nombre,
      claseOrigen: esTexto(a.claseOrigen) ? a.claseOrigen : '',
      matricula: curso(a.matricula), nivel: curso(a.nivel),
      // Hasta la 2.1.0 era una sola, en `categoria`
      categorias: Array.isArray(a.categorias)
        ? [...new Set(a.categorias.filter(esTexto).map(c => c.trim()).filter(Boolean))]
        : esTexto(a.categoria) && a.categoria.trim() ? [a.categoria.trim()] : [],
      diagnostico: esTexto(a.diagnostico) ? a.diagnostico : '',
      necesidades: esTexto(a.necesidades) ? a.necesidades : '',
      notas: esTexto(a.notas) ? a.notas : '',
      ...(informe ? { informe } : {}),
      ...(objetivosOrientacion.length ? { objetivosOrientacion } : {}),
    };
  });
  const ids = new Set(alumnos.map(a => a.id));
  const grupos = lista<GrupoApoyo>(o.grupos, v => {
    const g = obj(v);
    if (!g || !esTexto(g.id) || !esTexto(g.nombre)) return null;
    return {
      id: g.id, nombre: g.nombre, especialidad: especialidad(g.especialidad),
      modalidad: g.modalidad === 'dentro' ? 'dentro' : 'fuera',
      horario: lista(g.horario, f => {
        const x = obj(f);
        const dia = Number(x?.dia);
        if (!x || !Number.isInteger(dia) || dia < 0 || dia > 4 || !esTexto(x.inicio) || !esTexto(x.fin)) return null;
        return { dia, inicio: x.inicio, fin: x.fin };
      }),
      alumnos: lista(g.alumnos, id => (esTexto(id) && ids.has(id) ? id : null)),
      color: esTexto(g.color) ? g.color : '#6366f1',
    };
  });
  const programas = lista<ProgramaApoyo>(o.programas, v => {
    const p = obj(v);
    if (!p || !esTexto(p.id) || !esTexto(p.alumnoId) || !ids.has(p.alumnoId) || !esTexto(p.ambito)) return null;
    const intensidad = p.intensidad === 'baja' || p.intensidad === 'media' || p.intensidad === 'alta' ? p.intensidad : undefined;
    return {
      id: p.id, alumnoId: p.alumnoId, ambito: p.ambito, especialidad: especialidad(p.especialidad),
      ...(intensidad ? { intensidad } : {}),
      objetivos: lista<ObjetivoApoyo>(p.objetivos, ob => {
        const x = obj(ob);
        if (!x || !esTexto(x.id) || !esTexto(x.texto)) return null;
        const trimestres = lista<Trimestre>(x.trimestres, t => (t === 1 || t === 2 || t === 3 ? t : null));
        return {
          id: x.id, texto: x.texto,
          ...(x.origen === 'informe' || x.origen === 'orientacion' || x.origen === 'ia' ? { origen: x.origen } : {}),
          trimestres: trimestres.length ? [...new Set(trimestres)].sort() : [1, 2, 3],
          criterios: lista(x.criterios, c => {
            const r = obj(c);
            return r && esTexto(r.materia) && esTexto(r.codigo) ? { materia: r.materia, codigo: r.codigo } : null;
          }),
        };
      }),
    };
  });
  const sesiones = lista<SesionApoyo>(o.sesiones, v => {
    const s = obj(v);
    if (!s || !esTexto(s.id) || !esTexto(s.grupoId) || !esTexto(s.fecha) || !/^\d{4}-\d{2}-\d{2}$/.test(s.fecha)) return null;
    const adaptaciones: Record<string, string> = {};
    Object.entries(obj(s.adaptaciones) ?? {}).forEach(([k, v]) => { if (esTexto(v) && v.trim()) adaptaciones[k] = v; });
    return {
      id: s.id, grupoId: s.grupoId, fecha: s.fecha,
      temaClase: esTexto(s.temaClase) ? s.temaClase : '',
      ...(Object.keys(adaptaciones).length ? { adaptaciones } : {}),
      alumnos: lista<RegistroAlumno>(s.alumnos, r => {
        const x = obj(r);
        if (!x || !esTexto(x.alumnoId)) return null;
        const objetivos: Record<string, Logro> = {};
        Object.entries(obj(x.objetivos) ?? {}).forEach(([k, l]) => {
          if (l === 'si' || l === 'proceso' || l === 'no') objetivos[k] = l;
        });
        const respuesta: RegistroAlumno['respuesta'] = {};
        Object.entries(obj(x.respuesta) ?? {}).forEach(([k, c]) => {
          if ((ASPECTOS as readonly string[]).includes(k) && (c === 1 || c === 2 || c === 3)) respuesta[k as AspectoRespuesta] = c;
        });
        return {
          alumnoId: x.alumnoId, ...(x.ausente === true ? { ausente: true } : {}),
          objetivos, respuesta, nota: esTexto(x.nota) ? x.nota : '',
        };
      }),
    };
  });
  const documentos = lista<DocumentoApoyo>(o.documentos, v => {
    const x = obj(v);
    const tipos = ['programacion', 'familia', 'equipo', 'pap', 'adaptacion'];
    if (!x || !esTexto(x.id) || !esTexto(x.alumnoId) || !ids.has(x.alumnoId) || !tipos.includes(x.tipo as string)) return null;
    const trimestre = x.trimestre === 1 || x.trimestre === 2 || x.trimestre === 3 ? x.trimestre : undefined;
    const tabla = Array.isArray(x.tabla)
      ? x.tabla.filter(Array.isArray).map(f => (f as unknown[]).map(c => (esTexto(c) ? c : '')))
      : undefined;
    return {
      id: x.id, alumnoId: x.alumnoId, tipo: x.tipo as DocumentoApoyo['tipo'],
      ...(trimestre ? { trimestre } : {}),
      ...(esTexto(x.area) && x.area ? { area: x.area } : {}),
      fecha: esTexto(x.fecha) ? x.fecha : '',
      titulo: esTexto(x.titulo) ? x.titulo : '',
      apartados: lista(x.apartados, a => {
        const y = obj(a);
        return y && esTexto(y.id) && esTexto(y.titulo) && esTexto(y.texto) ? { id: y.id, titulo: y.titulo, texto: y.texto } : null;
      }),
      ...(tabla ? { tabla } : {}),
    };
  });
  const conQuien: readonly ConQuien[] = ['tutoria', 'familia', 'orientacion', 'equipo', 'otros'];
  const coordinaciones = lista<CoordinacionApoyo>(o.coordinaciones, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id) || !esTexto(x.alumnoId) || !ids.has(x.alumnoId)) return null;
    return {
      id: x.id, alumnoId: x.alumnoId,
      fecha: esTexto(x.fecha) ? x.fecha : '',
      con: conQuien.includes(x.con as ConQuien) ? x.con as ConQuien : 'otros',
      asistentes: esTexto(x.asistentes) ? x.asistentes : '',
      temas: esTexto(x.temas) ? x.temas : '',
      acuerdos: esTexto(x.acuerdos) ? x.acuerdos : '',
    };
  });
  const evaluaciones = lista<EvaluacionObjetivo>(o.evaluaciones, v => {
    const x = obj(v);
    if (!x || !esTexto(x.alumnoId) || !ids.has(x.alumnoId) || !esTexto(x.objetivoId)) return null;
    const trimestre = Number(x.trimestre);
    const resultado = x.resultado;
    if (!(trimestre === 1 || trimestre === 2 || trimestre === 3)) return null;
    if (!(resultado === 'si' || resultado === 'proceso' || resultado === 'no' || resultado === 'sin')) return null;
    return {
      alumnoId: x.alumnoId, objetivoId: x.objetivoId, trimestre, resultado,
      comentario: esTexto(x.comentario) ? x.comentario : '', fecha: esTexto(x.fecha) ? x.fecha : '',
    };
  });
  const fotos = lista<FotoApoyo>(o.fotos, v => {
    const x = obj(v);
    return x && esTexto(x.id) && esTexto(x.datos) && x.datos.startsWith('data:image/')
      ? { id: x.id, nombre: esTexto(x.nombre) ? x.nombre : '', datos: x.datos }
      : null;
  });
  const idsFotos = new Set(fotos.map(f => f.id));
  const agendas = lista<AgendaVisual>(o.agendas, v => {
    const x = obj(v);
    if (!x || !esTexto(x.id)) return null;
    return {
      id: x.id,
      ...(esTexto(x.alumnoId) && ids.has(x.alumnoId) ? { alumnoId: x.alumnoId } : {}),
      titulo: esTexto(x.titulo) ? x.titulo : '',
      pasos: lista<PasoAgenda>(x.pasos, p => {
        const y = obj(p);
        if (!y || !esTexto(y.id)) return null;
        return {
          id: y.id,
          ...(esTexto(y.picto) ? { picto: y.picto } : {}),
          ...(esTexto(y.fotoId) && idsFotos.has(y.fotoId) ? { fotoId: y.fotoId } : {}),
          texto: esTexto(y.texto) ? y.texto : '',
        };
      }),
    };
  });
  return { alumnos, grupos, programas, sesiones, documentos, coordinaciones, evaluaciones, agendas, fotos };
}

/**
 * Lo que queda al vaciar el curso: las agendas visuales sin alumno, que son
 * plantillas, y las fotos que usan. Todo lo demás es de este curso.
 */
export function apoyoParaOtroCurso(d: ApoyoData): ApoyoData {
  const agendas = d.agendas.filter(a => !a.alumnoId);
  const usadas = new Set(agendas.flatMap(a => a.pasos.map(p => p.fotoId).filter(Boolean)));
  return { ...APOYO_VACIO, agendas, fotos: d.fotos.filter(f => usadas.has(f.id)) };
}

/** Quita un alumno de todo el módulo: grupos, programas y registros. */
export function sinAlumno(d: ApoyoData, alumnoId: string): ApoyoData {
  return {
    alumnos: d.alumnos.filter(a => a.id !== alumnoId),
    grupos: d.grupos.map(g => ({ ...g, alumnos: g.alumnos.filter(id => id !== alumnoId) })),
    programas: d.programas.filter(p => p.alumnoId !== alumnoId),
    sesiones: d.sesiones
      .map(s => ({ ...s, alumnos: s.alumnos.filter(r => r.alumnoId !== alumnoId) }))
      .filter(s => s.alumnos.length > 0),
    documentos: d.documentos.filter(x => x.alumnoId !== alumnoId),
    coordinaciones: d.coordinaciones.filter(x => x.alumnoId !== alumnoId),
    evaluaciones: d.evaluaciones.filter(x => x.alumnoId !== alumnoId),
    agendas: d.agendas.filter(a => a.alumnoId !== alumnoId),
    // Las fotos son la biblioteca del docente: se quitan una a una
    fotos: d.fotos,
  };
}

/** Quita un grupo y sus sesiones; el alumnado y sus programas se quedan. */
export function sinGrupo(d: ApoyoData, grupoId: string): ApoyoData {
  return {
    ...d,
    grupos: d.grupos.filter(g => g.id !== grupoId),
    sesiones: d.sesiones.filter(s => s.grupoId !== grupoId),
  };
}
