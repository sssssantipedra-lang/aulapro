/**
 * La dirección de cada pantalla (20-11-2026).
 *
 * Hasta ahora la pantalla abierta era solo un estado en memoria: el botón de atrás del navegador (y el gesto de
 * atrás del móvil y la tableta) sacaba de AulaPro, y recargar o abrir un marcador llevaba siempre al Inicio.
 * Ahora cada pantalla tiene su dirección dentro de la app, en la parte «#/…»: `…/app/#/cuaderno`,
 * `…/app/#/evaluar/rubricas`. Esa parte no viaja al servidor (ni en las peticiones ni en el `Referer`), así que
 * no hacen falta rutas nuevas, el service worker guarda lo mismo que guardaba y nadie fuera del dispositivo sabe
 * qué pantalla se abre.
 *
 * Aquí está la lógica, sin React: los nombres, leer una dirección, a qué pantalla lleva en cada perfil y qué hacer
 * cuando el navegador vuelve atrás o adelante. Quien la conecta con el historial es `hooks/useRuta.ts`.
 *
 * En la dirección solo va la pantalla, nunca nada del alumnado ni un nombre. Lo que una entrada necesita además
 * (qué alumno de apoyo estaba abierto) va en el estado de esa entrada del historial, que no sale del navegador,
 * no se ve y no entra en los marcadores.
 */
import type { Section } from '../types';
import type { TipoDocente } from './tipoDocente';
import type { AlumnoPedido, PestanaAlumno } from './apoyoNav';
import { enMenu, madreDe } from './navigation';

/**
 * El nombre de cada pantalla en la dirección: en castellano, en minúsculas, sin tildes y con guiones. Las de un
 * apartado van detrás del suyo. Cambiar uno rompe los marcadores que ya se hayan guardado: si hay que hacerlo, el
 * nombre viejo se queda en `RUTAS_ANTERIORES`.
 */
export const RUTAS: Record<Section, string> = {
  dashboard: 'inicio',
  classes: 'clases',
  agenda: 'agenda',
  notebook: 'cuaderno',
  attendance: 'asistencia',

  evaluar: 'evaluar',
  rubrics: 'evaluar/rubricas',
  dianas: 'evaluar/dianas',
  registros: 'evaluar/escalas',
  evalfoto: 'evaluar/foto',
  diana: 'evaluar/diana-competencial',
  selfassess: 'evaluar/autoevaluaciones',
  history: 'evaluar/historial',

  documentos: 'documentos',
  reports: 'documentos/informes',
  records: 'documentos/actas',
  'learning-situations': 'documentos/situaciones-de-aprendizaje',
  sesiones: 'documentos/sesiones',
  resources: 'documentos/recursos',

  enclase: 'en-clase',
  actitud: 'en-clase/actitud',
  seating: 'en-clase/distribucion',
  'sec-classroom': 'en-clase/pizarra',
  'classroom-live': 'en-clase/moviles',

  meetings: 'reuniones',
  trainings: 'formaciones',
  share: 'compartir',
  profile: 'configuracion',
  audit: 'cambios',

  'apoyo-registro': 'apoyo/registro',
  'apoyo-alumnado': 'apoyo/alumnado',
  'apoyo-alumno': 'apoyo/alumno',
  'apoyo-agenda-visual': 'apoyo/agenda-visual',

  'ef-inicio': 'educacion-fisica',
  'ef-pista': 'educacion-fisica/pista',
  'ef-equipos': 'educacion-fisica/equipos',
  'ef-circuitos': 'educacion-fisica/cronometro',
  'ef-exentos': 'educacion-fisica/exentos',
  'ef-pruebas': 'educacion-fisica/pruebas',
  'ef-actividades': 'educacion-fisica/actividades',
  'ef-sesiones': 'educacion-fisica/sesiones',
  'ef-sda': 'educacion-fisica/situaciones-de-aprendizaje',
  'ef-pizarra': 'educacion-fisica/pizarra-de-circuitos',
  'ef-material': 'educacion-fisica/material',
};

/** Nombres que tuvo una pantalla y ya no tiene: un marcador antiguo sigue llevando a ella. */
const RUTAS_ANTERIORES: Record<string, Section> = {};

const POR_RUTA = new Map<string, Section>([
  ...Object.entries(RUTAS_ANTERIORES),
  ...(Object.entries(RUTAS) as [Section, string][]).map(([s, r]): [string, Section] => [r, s]),
]);

/** La parte «#/…» de la dirección de una pantalla. */
export function hashDe(section: Section): string {
  return `#/${RUTAS[section]}`;
}

/** Si esa parte «#» de la dirección es de las nuestras (una pantalla), y no un ancla u otra cosa. */
export function esRuta(hash: string): boolean {
  return hash.startsWith('#/');
}

/**
 * La pantalla de una dirección. Sin parte «#» es el Inicio; con una que no es nuestra o con un nombre que no
 * existe, `null` (quien llama decide: al abrir la app, el Inicio). Perdona mayúsculas, una barra de más al final
 * y lo que venga detrás de un «?».
 */
export function pantallaDeHash(hash: string): Section | null {
  if (hash === '' || hash === '#') return 'dashboard';
  if (!esRuta(hash)) return null;
  let ruta = hash.slice(2).split('?')[0];
  try { ruta = decodeURIComponent(ruta); } catch { /* se queda como venía */ }
  ruta = ruta.toLowerCase().replace(/\/+$/, '');
  if (ruta === '') return 'dashboard';
  return POR_RUTA.get(ruta) ?? null;
}

/**
 * Lo que guarda cada entrada del historial además de su dirección: su número de orden (`ap`), para saber cuántos
 * pasos atrás o adelante ha ido el navegador, y el alumno de apoyo que tenía abierto, si era su página.
 */
