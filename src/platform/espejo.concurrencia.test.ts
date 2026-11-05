/**
 * Auditoría del 5-11-2026: pérdida o sobrescritura del trabajo con dos dispositivos, cortes a mitad de una subida,
 * cierre de la pestaña en pleno guardado y relojes desajustados. Cada prueba simula el fallo con un sistema de archivos
 * en memoria al que se le puede parar una operación (`gate`) o hacer que falle una vez.
 */
import { describe, it, expect } from 'vitest';
import { createEspejo, huellaDeDatos, type Marca } from './espejo';
import { createProfileStore, type Fs } from './profileStore';
import type { Kv } from './webFs';

type Archivo = { data: string; mtime: number };

/** Un sistema de archivos en memoria con un registro de operaciones y puertas para parar una operación concreta. */
function memoryFs() {
  const files = new Map<string, Archivo>();
  const registro: string[] = [];
  /** Antes de la operación `op` sobre `path`, se espera a esta promesa (una sola vez). */
  const puertas = new Map<string, Promise<void>>();
  /** La operación `op` sobre `path` falla (una sola vez) con este error. */
  const fallos = new Map<string, Error>();
  let clock = 1_000;
  const veces = new Map<string, number>();
  const paso = async (op: string, path: string) => {
    registro.push(`${op} ${path}`);
    const clave = `${op} ${path}`;
    const vez = (veces.get(clave) ?? 0) + 1;
    veces.set(clave, vez);
    const puerta = puertas.get(`${clave}#${vez}`) ?? puertas.get(clave);
    if (puerta) { puertas.delete(`${clave}#${vez}`); puertas.delete(clave); await puerta; }
    const fallo = fallos.get(clave);
    if (fallo) { fallos.delete(clave); throw fallo; }
  };
  const fs: Fs = {
    read: async p => { await paso('read', p); return files.get(p)?.data ?? null; },
    write: async (p, data) => { await paso('write', p); files.set(p, { data, mtime: clock++ }); },
    rename: async (from, to) => {
      await paso('rename', to);
      const f = files.get(from);
      if (!f) throw new Error('no existe ' + from);
      files.delete(from);
      files.set(to, f);
    },
    remove: async p => { await paso('remove', p); files.delete(p); },
    removeDir: async p => { for (const k of [...files.keys()]) if (k.startsWith(p + '/')) files.delete(k); },
    list: async dir => {
      const out = new Map<string, { name: string; type: 'file' | 'directory'; size: number; mtime: number }>();
      for (const [k, v] of files) {
        if (!k.startsWith(dir + '/')) continue;
        const [name, ...more] = k.slice(dir.length + 1).split('/');
        out.set(name, more.length ? { name, type: 'directory', size: 0, mtime: 0 } : { name, type: 'file', size: v.data.length, mtime: v.mtime });
      }
      return [...out.values()];
    },
  };
  /** Para la operación (la siguiente, o la vez `vez` desde el principio) hasta que se llame a lo que devuelve. */
  const parar = (op: string, path: string, vez?: number) => {
    let abrir!: () => void;
    puertas.set(`${op} ${path}${vez ? `#${vez}` : ''}`, new Promise<void>(r => { abrir = r; }));
    return abrir;
  };
  const fallar = (op: string, path: string, err = new TypeError('Failed to fetch')) => { fallos.set(`${op} ${path}`, err); };
  return { fs, files, registro, parar, fallar };
}

function memoryKv() {
  const m = new Map<string, unknown>();
  const registro: string[] = [];
  const kv: Kv = {
    get: async <T,>(k: string) => m.get(k) as T | undefined,
    set: async (k, v) => { registro.push(`set ${k}`); m.set(k, v); },
    del: async k => { registro.push(`del ${k}`); m.delete(k); },
  };
  return { kv, m, registro };
}

let reloj = 0;
const ahora = () => new Date(Date.UTC(2026, 10, 1, 0, 0, reloj++)).toISOString();

function dispositivo(nombre: string, opts: { ahora?: () => string; local?: ReturnType<typeof memoryFs>; kv?: ReturnType<typeof memoryKv> } = {}) {
  const local = opts.local ?? memoryFs();
  const kv = opts.kv ?? memoryKv();
  const espejo = createEspejo({ local: local.fs, kv: kv.kv, dispositivo: nombre, ahora: opts.ahora ?? ahora, pausa: 10_000 });
  const store = createProfileStore(espejo.fs);
  return { local, kv, espejo, store };
}

const leer = async (fs: Fs, p: string) => JSON.parse((await fs.read(p)) ?? 'null');
const datosDe = (id: string) => `AulaPro/perfiles/${id}/datos.json`;
const marcaDe = (id: string) => `AulaPro/perfiles/${id}/guardado.json`;
const tick = () => new Promise(r => setTimeout(r, 0));

/** Un dispositivo con un perfil con datos ya copiados en la carpeta. */
async function conPerfil(nombre: string, carpeta: ReturnType<typeof memoryFs>, datos: unknown = { classes: [{ id: 'c1' }] }) {
  const d = dispositivo(nombre);
  await d.espejo.conectar(carpeta.fs, 'Google Drive');
  const p = await d.store.createProfile({ name: 'Profesor' });
  await d.store.saveData(p.id, datos);
  await d.espejo.vaciar();
  return { ...d, p };
}

describe('dos dispositivos editando a la vez', () => {
  it('un cambio guardado mientras se está subiendo no se da por subido: se sube al volver a abrir', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    // La subida de v2 se queda parada en la escritura de datos.json (una red lenta)
    const abrir = carpeta.parar('write', datosDe(a.p.id));
    await a.store.saveData(a.p.id, { v: 2 });
    const subida = a.espejo.vaciar();
    await tick(); await tick();
    // Mientras tanto el docente sigue escribiendo
    await a.store.saveData(a.p.id, { v: 3 });
    abrir();
    await subida;
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 2 });
    // v3 sigue pendiente: al abrir la app otra vez (sin que quedara nada en la cola) se sube
    expect(await a.kv.kv.get(`pendiente:${a.p.id}`)).toBe(true);
    const otraVez = dispositivo('A', { local: a.local, kv: a.kv });
    await otraVez.espejo.activar(carpeta.fs, 'Google Drive', { congelar: true });
    await otraVez.espejo.vaciar();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 3 });
  });

  it('las dos subidas se cruzan (datos A, datos B, marca B, marca A): nadie pierde sin que se le pregunte', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    const b = dispositivo('B');
    expect((await b.espejo.conectar(carpeta.fs, 'Google Drive')).cargados).toBe(1);
    // Los dos cambian a la vez
    await a.store.saveData(a.p.id, { v: 'A' });
    await b.store.saveData(a.p.id, { v: 'B' });
    // A escribe datos.json y, antes de firmar la marca, vuelve a mirar la de la carpeta: ahí se queda parada
    // (una red lenta), y B hace su subida entera mientras tanto. Lecturas de la marca en la carpeta hasta aquí: las
    // dos de la primera subida de A, la de conectar B, la primera de esta subida y esta segunda
    const abrirA = carpeta.parar('read', marcaDe(a.p.id), 5);
    const subidaA = a.espejo.vaciar();
    await tick(); await tick(); await tick();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 'A' });
    await b.espejo.vaciar();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 'B' });
    abrirA();
    await subidaA;
    // La carpeta queda coherente (datos y marca del mismo dispositivo)...
    const m: Marca = await leer(carpeta.fs, marcaDe(a.p.id));
    expect(m.dispositivo).toBe('B');
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 'B' });
    // ...y A no da su trabajo por subido: lo tiene como conflicto, para que el docente elija
    expect(a.espejo.conflictos()).toEqual([a.p.id]);
    expect(await a.kv.kv.get(`pendiente:${a.p.id}`)).toBe(true);
    expect(await leer(a.local.fs, datosDe(a.p.id))).toEqual({ v: 'A' });
    // Al comprobar, A sigue sin pisar lo suyo con lo de B
    await a.espejo.comprobar({ congelar: true });
    expect(await leer(a.local.fs, datosDe(a.p.id))).toEqual({ v: 'A' });
  });

  it('la marca lleva una huella de los datos: si la carpeta sincronizada trae la marca antes que los datos, se espera', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    const b = dispositivo('B');
    expect((await b.espejo.conectar(carpeta.fs, 'OneDrive')).cargados).toBe(1);
    // A sube v2; el programa de OneDrive del ordenador de B trae primero guardado.json y después datos.json
    await a.store.saveData(a.p.id, { v: 2 });
    await a.espejo.vaciar();
    const datosNuevos = carpeta.files.get(datosDe(a.p.id))!;
    carpeta.files.set(datosDe(a.p.id), { data: JSON.stringify({ v: 1 }), mtime: 1 });
    expect(await b.espejo.comprobar({ congelar: true })).toBe(0);
    expect(b.espejo.congelado()).toBe(false);
    // Cuando llega datos.json, se trae
    carpeta.files.set(datosDe(a.p.id), datosNuevos);
    expect(await b.espejo.comprobar({ congelar: true })).toBe(1);
    expect(await leer(b.local.fs, datosDe(a.p.id))).toEqual({ v: 2 });
  });

  it('mientras se traía lo de otro dispositivo, la app guardó aquí: no se pisa, queda como conflicto', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    const b = dispositivo('B');
    expect((await b.espejo.conectar(carpeta.fs, 'Google Drive')).cargados).toBe(1);
    await a.store.saveData(a.p.id, { v: 2 });
    await a.espejo.vaciar();
    // B está bajando v2 (lento) y en ese momento el docente guarda en B
    const abrir = carpeta.parar('read', datosDe(a.p.id));
    const bajada = b.espejo.comprobar({ congelar: true });
    await tick(); await tick(); await tick();
    await b.store.saveData(a.p.id, { v: 'B' });
    abrir();
    expect(await bajada).toBe(0);
    expect(await leer(b.local.fs, datosDe(a.p.id))).toEqual({ v: 'B' });
    expect(b.espejo.conflictos()).toEqual([a.p.id]);
    expect(b.espejo.congelado()).toBe(false);
  });

  it('con el reloj de un dispositivo atrasado, los cambios se siguen viendo y los conflictos se siguen detectando', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    // El reloj de B va un año atrás
    let atras = 0;
    const b = dispositivo('B', { ahora: () => new Date(Date.UTC(2025, 0, 1, 0, 0, atras++)).toISOString() });
    expect((await b.espejo.conectar(carpeta.fs, 'Google Drive')).cargados).toBe(1);
    await b.store.saveData(a.p.id, { v: 2 });
    await b.espejo.vaciar();
    // A ve lo de B aunque su marca sea «más antigua» que la suya
    expect(await a.espejo.comprobar({ congelar: true })).toBe(1);
    expect(await leer(a.local.fs, datosDe(a.p.id))).toEqual({ v: 2 });
    // Y si los dos cambian, conflicto, sea cual sea el reloj
    const a2 = dispositivo('A', { local: a.local, kv: a.kv });
    await a2.espejo.activar(carpeta.fs, 'Google Drive');
    await a2.store.saveData(a.p.id, { v: 3 });
    await b.store.saveData(a.p.id, { v: 4 });
    await b.espejo.vaciar();
    await a2.espejo.vaciar();
    expect(a2.espejo.conflictos()).toEqual([a.p.id]);
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 4 });
  });
});

