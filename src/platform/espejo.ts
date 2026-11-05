/**
 * Versión web: una copia de los datos en una carpeta del ordenador.
 *
 * Los datos viven siempre en el navegador (IndexedDB), que es rápido y
 * funciona sin conexión. Si el docente elige una carpeta (por ejemplo, la de
 * OneDrive o Google Drive en su ordenador), cada cambio se copia también ahí,
 * con la misma estructura que la app de escritorio:
 *
 *   AulaPro/perfiles.json
 *   AulaPro/perfiles/<id>/datos.json
 *   AulaPro/perfiles/<id>/guardado.json   quién y cuándo escribió datos.json
 *   AulaPro/perfiles/<id>/copias/…
 *
 * Así, si se borran los datos del navegador o se rompe el ordenador, el
 * trabajo está en la carpeta; y dos ordenadores con la misma carpeta de
 * OneDrive se pasan el trabajo: al abrir, si la carpeta tiene algo más nuevo
 * de otro dispositivo y aquí no hay nada sin copiar, se carga solo.
 *
 * Lo que nunca hace es pisar el trabajo de otro dispositivo: si la carpeta ha
 * cambiado desde la última vez que este la vio y aquí también hay cambios sin
 * copiar, se para y pregunta con cuál quedarse (`conflictos`).
 */
import type { Fs } from './profileStore';
import type { Kv } from './webFs';
import { textoDePerfilVacio } from '../lib/contenidoPerfil';

export type EstadoCarpeta =
  | { tipo: 'sin-carpeta' }
  | { tipo: 'activa'; nombre: string; ultima?: string }
  /** El navegador pide permiso de nuevo para escribir en la carpeta (hace falta un clic). */
  | { tipo: 'sin-permiso'; nombre: string }
  | { tipo: 'error'; nombre: string; mensaje: string };

/**
 * Quién y cuándo escribió `datos.json`, y la huella de lo que escribió (desde el 5-11-2026: longitud y resumen del
 * texto, `huellaDeDatos`). Con la huella, quien lee la marca sabe si el `datos.json` que tiene delante es el que la
 * marca anuncia: en una carpeta sincronizada por el programa de OneDrive o de Drive los dos archivos llegan por
 * separado, y en la nube dos subidas a la vez pueden cruzarse (los datos de uno con la marca del otro).
 */
export interface Marca { dispositivo: string; en: string; huella?: string }

/** Huella barata y sin dependencias del texto de `datos.json`: su longitud y un resumen (djb2) en hexadecimal. */
export function huellaDeDatos(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 33) ^ texto.charCodeAt(i)) >>> 0;
  return `${texto.length}:${h.toString(16)}`;
}

export interface Conexion {
  /** La carpeta y este navegador tienen datos: hay que preguntar cuáles se usan. */
  elegir: boolean;
  /** Perfiles traídos de la carpeta: hay que recargar la app para verlos. */
  cargados: number;
}

const RAIZ = 'AulaPro';
const PERFILES = `${RAIZ}/perfiles.json`;
const datosDe = (id: string) => `${RAIZ}/perfiles/${id}/datos.json`;
const marcaDe = (id: string) => `${RAIZ}/perfiles/${id}/guardado.json`;
const DATOS = /^AulaPro\/perfiles\/([^/]+)\/datos\.json$/;
/** Los archivos que no son de un perfil (las copias con nombre) y aún no se han copiado: se copian al abrir la app. */
const PENDIENTES = 'pendientes:archivos';
/** Pausa antes de copiar a una carpeta del ordenador: la app guarda cada pocos cientos de milisegundos y no hace falta cada uno. */
export const PAUSA_COPIA = 4000;
/**
 * Con Google Drive u OneDrive (decisión del dueño, 30-10-2026: «no quiero subir tantos archivos»): el trabajo
 * ya está a salvo en el navegador, así que a la nube sube como mucho cada media hora (el primer cambio arranca la
 * cuenta y los demás no la reinician) y al salir de la aplicación, pero no más de una vez cada cinco minutos.
 * Lo que no llegó a subir queda marcado y se sube al abrir la app la próxima vez.
 */
export const PAUSA_NUBE = 30 * 60_000;
export const MINIMO_ENTRE_SUBIDAS = 5 * 60_000;

