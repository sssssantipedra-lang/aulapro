import { describe, it, expect } from 'vitest';
import type { Section } from '../types';
import { reachableSections } from './navigation';
import { RUTAS, alVolver, entradaDeLaPagina, esRuta, guardarSalida, hashDe, leerEntrada, pantallaDeHash, pantallaPermitida, resolver } from './ruta';

const TODAS = Object.keys(RUTAS) as Section[];

function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => { datos.set(k, v); },
    removeItem: (k: string) => { datos.delete(k); },
  };
}

describe('la dirección de cada pantalla', () => {
  it('todas las pantallas de los tres menús tienen la suya, y ninguna la comparte', () => {
    for (const tipo of ['aula', 'ef', 'apoyo'] as const) {
      for (const s of reachableSections(tipo)) expect(RUTAS[s], s).toBeTruthy();
    }
    expect(new Set(Object.values(RUTAS)).size).toBe(TODAS.length);
  });

  it('son legibles: castellano en minúsculas, sin tildes, con guiones y como mucho dos tramos', () => {
    for (const r of Object.values(RUTAS)) expect(r).toMatch(/^[a-z]+(-[a-z]+)*(\/[a-z]+(-[a-z]+)*)?$/);
    expect(hashDe('notebook')).toBe('#/cuaderno');
    expect(hashDe('rubrics')).toBe('#/evaluar/rubricas');
    expect(hashDe('attendance')).toBe('#/asistencia');
    expect(hashDe('ef-pista')).toBe('#/educacion-fisica/pista');
  });

  it('las de un apartado van detrás de su portada', () => {
    expect(RUTAS.rubrics.startsWith(`${RUTAS.evaluar}/`)).toBe(true);
    expect(RUTAS.records.startsWith(`${RUTAS.documentos}/`)).toBe(true);
    expect(RUTAS.actitud.startsWith(`${RUTAS.enclase}/`)).toBe(true);
    expect(RUTAS['ef-pruebas'].startsWith(`${RUTAS['ef-inicio']}/`)).toBe(true);
  });

  it('ir y volver: de cada pantalla sale una dirección que lleva a la misma pantalla', () => {
    for (const s of TODAS) expect(pantallaDeHash(hashDe(s)), s).toBe(s);
  });

  it('en la dirección no va nada más que la pantalla: ni identificadores ni nombres', () => {
    for (const s of TODAS) expect(hashDe(s)).not.toMatch(/[0-9?=&]/);
  });
});

describe('leer una dirección', () => {
  it('sin parte «#» es el Inicio', () => {
    expect(pantallaDeHash('')).toBe('dashboard');
    expect(pantallaDeHash('#')).toBe('dashboard');
    expect(pantallaDeHash('#/')).toBe('dashboard');
    expect(pantallaDeHash('#/inicio')).toBe('dashboard');
  });

  it('perdona mayúsculas, la barra del final y lo que venga detrás de «?»', () => {
    expect(pantallaDeHash('#/Cuaderno')).toBe('notebook');
    expect(pantallaDeHash('#/cuaderno/')).toBe('notebook');
    expect(pantallaDeHash('#/evaluar/rubricas?algo=1')).toBe('rubrics');
    expect(pantallaDeHash('#/en%2Dclase')).toBe('enclase');
  });

  it('lo que no existe o no es nuestro no es ninguna pantalla', () => {
    expect(pantallaDeHash('#/no-existe')).toBeNull();
    expect(pantallaDeHash('#/evaluar/no-existe')).toBeNull();
    expect(pantallaDeHash('#cuaderno')).toBeNull();
    expect(pantallaDeHash('#access_token=abc')).toBeNull();
    expect(pantallaDeHash('#/%E0%A4%A')).toBeNull();
    expect(esRuta('#/cuaderno')).toBe(true);
    expect(esRuta('#cuaderno')).toBe(false);
    expect(esRuta('')).toBe(false);
  });
});