describe('cierre de la pestaña en pleno guardado', () => {
  it('el perfil se marca como pendiente de subir ANTES de escribir datos.json: si la pestaña muere entre medias, no se olvida', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    a.local.registro.length = 0; a.kv.registro.length = 0;
    const orden: string[] = [];
    const localWrite = a.local.fs.rename;
    a.local.fs.rename = async (from, to) => { orden.push('rename'); return localWrite(from, to); };
    const kvSet = a.kv.kv.set;
    a.kv.kv.set = async (k, v) => { if (k.startsWith('pendiente:')) orden.push('pendiente'); return kvSet(k, v); };
    await a.store.saveData(a.p.id, { v: 2 });
    expect(orden).toEqual(['pendiente', 'rename']);
  });

  it('una copia «antes-de-restaurar» que no llegó a subir antes de recargar sube al abrir la app', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    await a.store.backup(a.p.id);
    const copia = (await a.store.listBackups(a.p.id))[0].file;
    await a.store.saveData(a.p.id, { v: 2 });
    expect(await a.store.restoreBackup(a.p.id, copia)).toBe(true);
    // La app se recarga sin dar tiempo a la cola: la copia de seguridad de lo de ahora no está en la carpeta
    const antes = [...carpeta.files.keys()].filter(k => k.includes('antes-de-restaurar'));
    expect(antes).toEqual([]);
    const otraVez = dispositivo('A', { local: a.local, kv: a.kv });
    await otraVez.espejo.activar(carpeta.fs, 'Google Drive', { congelar: true });
    await otraVez.espejo.vaciar();
    expect([...carpeta.files.keys()].filter(k => k.includes('antes-de-restaurar'))).toHaveLength(1);
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 1 });
  });
});