interface Perfil { id: string }

function leerLista(raw: string | null): Perfil[] {
  try {
    const l = raw ? JSON.parse(raw) : [];
    return Array.isArray(l) ? l.filter(p => p && typeof p.id === 'string') : [];
  } catch { return []; }
}

const esPermiso = (err: unknown) => ['NotAllowedError', 'SecurityError'].includes((err as DOMException)?.name);

export function createEspejo(opts: {
  local: Fs;
  kv: Kv;
  dispositivo: string;
  ahora?: () => string;
  pausa?: number;
  pausaNube?: number;
  minimoNube?: number;
  /** El reloj en milisegundos, para las pruebas. */
  reloj?: () => number;
}) {
  const { local, kv, dispositivo } = opts;
  const ahora = opts.ahora ?? (() => new Date().toISOString());
  const pausa = opts.pausa ?? PAUSA_COPIA;
  const pausaNube = opts.pausaNube ?? PAUSA_NUBE;
  const minimoNube = opts.minimoNube ?? MINIMO_ENTRE_SUBIDAS;
  const reloj = opts.reloj ?? Date.now;

  let carpeta: Fs | null = null;
  /** La carpeta es Google Drive u OneDrive: se sube más espaciado (`PAUSA_NUBE`). */
  let enNube = false;
  /** Cuándo se subió cada archivo la última vez (ms). */
  const subidoEn = new Map<string, number>();
  /**
   * Tras traer datos de otro dispositivo con la app ya abierta: lo que tiene en
   * memoria es viejo y lo volvería a guardar encima. Hasta que se recarga, no
   * se escribe nada de los perfiles.
   */
  let congelado = false;
  const deLosPerfiles = (p: string) => DATOS.test(p) || p === PERFILES;
  let estado: EstadoCarpeta = { tipo: 'sin-carpeta' };
  const conflictos = new Set<string>();
  /**
   * Conflictos en los que una de las dos copias está vacía y la otra no (auditoría del 1-11-2026): `aqui`, la de este
   * navegador (lo que se ve si no se ha podido leer el trabajo); `alli`, la de la carpeta o la nube. Nunca se sustituye
   * una copia con datos por una vacía sin preguntar: con las versiones antiguas borradas, no habría vuelta atrás.
   */
  const vacios = new Map<string, 'aqui' | 'alli'>();
  /**
   * Cuántas veces se ha escrito `datos.json` de cada perfil en esta pestaña. Una subida lee los datos y, al terminar,
   * solo da el perfil por copiado si nadie ha vuelto a escribirlo mientras tanto (5-11-2026: antes, un cambio hecho
   * durante la subida se quedaba en el navegador sin marca de pendiente, y el siguiente dispositivo lo pisaba).
   */
  const escrituras = new Map<string, number>();
  const oyentes = new Set<() => void>();
  const avisar = () => oyentes.forEach(fn => fn());
  const nombre = () => ('nombre' in estado ? estado.nombre : '');

  let cola: Promise<unknown> = Promise.resolve();
  const enCola = (job: () => Promise<unknown>) => {
    cola = cola.then(job).catch(err => {
      estado = esPermiso(err)
        ? { tipo: 'sin-permiso', nombre: nombre() }
        : { tipo: 'error', nombre: nombre(), mensaje: err instanceof Error ? err.message : String(err) };
      avisar();
    });
    return cola;
  };

  /**
   * La carpeta con la que se copia. Con un error que no es de permiso (un corte de red, la nube que no responde) se
   * sigue intentando: la comprobación periódica y la siguiente subida vuelven a probar, y si salen bien el estado
   * vuelve a «activa» (5-11-2026; antes, un fallo pasajero dejaba la carpeta parada hasta recargar).
   */
  const activa = () => carpeta && (estado.tipo === 'activa' || estado.tipo === 'error') ? carpeta : null;
  const otraVezActiva = () => { if (estado.tipo === 'error') { estado = { tipo: 'activa', nombre: estado.nombre }; avisar(); } };

  async function leerMarca(c: Fs, id: string): Promise<Marca | null> {
    try {
      const m = JSON.parse((await c.read(marcaDe(id))) ?? 'null');
      return m && typeof m.en === 'string' ? m : null;
    } catch { return null; }
  }

  /**
   * datos.json de un perfil a la carpeta, salvo que otro dispositivo la haya cambiado sin que este lo sepa, o que lo de
   * aquí esté vacío y lo de allí no. `forzar`: el docente ha elegido quedarse con lo de aquí.
   */
  const deOtro = (m: Marca | null) => !!m && m.dispositivo !== dispositivo;
  async function copiarDatos(c: Fs, id: string, forzar = false) {
    const m = await leerMarca(c, id);
    if (!forzar && deOtro(m) && m!.en !== (await kv.get<string>(`visto:${id}`))) {
      conflictos.add(id);
      avisar();
      return;
    }
    const n = escrituras.get(id) ?? 0;
    const data = await local.read(datosDe(id));
    if (data == null) return;
    if (!forzar && textoDePerfilVacio(data)) {
      const alli = await c.read(datosDe(id));
      if (alli != null && !textoDePerfilVacio(alli)) {
        vacios.set(id, 'aqui');
        conflictos.add(id);
        avisar();
        return;
      }
    }
    await c.write(datosDe(id), data);
    subidoEn.set(datosDe(id), reloj());
    if (!forzar) {
      // Dos dispositivos subiendo a la vez: si otro ha dejado su marca mientras se subían los datos, lo que hay en la
      // carpeta ya no es de este. No se firma como propio: queda como conflicto y lo de aquí sigue pendiente
      const m2 = await leerMarca(c, id);
      if (deOtro(m2) && (!m || m2!.en !== m.en || m2!.dispositivo !== m.dispositivo)) {
        conflictos.add(id);
        avisar();
        return;
      }
    }
    const en = ahora();
    await c.write(marcaDe(id), JSON.stringify({ dispositivo, en, huella: huellaDeDatos(data) } satisfies Marca));
    await kv.set(`visto:${id}`, en);
    // Si la app ha vuelto a guardar durante la subida, lo nuevo sigue pendiente (su cuenta atrás ya está puesta)
    if ((escrituras.get(id) ?? 0) === n) await kv.del(`pendiente:${id}`);
    conflictos.delete(id);
    vacios.delete(id);
    otraVezActiva();
    if (estado.tipo === 'activa') { estado = { ...estado, ultima: en }; avisar(); }
  }

  async function copiar(c: Fs, path: string) {
    const id = DATOS.exec(path)?.[1];
    if (id) return copiarDatos(c, id);
    if (path === PERFILES) return copiarPerfiles(c);
    const data = await local.read(path);
    if (data == null) await c.remove(path);
    else await c.write(path, data);
    await quitarPendiente(path);
    otraVezActiva();
  }

  /** Los archivos que no son de un perfil y esperan copia (las copias «antes de…»), apuntados en el navegador. */
  const pendientes = async () => (await kv.get<string[]>(PENDIENTES)) ?? [];
  async function apuntarPendiente(path: string) {
    const l = await pendientes();
    if (!l.includes(path)) await kv.set(PENDIENTES, [...l, path]);
  }
  async function quitarPendiente(path: string) {
    const l = await pendientes();
    if (l.includes(path)) await kv.set(PENDIENTES, l.filter(p => p !== path));
  }

  const esperando = new Map<string, ReturnType<typeof setTimeout>>();
  function programar(path: string) {
    if (!activa()) return;
    // A la nube, la cuenta atrás no se reinicia con cada cambio: si no, quien trabaja sin parar no subiría nunca
    if (enNube && esperando.has(path)) return;
    clearTimeout(esperando.get(path));
    esperando.set(path, setTimeout(() => {
      esperando.delete(path);
      const c = activa();
      if (c) enCola(() => copiar(c, path));
    }, enNube ? pausaNube : pausa));
  }

  /**
   * Copia ya lo que estaba esperando. Con `alSalir` (al ocultar la página o cerrarla), a la nube no sube lo que
   * se subió hace menos de cinco minutos: cambiar de pestaña no debe gastar una subida cada vez, y lo que quede se
   * sube con su cuenta atrás o, si ya no hay página, al abrir la app otra vez.
   */
  function vaciar(opts: { alSalir?: boolean } = {}) {
    const c = activa();
    for (const [path, t] of esperando) {
      if (opts.alSalir && enNube && reloj() - (subidoEn.get(path) ?? 0) < minimoNube) continue;
      clearTimeout(t);
      esperando.delete(path);
      if (c) enCola(() => copiar(c, path));
    }
    return cola;
  }

  /**
   * Antes de escribir un archivo en el navegador: el perfil (o la copia) queda apuntado como pendiente de copiar.
   * Va ANTES de la escritura a propósito (5-11-2026): si la pestaña se cierra entre la escritura y el apunte (al
   * guardar al cerrar), el navegador tendría datos nuevos que nunca subirían y el siguiente dispositivo los pisaría.
   * Al revés, un apunte sin escritura solo cuesta una subida de más.
   */
  async function antes(path: string) {
    const id = DATOS.exec(path)?.[1];
    if (id) {
      escrituras.set(id, (escrituras.get(id) ?? 0) + 1);
      await kv.set(`pendiente:${id}`, true);
    } else if (carpeta && path !== PERFILES && !path.endsWith('.tmp')) {
      await apuntarPendiente(path);
    }
  }

  /** El `Fs` que usa `profileStore`: lee y escribe en el navegador y copia en la carpeta. */
  const fs: Fs = {
    read: p => local.read(p),
    list: p => local.list(p),
    async write(p, d) {
      if (congelado && (deLosPerfiles(p) || deLosPerfiles(p.replace(/\.tmp$/, '')))) return;
      await antes(p);
      await local.write(p, d);
      // Los temporales de la escritura segura no salen: se copia el archivo ya renombrado
      if (!p.endsWith('.tmp')) programar(p);
    },
    async rename(from, to) {
      if (congelado && deLosPerfiles(to)) return;
      await antes(to);
      await local.rename(from, to);
      programar(to);
    },
    async remove(p) {
      await local.remove(p);
      if (!DATOS.test(p)) await quitarPendiente(p);
      const c = activa();
      if (c) enCola(() => c.remove(p));
    },
    async removeDir(p) {
      await local.removeDir(p);
      const c = activa();
      if (c) enCola(() => c.removeDir(p));
    },
  };

  /** Los perfiles de la carpeta que tienen datos (uno borrado en otro dispositivo ya no los tiene). */
  async function leerPerfilesDeCarpeta(c: Fs): Promise<{ raw: string | null; perfiles: Perfil[] }> {
    const raw = await c.read(PERFILES);
    const lista = leerLista(raw);
    const con = await Promise.all(lista.map(async p => (await c.list(`${RAIZ}/perfiles/${p.id}`)).length > 0));
    return { raw, perfiles: lista.filter((_, i) => con[i]) };
  }
  /** La misma lista aunque cambie el orden: para no subir `perfiles.json` si no ha cambiado nada. */
  const canonica = (l: Perfil[]) => JSON.stringify([...l].sort((a, b) => (a.id < b.id ? -1 : 1)));

  /**
   * La lista de perfiles a la carpeta, sin quitar los que otro dispositivo
   * haya creado allí; los de aquí mandan sobre los de allí.
   */
  async function copiarPerfiles(c: Fs, leido?: { raw: string | null; perfiles: Perfil[] }) {
    const aqui = leerLista(await local.read(PERFILES));
    const { raw, perfiles } = leido ?? await leerPerfilesDeCarpeta(c);
    const lista = [...aqui, ...perfiles.filter(p => !aqui.some(q => q.id === p.id))];
    // Cada subida es una versión más en Drive: solo si hay algo distinto
    if (raw != null && canonica(leerLista(raw)) === canonica(lista)) return;
    await c.write(PERFILES, JSON.stringify(lista, null, 1));
  }

  /** Une la lista de perfiles de la carpeta a la de aquí (si un perfil está en las dos, manda el de aquí). */
  async function unirPerfiles(alli: Perfil[]): Promise<Perfil[]> {
    const aqui = leerLista(await local.read(PERFILES));
    const nuevos = alli.filter(p => !aqui.some(q => q.id === p.id));
    if (nuevos.length) await local.write(PERFILES, JSON.stringify([...aqui, ...nuevos], null, 1));
    return alli;
  }

  /** datos.json de la carpeta a este navegador. Uno vacío no sustituye a uno con datos sin preguntar (salvo `forzar`). */
  async function traer(c: Fs, id: string, m: Marca | null, forzar = false, congelar = false) {
    const data = await c.read(datosDe(id));
    if (data == null) return false;
    // La marca anuncia otros datos: aún no han llegado (carpeta sincronizada) o dos subidas se han cruzado. Se espera
    if (!forzar && m?.huella && huellaDeDatos(data) !== m.huella) return false;
    if (!forzar) {
      const aqui = await local.read(datosDe(id));
      if (aqui != null && textoDePerfilVacio(data) && !textoDePerfilVacio(aqui)) {
        vacios.set(id, 'alli');
        conflictos.add(id);
        return false;
      }
      // Mientras se bajaba, la app ha guardado aquí: ahora han cambiado los dos, y lo decide el docente
      if (aqui != null && (await kv.get<boolean>(`pendiente:${id}`))) {
        conflictos.add(id);
        return false;
      }
    }
    // Con la app abierta, desde ya no se guarda nada de los perfiles hasta recargar (ver `congelado`)
    if (congelar) congelado = true;
    await local.write(datosDe(id), data);
    if (m) await kv.set(`visto:${id}`, m.en);
    // Solo si lo ha elegido el docente: si no, no había nada pendiente (y si lo hubiera, mejor una subida de más)
    if (forzar) await kv.del(`pendiente:${id}`);
    return true;
  }

  /**
   * Al abrir la app (o al volver a dar permiso): trae lo que otro dispositivo
   * haya dejado en la carpeta y copia lo que aquí quedó sin copiar.
   * Devuelve cuántos perfiles se han traído: si son más de cero, hay que recargar.
   */
  async function comprobar(opts: { congelar?: boolean } = {}): Promise<number> {
    const c = activa();
    if (!c) return 0;
    let cargados = 0;
    try {
      const leido = await leerPerfilesDeCarpeta(c);
      const alli = await unirPerfiles(leido.perfiles);
      for (const { id } of alli) {
        const m = await leerMarca(c, id);
        if (!m || m.en === (await kv.get<string>(`visto:${id}`))) continue;
        if (m.dispositivo === dispositivo) { await kv.set(`visto:${id}`, m.en); continue; }
        // La carpeta ha cambiado: lo que se dijo de ella («allí vacío») ya no vale y se vuelve a mirar
        if (vacios.get(id) === 'alli') vacios.delete(id);
        const pendiente = await kv.get<boolean>(`pendiente:${id}`);
        if (!pendiente || (await local.read(datosDe(id))) == null) {
          if (await traer(c, id, m, false, opts.congelar)) cargados++;
        } else {
          conflictos.add(id);
        }
      }
      // Con lo que acaba de leerse: no se vuelve a bajar `perfiles.json` para ver si hay algo que subir
      enCola(() => copiarPerfiles(c, leido));
      for (const { id } of leerLista(await local.read(PERFILES))) {
        // Lo que ya tiene su cuenta atrás no se sube antes: esta comprobación se repite cada 30 s. Un conflicto
        // «aquí vacío» se vuelve a intentar: si aquí ya hay datos, se sube y el conflicto desaparece solo
        const otraVez = !conflictos.has(id) || vacios.get(id) === 'aqui';
        if (otraVez && !esperando.has(datosDe(id)) && (await kv.get<boolean>(`pendiente:${id}`))) enCola(() => copiarDatos(c, id));
      }
      // Las copias con nombre que no llegaron a copiarse antes de cerrar o recargar
      for (const path of await pendientes()) if (!esperando.has(path)) enCola(() => copiar(c, path));
      otraVezActiva();
    } catch (err) {
      estado = esPermiso(err) ? { tipo: 'sin-permiso', nombre: nombre() } : { tipo: 'error', nombre: nombre(), mensaje: String(err) };
    }
    avisar();
    return cargados;
  }

  return {
    fs,
    vaciar,
    comprobar,
    estado: () => estado,
    conflictos: () => [...conflictos],
    /** De los conflictos, los que lo son porque una copia está vacía: dónde está la vacía. */
    vacios: () => Object.fromEntries(vacios) as Record<string, 'aqui' | 'alli'>,
    onCambio(fn: () => void) { oyentes.add(fn); return () => { oyentes.delete(fn); }; },

    /** La carpeta guardada de otra vez, ya con permiso. */
    async activar(c: Fs, nombreCarpeta: string, opts: { congelar?: boolean; nube?: boolean } = {}) {
      carpeta = c;
      enNube = !!opts.nube;
      estado = { tipo: 'activa', nombre: nombreCarpeta };
      return comprobar(opts);
    },
    /** Se ha traído algo con la app abierta y falta recargar (ver `congelado`). */
    congelado: () => congelado,

    /** Hay carpeta guardada, pero el navegador pide permiso (un clic del docente). */
    sinPermiso(nombreCarpeta: string) {
      carpeta = null;
      estado = { tipo: 'sin-permiso', nombre: nombreCarpeta };
      avisar();
    },

    /**
     * Elegir una carpeta. Si ya tiene datos de AulaPro y aquí también hay, no
     * hace nada y devuelve `elegir`: hay que preguntar con cuáles quedarse
     * (`preferir`). Con `carpeta`, se traen los de la carpeta (los perfiles que
     * solo están aquí se conservan); con `local`, los de aquí sustituyen a los
     * de la carpeta.
     */
    async conectar(c: Fs, nombreCarpeta: string, preferir?: 'carpeta' | 'local', nube = false): Promise<Conexion> {
      const leido = await leerPerfilesDeCarpeta(c);
      const alli = leido.perfiles;
      const aqui = leerLista(await local.read(PERFILES));
      if (alli.length && aqui.length && !preferir) return { elegir: true, cargados: 0 };

      const traidos = new Set<string>();
      if (alli.length && preferir !== 'local') {
        await unirPerfiles(alli);
        for (const { id } of alli) if (await traer(c, id, await leerMarca(c, id), preferir === 'carpeta')) traidos.add(id);
      } else {
        // Los de aquí mandan: se da por vista la marca de la carpeta para poder sustituirla
        for (const { id } of aqui) {
          const m = await leerMarca(c, id);
          if (m) await kv.set(`visto:${id}`, m.en);
        }
      }
      carpeta = c;
      enNube = nube;
      estado = { tipo: 'activa', nombre: nombreCarpeta };
      await enCola(() => copiarPerfiles(c, leido));
      // Lo que se acaba de traer ya está en la carpeta: copiarlo otra vez lo firmaría como de este dispositivo
      for (const { id } of leerLista(await local.read(PERFILES))) {
        if (!traidos.has(id)) await enCola(() => copiarDatos(c, id, preferir === 'local'));
      }
      avisar();
      return { elegir: false, cargados: traidos.size };
    },

    desconectar() {
      for (const t of esperando.values()) clearTimeout(t);
      esperando.clear();
      carpeta = null;
      enNube = false;
      conflictos.clear();
      vacios.clear();
      estado = { tipo: 'sin-carpeta' };
      avisar();
    },

    /**
     * Un conflicto: `carpeta` trae lo de la carpeta (hay que recargar);
     * `local` copia lo de aquí encima.
     */
    async resolver(id: string, con: 'carpeta' | 'local') {
      const c = activa();
      if (!c) return;
      const m = await leerMarca(c, id);
      // Lo ha elegido el docente: se hace aunque una de las dos copias esté vacía
      vacios.delete(id);
      // Con lo de la carpeta ya aquí, lo que la app tiene en memoria es viejo: no se vuelve a escribir hasta recargar
      if (con === 'carpeta') await traer(c, id, m, true, true);
      else {
        if (m) await kv.set(`visto:${id}`, m.en);
        conflictos.delete(id);
        await enCola(() => copiarDatos(c, id, true));
      }
      conflictos.delete(id);
      avisar();
    },

    /**
     * Esta pestaña deja de copiar y de traer nada (otra pestaña se ha quedado con la app: `platform/unaPestana.ts`).
     * Lo que tiene en memoria ya no es lo último; lo guardado en el navegador lo copia la otra.
     */
    detener() {
      for (const t of esperando.values()) clearTimeout(t);
      esperando.clear();
      congelado = true;
      carpeta = null;
      avisar();
    },
  };
}

export type Espejo = ReturnType<typeof createEspejo>;