describe('a qué pantalla lleva en cada perfil', () => {
  it('una dirección que no existe lleva al Inicio', () => {
    expect(resolver('#/no-existe', null, 'aula')).toEqual({ section: 'dashboard' });
    expect(resolver('#otra-cosa', null, null)).toEqual({ section: 'dashboard' });
  });

  it('una pantalla que el menú del perfil no tiene lleva al Inicio', () => {
    expect(resolver('#/cuaderno', null, 'aula')).toEqual({ section: 'notebook' });
    expect(resolver('#/cuaderno', null, 'ef')).toEqual({ section: 'notebook' });
    expect(resolver('#/cuaderno', null, 'apoyo')).toEqual({ section: 'dashboard' });
    expect(resolver('#/apoyo/registro', null, 'apoyo')).toEqual({ section: 'apoyo-registro' });
    expect(resolver('#/apoyo/registro', null, 'aula')).toEqual({ section: 'dashboard' });
    expect(resolver('#/educacion-fisica/pista', null, 'ef')).toEqual({ section: 'ef-pista' });
    expect(resolver('#/educacion-fisica/pista', null, 'aula')).toEqual({ section: 'dashboard' });
    // Lo que PT y AL tiene suelto en su menú vale con la misma dirección
    expect(resolver('#/documentos/recursos', null, 'apoyo')).toEqual({ section: 'resources' });
    expect(resolver('#/en-clase/pizarra', null, 'apoyo')).toEqual({ section: 'sec-classroom' });
    expect(resolver('#/en-clase', null, 'apoyo')).toEqual({ section: 'dashboard' });
  });

  it('mientras el perfil no está cargado no se decide: se queda con la pantalla de la dirección', () => {
    expect(resolver('#/apoyo/registro', null, null)).toEqual({ section: 'apoyo-registro' });
    expect(pantallaPermitida('apoyo-registro', 'aula')).toBe('dashboard');
    expect(pantallaPermitida('apoyo-registro', 'apoyo')).toBe('apoyo-registro');
    expect(pantallaPermitida('apoyo-alumno', 'apoyo')).toBe('apoyo-alumno');
    expect(pantallaPermitida('apoyo-alumno', 'ef')).toBe('dashboard');
  });

  it('la página de un alumno de apoyo: con su entrada se abre la suya; desde un marcador, la lista', () => {
    const alumno = { alumnoId: 'alu-1', pestana: 'programa' as const };
    expect(resolver('#/apoyo/alumno', { ap: 3, alumno }, 'apoyo')).toEqual({ section: 'apoyo-alumno', alumno });
    expect(resolver('#/apoyo/alumno', { ap: 3 }, 'apoyo')).toEqual({ section: 'apoyo-alumnado' });
    expect(resolver('#/apoyo/alumno', null, 'apoyo')).toEqual({ section: 'apoyo-alumnado' });
    expect(resolver('#/apoyo/alumno', { ap: 3, alumno }, 'aula')).toEqual({ section: 'dashboard' });
    // El alumno de otra entrada no se cuela en una pantalla que no es la suya
    expect(resolver('#/apoyo/alumnado', { ap: 3, alumno }, 'apoyo')).toEqual({ section: 'apoyo-alumnado' });
  });
});

describe('el estado de una entrada del historial', () => {
  it('solo vale el nuestro y bien formado', () => {
    expect(leerEntrada(null)).toBeNull();
    expect(leerEntrada(undefined)).toBeNull();
    expect(leerEntrada('ap')).toBeNull();
    expect(leerEntrada({})).toBeNull();
    expect(leerEntrada({ ap: '2' })).toBeNull();
    expect(leerEntrada({ ap: -1 })).toBeNull();
    expect(leerEntrada({ ap: 1.5 })).toBeNull();
    expect(leerEntrada({ ap: 0 })).toEqual({ ap: 0 });
    expect(leerEntrada({ ap: 4, otra: 'cosa' })).toEqual({ ap: 4 });
  });

  it('el alumno, con su pestaña o con la primera si no se entiende', () => {
    expect(leerEntrada({ ap: 2, alumno: { alumnoId: 'alu-1', pestana: 'sesiones' } })).toEqual({ ap: 2, alumno: { alumnoId: 'alu-1', pestana: 'sesiones' } });
    expect(leerEntrada({ ap: 2, alumno: { alumnoId: 'alu-1', pestana: 'inventada' } })).toEqual({ ap: 2, alumno: { alumnoId: 'alu-1', pestana: 'resumen' } });
    expect(leerEntrada({ ap: 2, alumno: { alumnoId: 7 } })).toEqual({ ap: 2 });
    expect(leerEntrada({ ap: 2, alumno: { alumnoId: '' } })).toEqual({ ap: 2 });
  });
});

