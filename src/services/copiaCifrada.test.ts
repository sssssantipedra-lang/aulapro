import { describe, it, expect } from 'vitest';
import {
  cifrarCopia, descifrarCopia, esCopiaCifrada, generarContrasena, normalizarContrasena,
  contrasenaValida, CopiaError, type ContenidoCompartido, type CopiaCifrada,
} from './copiaCifrada';
import { emptyBundle } from './paquete';

const contenido = (): ContenidoCompartido => ({
  de: 'Profesor',
  creado: '2026-10-25T12:00:00.000Z',
  paquete: {
    ...emptyBundle(),
    classes: [{ id: 'c1', name: '5.º A', subject: 'Mates', subjects: ['Mates'], room: 'A1', color: '#000' }],
    students: [{ id: 's1', class_id: 'c1', name: 'Alumno 1', email: '', photo: null, alerts: [], notes: 'ñandú ✓' }],
    grades: { i1: { s1: 8.5 } },
  },
});

const CLAVE = 'ABCD-EFGH-JKMN-PQRS';

async function falla(p: Promise<unknown>) {
  try { await p; } catch (e) { return (e as CopiaError).codigo; }
  return null;
}

describe('copia cifrada', () => {
  it('descifra lo que cifró, con acentos y símbolos incluidos', async () => {
    const texto = await cifrarCopia(contenido(), CLAVE);
    const fuera = await descifrarCopia(texto, CLAVE);
    expect(fuera).toEqual(contenido());
  });

  it('el archivo no deja ver ni un dato en claro', async () => {
    const texto = await cifrarCopia(contenido(), CLAVE);
    expect(esCopiaCifrada(texto)).toBe(true);
    for (const claro of ['Alumno 1', '5.º A', 'Mates', 'ñandú', 'Profesor', '8.5']) {
      expect(texto).not.toContain(claro);
    }
  });

  it('dos copias del mismo contenido no se parecen (sal y vector al azar)', async () => {
    const a = JSON.parse(await cifrarCopia(contenido(), CLAVE)) as CopiaCifrada;
    const b = JSON.parse(await cifrarCopia(contenido(), CLAVE)) as CopiaCifrada;
    expect(a.sal).not.toBe(b.sal);
    expect(a.iv).not.toBe(b.iv);
    expect(a.datos).not.toBe(b.datos);
  });

  it('con otra contraseña no abre', async () => {
    const texto = await cifrarCopia(contenido(), CLAVE);
    expect(await falla(descifrarCopia(texto, 'otra contraseña distinta'))).toBe('contrasena');
  });

  it('un archivo modificado no abre, ni con la contraseña buena', async () => {
    const copia = JSON.parse(await cifrarCopia(contenido(), CLAVE)) as CopiaCifrada;
    const bytes = atob(copia.datos).split('');
    bytes[5] = String.fromCharCode(bytes[5].charCodeAt(0) ^ 1);
    copia.datos = btoa(bytes.join(''));
    expect(await falla(descifrarCopia(JSON.stringify(copia), CLAVE))).toBe('contrasena');
  });

  it('cambiar los parámetros de la cabecera tampoco abre', async () => {
    const copia = JSON.parse(await cifrarCopia(contenido(), CLAVE)) as CopiaCifrada;
    copia.iter = copia.iter + 1;
    expect(await falla(descifrarCopia(JSON.stringify(copia), CLAVE))).toBe('contrasena');
  });

  it('rechaza lo que no es una copia de AulaPro', async () => {
    expect(await falla(descifrarCopia('hola', CLAVE))).toBe('formato');
    expect(await falla(descifrarCopia('{"_app":"AulaPro","data":{}}', CLAVE))).toBe('formato');
    expect(esCopiaCifrada('{"_app":"AulaPro","_version":2,"data":{}}')).toBe(false);
  });

  it('rechaza una versión más nueva y una cabecera hecha para colgar la app', async () => {
    const copia = JSON.parse(await cifrarCopia(contenido(), CLAVE)) as CopiaCifrada;
    expect(await falla(descifrarCopia(JSON.stringify({ ...copia, v: 99 }), CLAVE))).toBe('version');
    expect(await falla(descifrarCopia(JSON.stringify({ ...copia, iter: 2_000_000_000 }), CLAVE))).toBe('formato');
    expect(await falla(descifrarCopia(JSON.stringify({ ...copia, iter: 1 }), CLAVE))).toBe('formato');
    expect(await falla(descifrarCopia(JSON.stringify({ ...copia, sal: 'AAAA' }), CLAVE))).toBe('formato');
  });

  it('una contraseña generada vale escrita en minúsculas, sin guiones o con espacios', async () => {
    const texto = await cifrarCopia(contenido(), CLAVE);
    for (const escrita of ['abcd-efgh-jkmn-pqrs', 'ABCDEFGHJKMNPQRS', 'abcd efgh jkmn pqrs', '  ABCD-EFGH-JKMN-PQRS ']) {
      expect((await descifrarCopia(texto, escrita)).de).toBe('Profesor');
    }
  });
});

describe('contraseñas', () => {
  it('la generada tiene el formato esperado y sin símbolos que se confunden', () => {
    for (let i = 0; i < 50; i++) {
      const c = generarContrasena();
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
      expect(contrasenaValida(c)).toBe(true);
    }
  });

  it('dos generadas no se repiten', () => {
    const set = new Set(Array.from({ length: 200 }, generarContrasena));
    expect(set.size).toBe(200);
  });

  it('una escrita a mano se usa tal cual, con su mayúscula y minúscula', () => {
    expect(normalizarContrasena('  Mi contraseña larga 2026 ')).toBe('Mi contraseña larga 2026');
    expect(normalizarContrasena('hola-mundo-1234')).toBe('hola-mundo-1234');
  });

  it('exige un mínimo de largo', () => {
    expect(contrasenaValida('corta')).toBe(false);
    expect(contrasenaValida('una frase mas larga')).toBe(true);
  });
});
