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

export type EstadoCarpeta =
  | { tipo: 'sin-carpeta' }
  | { tipo: 'activa'; nombre: string; ultima?: string }
  /** El navegador pide permiso de nuevo para escribir en la carpeta (hace falta un clic). */
  | { tipo: 'sin-permiso'; nombre: string }
  | { tipo: 'error'; nombre: string; mensaje: string };

export interface Marca { dispositivo: string; en: string }

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

  const activa = () => carpeta && estado.tipo === 'activa' ? carpeta : null;

  async function leerMarca(c: Fs, id: string): Promise<Marca | null> {
    try {
      const m = JSON.parse((await c.read(marcaDe(id))) ?? 'null');
      return m && typeof m.en === 'string' ? m : null;
    } catch { return null; }
  }

  /** datos.json de un perfil a la carpeta, salvo que otro dispositivo la haya cambiado sin que este lo sepa. */
  async function copiarDatos(c: Fs, id: string) {
    const m = await leerMarca(c, id);
    if (m && m.dispositivo !== dispositivo && m.en !== (await kv.get<string>(`visto:${id}`))) {
      conflictos.add(id);
      avisar();
      return;
    }
    const data = await local.read(datosDe(id));
    if (data == null) return;
    await c.write(datosDe(id), data);
    subidoEn.set(datosDe(id), reloj());
    const en = ahora();
    await c.write(marcaDe(id), JSON.stringify({ dispositivo, en } satisfies Marca));
    await kv.set(`visto:${id}`, en);
    await kv.del(`pendiente:${id}`);
    if (estado.tipo === 'activa') { estado = { ...estado, ultima: en }; avisar(); }
  }

  async function copiar(c: Fs, path: string) {
    const id = DATOS.exec(path)?.[1];
    if (id) return copiarDatos(c, id);
    if (path === PERFILES) return copiarPerfiles(c);
    const data = await local.read(path);
    if (data == null) await c.remove(path);
    else await c.write(path, data);
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

  async function despues(path: string) {
    const id = DATOS.exec(path)?.[1];
    if (id) await kv.set(`pendiente:${id}`, true);
    programar(path);
  }

  /** El `Fs` que usa `profileStore`: lee y escribe en el navegador y copia en la carpeta. */
  const fs: Fs = {
    read: p => local.read(p),
    list: p => local.list(p),
    async write(p, d) {
      if (congelado && (deLosPerfiles(p) || deLosPerfiles(p.replace(/\.tmp$/, '')))) return;
      await local.write(p, d);
      // Los temporales de la escritura segura no salen: se copia el archivo ya renombrado
      if (!p.endsWith('.tmp')) await despues(p);
    },
    async rename(from, to) {
      if (congelado && deLosPerfiles(to)) return;
      await local.rename(from, to);
      await despues(to);
    },
    async remove(p) {
      await local.remove(p);
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

  async function traer(c: Fs, id: string, m: Marca | null) {
    const data = await c.read(datosDe(id));
    if (data == null) return false;
    await local.write(datosDe(id), data);
    if (m) await kv.set(`visto:${id}`, m.en);
    await kv.del(`pendiente:${id}`);
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
        const pendiente = await kv.get<boolean>(`pendiente:${id}`);
        if (!pendiente || (await local.read(datosDe(id))) == null) {
          if (opts.congelar) congelado = true;
          if (await traer(c, id, m)) cargados++;
        } else {
          conflictos.add(id);
        }
      }
      // Con lo que acaba de leerse: no se vuelve a bajar `perfiles.json` para ver si hay algo que subir
      enCola(() => copiarPerfiles(c, leido));
      for (const { id } of leerLista(await local.read(PERFILES))) {
        // Lo que ya tiene su cuenta atrás no se sube antes: esta comprobación se repite cada 30 s
        if (!conflictos.has(id) && !esperando.has(datosDe(id)) && (await kv.get<boolean>(`pendiente:${id}`))) enCola(() => copiarDatos(c, id));
      }
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
        for (const { id } of alli) if (await traer(c, id, await leerMarca(c, id))) traidos.add(id);
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
        if (!traidos.has(id)) await enCola(() => copiarDatos(c, id));
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
      if (con === 'carpeta') await traer(c, id, m);
      else {
        if (m) await kv.set(`visto:${id}`, m.en);
        conflictos.delete(id);
        await enCola(() => copiarDatos(c, id));
      }
      conflictos.delete(id);
      avisar();
    },
  };
}

export type Espejo = ReturnType<typeof createEspejo>;