describe('atrás y adelante', () => {
  const base = { ap: 2, actual: 'notebook' as Section, tipo: 'aula' as const };

  it('atrás cambia a la pantalla de la entrada anterior, y dice cuántos pasos se ha movido', () => {
    expect(alVolver({ ...base, hash: '#/asistencia', estado: { ap: 1 } }))
      .toEqual({ hacer: 'ir', destino: { section: 'attendance' }, ap: 1, pasos: 1 });
    // Hasta la entrada del principio, que no lleva parte «#»
    expect(alVolver({ ...base, hash: '', estado: { ap: 0 } }))
      .toEqual({ hacer: 'ir', destino: { section: 'dashboard' }, ap: 0, pasos: 2 });
  });

  it('adelante, igual, con los pasos en negativo', () => {
    expect(alVolver({ ...base, hash: '#/evaluar/rubricas', estado: { ap: 3 } }))
      .toEqual({ hacer: 'ir', destino: { section: 'rubrics' }, ap: 3, pasos: -1 });
  });

  it('volver a la entrada en la que ya se estaba (tras cerrar una ventana) no hace nada', () => {
    expect(alVolver({ ...base, hash: '#/cuaderno', estado: { ap: 2 } })).toEqual({ hacer: 'nada' });
  });

  it('una dirección escrita a mano es una entrada nueva: sin orden y sin pasos que deshacer', () => {
    expect(alVolver({ ...base, hash: '#/agenda', estado: null }))
      .toEqual({ hacer: 'ir', destino: { section: 'agenda' }, ap: null, pasos: 0 });
    expect(alVolver({ ...base, hash: '#/no-existe', estado: null }))
      .toEqual({ hacer: 'ir', destino: { section: 'dashboard' }, ap: null, pasos: 0 });
  });

  it('un ancla que no es una pantalla no cambia nada', () => {
    expect(alVolver({ ...base, hash: '#sda-12', estado: null })).toEqual({ hacer: 'nada' });
  });

  it('una entrada con una pantalla que el perfil no tiene lleva al Inicio', () => {
    expect(alVolver({ ...base, tipo: 'apoyo', actual: 'apoyo-registro', hash: '#/cuaderno', estado: { ap: 1 } }))
      .toEqual({ hacer: 'ir', destino: { section: 'dashboard' }, ap: 1, pasos: 1 });
  });

  it('volver a la página de un alumno de apoyo abre la de ese alumno', () => {
    const alumno = { alumnoId: 'alu-9', pestana: 'resumen' as const };
    expect(alVolver({ ap: 4, actual: 'apoyo-registro', tipo: 'apoyo', hash: '#/apoyo/alumno', estado: { ap: 3, alumno } }))
      .toEqual({ hacer: 'ir', destino: { section: 'apoyo-alumno', alumno }, ap: 3, pasos: 1 });
  });
});

describe('ir a la página de Google o de Microsoft y volver', () => {
  it('al salir se apunta la pantalla, y al volver con «state» se recupera', () => {
    const a = almacen();
    guardarSalida('#/configuracion', a);
    expect(entradaDeLaPagina({ hash: '', search: '?code=abc&state=xyz' }, a)).toBe('#/configuracion');
    // Una sola vez
    expect(entradaDeLaPagina({ hash: '', search: '?code=abc&state=xyz' }, a)).toBe('');
  });

  it('abrir la app sin más no recupera nada: empieza por el Inicio', () => {
    const a = almacen();
    guardarSalida('#/cuaderno', a);
    expect(entradaDeLaPagina({ hash: '', search: '' }, a)).toBe('');
    expect(a.datos.size).toBe(0);
  });

  it('la dirección con la que se llega manda sobre lo apuntado', () => {
    const a = almacen();
    guardarSalida('#/cuaderno', a);
    expect(entradaDeLaPagina({ hash: '#/asistencia', search: '?state=xyz' }, a)).toBe('#/asistencia');
    expect(a.datos.size).toBe(0);
  });

  it('solo se apunta una pantalla que existe', () => {
    const a = almacen();
    guardarSalida('#/no-existe', a);
    guardarSalida('', a);
    guardarSalida('#otra-cosa', a);
    expect(a.datos.size).toBe(0);
    guardarSalida('#/cuaderno', a);
    guardarSalida('', a);
    expect(a.datos.size).toBe(0);
  });

  it('sin almacenamiento no falla', () => {
    const roto = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(() => guardarSalida('#/cuaderno', roto)).not.toThrow();
    expect(entradaDeLaPagina({ hash: '#/cuaderno', search: '' }, roto)).toBe('#/cuaderno');
    expect(entradaDeLaPagina({ hash: '', search: '?state=1' }, roto)).toBe('');
  });
});