export interface Entrada { ap: number; alumno?: AlumnoPedido }

const PESTANAS: readonly PestanaAlumno[] = ['resumen', 'programa', 'sesiones', 'cierre', 'coordinaciones', 'documentos', 'datos'];

/** El estado de una entrada del historial, si es de las nuestras y está bien formado. */
export function leerEntrada(estado: unknown): Entrada | null {
  if (!estado || typeof estado !== 'object') return null;
  const e = estado as { ap?: unknown; alumno?: { alumnoId?: unknown; pestana?: unknown } };
  if (typeof e.ap !== 'number' || !Number.isInteger(e.ap) || e.ap < 0) return null;
  const a = e.alumno;
  if (a && typeof a.alumnoId === 'string' && a.alumnoId) {
    const pestana = PESTANAS.includes(a.pestana as PestanaAlumno) ? (a.pestana as PestanaAlumno) : 'resumen';
    return { ap: e.ap, alumno: { alumnoId: a.alumnoId, pestana } };
  }
  return { ap: e.ap };
}

/** La pantalla que se abre y, si es la página de un alumno de apoyo, cuál. */
export interface Destino { section: Section; alumno?: AlumnoPedido }

/**
 * A qué pantalla lleva una dirección. Si no existe, al Inicio. Si es una pantalla que necesita saber qué se abre
 * (la página de un alumno) y la entrada no lo dice, como en un marcador, a la lista de la que cuelga. Y con el
 * perfil ya abierto (`tipo`), si su menú no la tiene, al Inicio: el Cuaderno no existe para PT y AL.
 */
export function resolver(hash: string, entrada: Entrada | null, tipo: TipoDocente | null): Destino {
  let section = pantallaDeHash(hash) ?? 'dashboard';
  let alumno: AlumnoPedido | undefined;
  const madre = madreDe(section);
  if (madre) {
    if (section === 'apoyo-alumno' && entrada?.alumno) alumno = entrada.alumno;
    else section = madre;
  }
  if (tipo && !enMenu(section, tipo)) return { section: 'dashboard' };
  return alumno ? { section, alumno } : { section };
}

/** Si la pantalla existe para ese perfil; si no, el Inicio. */
export function pantallaPermitida(section: Section, tipo: TipoDocente): Section {
  return enMenu(section, tipo) ? section : 'dashboard';
}

export type AlVolver =
  /** La dirección es la de la pantalla abierta: no hay nada que hacer. */
  | { hacer: 'nada' }
  /**
   * Cambiar a esa pantalla. `ap` es el orden de la entrada a la que se ha llegado, o `null` si es nueva (alguien ha
   * escrito la dirección a mano). `pasos` es lo que hay que moverse en el historial para deshacer el salto (0 si no
   * se puede): se usa cuando había una ventana abierta, que se cierra en vez de cambiar de pantalla.
   */
  | { hacer: 'ir'; destino: Destino; ap: number | null; pasos: number };

/**
 * Qué hacer cuando el navegador cambia de entrada del historial (atrás, adelante o una dirección escrita a mano).
 * `ap` y `actual` son la entrada y la pantalla en las que estaba la app.
 */
export function alVolver(o: { hash: string; estado: unknown; ap: number; actual: Section; tipo: TipoDocente | null }): AlVolver {
  // Un ancla u otra cosa que no es una pantalla (y no es volver a la entrada sin «#» del principio): no es nuestro
  const entrada = leerEntrada(o.estado);
  if (!entrada && o.hash !== '' && !esRuta(o.hash)) return { hacer: 'nada' };
  const destino = resolver(o.hash, entrada, o.tipo);
  if (entrada?.ap === o.ap && destino.section === o.actual) return { hacer: 'nada' };
  return { hacer: 'ir', destino, ap: entrada ? entrada.ap : null, pasos: entrada ? o.ap - entrada.ap : 0 };
}

/* ── Ir a la página de Google o de Microsoft y volver ─────────────────────────────────────────────────────────
 * Al entrar o al dar permiso a Drive o a OneDrive en Safari (y siempre con Microsoft), la app se va a su página y
 * vuelve a `…/app/?code=…&state=…`: la parte «#» se pierde por el camino. Para volver a la pantalla en la que se
 * estaba (o a la del marcador con el que se llegó sin haber entrado), se apunta al salir de la página y se
 * recupera solo si la página vuelve de una de esas dos (trae `state`), nunca al abrir la app sin más.
 */
const SALIDA = 'aulapro_ruta_salida';

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Al irse de la página: apunta la pantalla en la que se estaba. */
export function guardarSalida(hash: string, almacen: Almacen): void {
  try {
    if (esRuta(hash) && pantallaDeHash(hash)) almacen.setItem(SALIDA, hash);
    else almacen.removeItem(SALIDA);
  } catch { /* sin almacenamiento */ }
}

/**
 * Al cargar la página, antes de que nadie limpie la dirección: la parte «#» con la que se abre la app. La de la
 * dirección manda; si no trae y la página vuelve de Google o de Microsoft, la que se apuntó al salir.
 */
export function entradaDeLaPagina(lugar: { hash: string; search: string }, almacen: Almacen): string {
  let apuntada: string | null = null;
  try {
    apuntada = almacen.getItem(SALIDA);
    almacen.removeItem(SALIDA);
  } catch { /* sin almacenamiento */ }
  if (esRuta(lugar.hash)) return lugar.hash;
  let vuelve = false;
  try { vuelve = new URLSearchParams(lugar.search).has('state'); } catch { /* dirección rara */ }
  return vuelve && apuntada && esRuta(apuntada) ? apuntada : lugar.hash;
}