describe('cortes de red', () => {
  it('un fallo pasajero al copiar no deja la carpeta muerta: se avisa y se vuelve a intentar en la siguiente comprobación', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    carpeta.fallar('write', datosDe(a.p.id));
    await a.store.saveData(a.p.id, { v: 2 });
    await a.espejo.vaciar();
    expect(a.espejo.estado()).toMatchObject({ tipo: 'error', mensaje: 'Failed to fetch' });
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 1 });
    // Vuelve la red: la comprobación periódica sube lo pendiente y la carpeta vuelve a estar activa
    await a.espejo.comprobar();
    await a.espejo.vaciar();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 2 });
    expect(a.espejo.estado()).toMatchObject({ tipo: 'activa' });
  });

  it('sin permiso sí se para: hasta que el docente vuelva a darlo', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    carpeta.fallar('write', datosDe(a.p.id), new DOMException('drive', 'NotAllowedError'));
    await a.store.saveData(a.p.id, { v: 2 });
    await a.espejo.vaciar();
    expect(a.espejo.estado()).toMatchObject({ tipo: 'sin-permiso' });
    await a.espejo.comprobar();
    await a.espejo.vaciar();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 1 });
    expect(await a.kv.kv.get(`pendiente:${a.p.id}`)).toBe(true);
    await a.espejo.activar(carpeta.fs, 'Google Drive', { congelar: true });
    await a.espejo.vaciar();
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ v: 2 });
  });
});

describe('conflictos con una copia vacía (vacios)', () => {
  const VACIO = { classes: [], students: [], grades: {}, auditLog: [{ id: 'x' }] };

  it('«allí vacío» deja de serlo cuando el otro dispositivo sube datos de verdad: ya no se dice que la nube está vacía', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta);
    const b = dispositivo('B');
    expect((await b.espejo.conectar(carpeta.fs, 'OneDrive')).cargados).toBe(1);
    // En la carpeta aparece un perfil vacío firmado por B (su navegador falló y algo lo subió sin la comprobación)
    await carpeta.fs.write(datosDe(a.p.id), JSON.stringify(VACIO));
    await carpeta.fs.write(marcaDe(a.p.id), JSON.stringify({ dispositivo: 'B', en: ahora(), huella: huellaDeDatos(JSON.stringify(VACIO)) }));
    expect(await a.espejo.comprobar({ congelar: true })).toBe(0);
    expect(a.espejo.vacios()).toEqual({ [a.p.id]: 'alli' });
    // A sigue trabajando; B se recupera y sube datos reales
    await a.store.saveData(a.p.id, { classes: [{ id: 'c1' }, { id: 'c2' }] });
    await b.store.saveData(a.p.id, { classes: [{ id: 'deB' }] });
    await b.espejo.vaciar();
    await a.espejo.comprobar({ congelar: true });
    expect(a.espejo.conflictos()).toEqual([a.p.id]);
    expect(a.espejo.vacios()).toEqual({});
    // Si A elige «quedarme con el de aquí», sube lo suyo (lo ha elegido); si eligiera la carpeta, no se le habría dicho que está vacía
    await a.espejo.resolver(a.p.id, 'local');
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ classes: [{ id: 'c1' }, { id: 'c2' }] });
  });

  it('«aquí vacío» se resuelve solo cuando aquí vuelve a haber datos (y la nube no ha cambiado)', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta);
    await a.store.saveData(a.p.id, VACIO);
    await a.espejo.vaciar();
    expect(a.espejo.vacios()).toEqual({ [a.p.id]: 'aqui' });
    await a.store.saveData(a.p.id, { classes: [{ id: 'nueva' }] });
    await a.espejo.vaciar();
    expect(a.espejo.conflictos()).toEqual([]);
    expect(a.espejo.vacios()).toEqual({});
    expect(await leer(carpeta.fs, datosDe(a.p.id))).toEqual({ classes: [{ id: 'nueva' }] });
  });

  it('elegir «usar el de la carpeta» congela el guardado: lo que la app tenía en memoria no vuelve a escribirse antes de recargar', async () => {
    const carpeta = memoryFs();
    const a = await conPerfil('A', carpeta, { v: 1 });
    const b = dispositivo('B');
    expect((await b.espejo.conectar(carpeta.fs, 'Google Drive')).cargados).toBe(1);
    await b.store.saveData(a.p.id, { v: 'B' });
    await b.espejo.vaciar();
    await a.store.saveData(a.p.id, { v: 'A' });
    await a.espejo.vaciar();
    expect(a.espejo.conflictos()).toEqual([a.p.id]);
    await a.espejo.resolver(a.p.id, 'carpeta');
    expect(await leer(a.local.fs, datosDe(a.p.id))).toEqual({ v: 'B' });
    // El guardado automático (o `volcar` al recargar) intenta escribir lo que tenía en pantalla
    await a.store.saveData(a.p.id, { v: 'A' });
    expect(await leer(a.local.fs, datosDe(a.p.id))).toEqual({ v: 'B' });
    expect(a.espejo.congelado()).toBe(true);
  });
});

describe('huella de los datos', () => {
  it('cambia con el contenido y lleva la longitud', () => {
    expect(huellaDeDatos('{"v":1}')).not.toBe(huellaDeDatos('{"v":2}'));
    expect(huellaDeDatos('{"v":1}')).toBe(huellaDeDatos('{"v":1}'));
    expect(huellaDeDatos('{"v":1}').startsWith('7:')).toBe(true);
  });
});
