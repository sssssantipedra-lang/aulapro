import { describe, it, expect } from 'vitest';
import {
  MAX_COLUMNAS_TABLA, MAX_FILAS_TABLA, MAX_VINETAS, bloqueVacio, cambiarTipo, conColumnaDeTabla, conFilaDeTabla, conVineta,
  dificultadDelSiguiente, duplicarEjercicio, ejercicioVacio, fichaEnBlanco, lineasDe, pierdeAlCambiar, sinColumnaDeTabla, sinFilaDeTabla, sinVineta,
} from './fichaEnBlanco';
import { TIPOS, prepareExercise, type FichaExercise } from '../services/resources';
import { buildFichaHtml } from '../services/exportFicha';
import { HILOS } from './hilos';
import { fichaTheme } from './fichaThemes';
import type { Ficha } from '../types';

const comoFicha = (content: Ficha['content']): Ficha => ({
  id: 'f1', at: '2026-11-20T10:00:00.000Z', date: '2026-11-20', title: 'Prueba',
  request: { tema: '', area: '', nivel: '', numEjercicios: 0, niveles: false, contextoClase: '' }, content,
});

describe('ficha en blanco', () => {
  it('una ficha de ejercicios nace con los tres bloques de la escalera, de menos a más y sin ejercicios', () => {
    const c = fichaEnBlanco('ficha');
    expect(c.estilo).toBe('cuaderno');
    expect(c.formato).toBe('ficha');
    expect(c.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(c.actividades.every(a => a.ejercicios.length === 0)).toBe(true);
    expect(c.hilo).toBeUndefined();
  });

  it('respeta el título, el aspecto elegido y el hilo (solo en «Cuaderno»)', () => {
    expect(fichaEnBlanco('ficha', { titulo: '  Las plantas ', hilo: 'granja' })).toMatchObject({ titulo: 'Las plantas', hilo: 'granja' });
    const clasica = fichaEnBlanco('ficha', { estilo: 'clasico', hilo: 'granja' });
    expect(clasica.estilo).toBe('clasico');
    expect(clasica.hilo).toBeUndefined();
    expect(fichaEnBlanco('ficha', { estilo: 'auto' }).estilo).toBe('cuaderno');
  });

  it('un aspecto con historia trae su historia por escribir', () => {
    const conHistoria = fichaEnBlanco('ficha', { estilo: 'espacio' });
    expect(fichaTheme(conHistoria.estilo).historia).toBe(true);
    expect(conHistoria.historia).toMatchObject({ personaje: '', mision: '', cierre: '', insignia: '' });
    expect(conHistoria.historia?.emoji).toBeTruthy();
  });

  it('un escape room son tres salas con candado y un mundo con historia, aunque el aspecto elegido no la tenga', () => {
    const c = fichaEnBlanco('escape', { estilo: 'cuaderno' });
    expect(c.formato).toBe('escape');
    expect(fichaTheme(c.estilo).historia).toBe(true);
    expect(c.historia).toBeDefined();
    expect(c.actividades).toHaveLength(3);
    expect(c.actividades.every(a => a.candado && a.candado.codigo === '')).toBe(true);
  });

  it('la comprensión lectora trae un texto con un párrafo por escribir', () => {
    const c = fichaEnBlanco('lectura', { generoLectura: 'poema' });
    expect(c.lectura).toEqual({ genero: 'poema', parrafos: [''], dibujos: [] });
    expect(fichaEnBlanco('lectura', { generoLectura: 'auto' }).lectura?.genero).toBe('cuento');
    expect(c.actividades).toHaveLength(3);
  });

  it('las tarjetas son un mazo con una tarjeta por rellenar, recortable o interactiva', () => {
    const r = fichaEnBlanco('tarjetas');
    expect(r).toMatchObject({ formato: 'tarjetas', tarjetas: [{ pregunta: '', respuesta: '' }], actividades: [] });
    expect(r.interactivas).toBeUndefined();
    const i = fichaEnBlanco('interactivas');
    expect(i.interactivas).toBe(true);
    expect(i.tarjetasInteractivas).toHaveLength(1);
  });

  it('el bloque que se añade al final sigue la escalera', () => {
    expect(dificultadDelSiguiente([])).toBe(1);
    expect(dificultadDelSiguiente([{ dificultad: 1 }])).toBe(2);
    expect(dificultadDelSiguiente([{ dificultad: 2 }, { dificultad: 3 }])).toBe(3);
    expect(dificultadDelSiguiente([{}])).toBeUndefined();
    expect(bloqueVacio(2)).toEqual({ titulo: '', dificultad: 2, ejercicios: [] });
    expect(bloqueVacio()).toEqual({ titulo: '', ejercicios: [] });
  });
});

describe('ejercicio vacío', () => {
  const hilo = HILOS.find(h => h.id === 'granja') ?? HILOS[0];

  it('cada tipo nace con su tipo, con enunciado y solución de texto, y sobrevive a prepareExercise', () => {
    for (const tipo of TIPOS) {
      const ex = prepareExercise(ejercicioVacio(tipo, { hilo }));
      expect(ex.tipo, tipo).toBe(tipo);
      expect(typeof ex.enunciado, tipo).toBe('string');
      expect(typeof ex.solucion, tipo).toBe('string');
    }
  });

  it('cada tipo vacío se pinta en la hoja «Cuaderno» y en la clásica sin romperse ni dejar «undefined»', () => {
    for (const estilo of ['cuaderno', 'clasico'] as const) {
      for (const tipo of TIPOS) {
        const c = fichaEnBlanco('ficha', { estilo, hilo: hilo.id });
        c.actividades[0].ejercicios = [prepareExercise(ejercicioVacio(tipo, { hilo }))];
        const html = buildFichaHtml(comoFicha(c), 'es', { preview: true });
        expect(html, `${estilo}/${tipo}`).toContain('data-ex="0-0"');
        expect(html, `${estilo}/${tipo}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('la tabla nace con filas y columnas, y el cómic con tres bocadillos vacíos', () => {
    const tabla = ejercicioVacio('tabla_rellenar');
    expect(tabla.columnas).toHaveLength(3);
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas!.every(f => f.length === 3)).toBe(true);
    const comic = ejercicioVacio('comic');
    expect(comic.vinetas).toHaveLength(3);
    expect(comic.vinetas!.every(v => v.texto === '' && v.personaje)).toBe(true);
  });

  it('las fracciones nacen con sus pizzas y su solución calculada', () => {
    const ex = ejercicioVacio('fracciones', { lang: 'es' });
    expect(ex.fracciones!.length).toBeGreaterThanOrEqual(3);
    expect(ex.solucion).toMatch(/A: \d+\/\d+/);
    expect(ex.enunciado).not.toBe('');
  });

  it('con hilo, «contar» y «etiquetar» nacen con dibujos del hilo; sin hilo, vacíos', () => {
    const contar = ejercicioVacio('contar', { hilo });
    expect(contar.dibujos?.length).toBeGreaterThanOrEqual(2);
    expect(contar.solucion).not.toBe('');
    expect(ejercicioVacio('contar').dibujos).toBeUndefined();
    expect(ejercicioVacio('clasificar').categorias).toHaveLength(2);
  });
});

describe('cambiar de tipo', () => {
  const vf: FichaExercise = { tipo: 'verdadero_falso', enunciado: 'Marca V o F.', afirmaciones: ['El sol es una estrella', ' ', 'La luna es un planeta'], solucion: '1 V; 2 F', apoyo: 'Con ayuda' };

  it('conserva el enunciado, la solución y las variantes, y pasa las líneas al tipo nuevo', () => {
    const om = cambiarTipo(vf, 'opcion_multiple');
    expect(om).toMatchObject({ tipo: 'opcion_multiple', enunciado: 'Marca V o F.', solucion: '1 V; 2 F', apoyo: 'Con ayuda' });
    expect(om.opciones).toEqual(['El sol es una estrella', 'La luna es un planeta']);
    expect(om.afirmaciones).toBeUndefined();
  });

  it('al mismo tipo devuelve el mismo ejercicio', () => {
    expect(cambiarTipo(vf, 'verdadero_falso')).toBe(vf);
  });

  it('a «ordenar» deja las líneas como orden correcto y, tras prepararlo, salen barajadas', () => {
    const ord = prepareExercise(cambiarTipo(vf, 'ordenar'));
    expect(ord.ordenCorrecto).toEqual(['El sol es una estrella', 'La luna es un planeta']);
    expect([...ord.elementos!].sort()).toEqual([...ord.ordenCorrecto!].sort());
    expect(ord.elementos).not.toEqual(ord.ordenCorrecto);
  });

  it('de una lista de palabras sale una sopa con su rejilla, y de la sopa un crucigrama con las mismas palabras', () => {
    const lista: FichaExercise = { tipo: 'opcion_multiple', enunciado: 'Elige.', opciones: ['raíz', 'tallo', 'hoja', 'flor'], solucion: '' };
    const sopa = prepareExercise(cambiarTipo(lista, 'sopa_letras'));
    expect(sopa.palabras).toEqual(['RAÍZ', 'TALLO', 'HOJA', 'FLOR']);
    expect(sopa.rejilla!.length).toBeGreaterThanOrEqual(10);
    const cruci = cambiarTipo(sopa, 'crucigrama');
    expect(cruci.pistas).toEqual(['RAÍZ', 'TALLO', 'HOJA', 'FLOR'].map(palabra => ({ palabra, pista: '' })));
    expect(cruci.rejilla).toBeUndefined();
    expect(cruci.posiciones).toBeUndefined();
  });

  it('«ordenar» pasa su orden correcto, no el barajado', () => {
    const ord: FichaExercise = { tipo: 'ordenar', enunciado: '', elementos: ['c', 'a', 'b'], ordenCorrecto: ['a', 'b', 'c'], solucion: '' };
    expect(lineasDe(ord)).toEqual(['a', 'b', 'c']);
    expect(cambiarTipo(ord, 'contestar').preguntas).toEqual(['a', 'b', 'c']);
  });

  it('a un tipo sin lista (problema, abierta) se queda con el enunciado y la solución', () => {
    const p = cambiarTipo(vf, 'problema');
    expect(p).toEqual({ tipo: 'problema', enunciado: 'Marca V o F.', solucion: '1 V; 2 F', apoyo: 'Con ayuda' });
  });

  it('a «fracciones» manda el enunciado y la solución calculados', () => {
    const fr = cambiarTipo(vf, 'fracciones', { lang: 'es' });
    expect(fr.enunciado).toMatch(/pizza/);
    expect(fr.solucion).toMatch(/A: /);
    expect(fr.fracciones!.length).toBeGreaterThanOrEqual(3);
  });

  it('avisa de lo que se pierde: la tabla, las viñetas escritas, la columna derecha, las pistas y los dibujos', () => {
    expect(pierdeAlCambiar(vf)).toBe(false);
    expect(pierdeAlCambiar(ejercicioVacio('tabla_rellenar'))).toBe(false);
    expect(pierdeAlCambiar({ ...ejercicioVacio('tabla_rellenar'), columnas: ['Base', '', ''] })).toBe(true);
    expect(pierdeAlCambiar(ejercicioVacio('comic'))).toBe(false);
    expect(pierdeAlCambiar({ tipo: 'comic', enunciado: '', solucion: '', vinetas: [{ personaje: '🙂', texto: 'Hola' }] })).toBe(true);
    expect(pierdeAlCambiar({ tipo: 'relacionar', enunciado: '', solucion: '', izquierda: ['a'], derecha: ['1'] })).toBe(true);
    expect(pierdeAlCambiar({ tipo: 'crucigrama', enunciado: '', solucion: '', pistas: [{ palabra: 'sol', pista: 'estrella' }] })).toBe(true);
    expect(pierdeAlCambiar(ejercicioVacio('fracciones'))).toBe(true);
  });
});

describe('duplicar, tablas y cómics', () => {
  it('la copia es igual y no comparte nada con el original', () => {
    const ex = prepareExercise({ tipo: 'sopa_letras', enunciado: 'Busca.', palabras: ['sol', 'luna', 'mar'], solucion: '' });
    const copia = duplicarEjercicio(ex);
    expect(copia).toEqual(ex);
    copia.rejilla![0][0] = '#';
    copia.palabras!.push('X');
    expect(ex.rejilla![0][0]).not.toBe('#');
    expect(ex.palabras).toHaveLength(3);
  });

  it('se añaden y se quitan filas y columnas sin descuadrar la tabla, con topes', () => {
    let t = ejercicioVacio('tabla_rellenar');
    t = conFilaDeTabla(conColumnaDeTabla(t));
    expect(t.columnas).toHaveLength(4);
    expect(t.filas).toHaveLength(4);
    expect(t.filas!.every(f => f.length === 4)).toBe(true);
    t = sinFilaDeTabla(sinColumnaDeTabla(t));
    expect(t.columnas).toHaveLength(3);
    expect(t.filas!.every(f => f.length === 3)).toBe(true);
    for (let i = 0; i < 30; i++) t = conFilaDeTabla(conColumnaDeTabla(t));
    expect(t.filas).toHaveLength(MAX_FILAS_TABLA);
    expect(t.columnas).toHaveLength(MAX_COLUMNAS_TABLA);
    for (let i = 0; i < 30; i++) t = sinFilaDeTabla(sinColumnaDeTabla(t));
    expect(t.filas).toHaveLength(1);
    expect(t.columnas).toHaveLength(2);
  });

  it('al quitar una fila se va también su dibujo', () => {
    const t: FichaExercise = { ...ejercicioVacio('tabla_rellenar'), dibujos: [{ ilustracion: 'a' }, { ilustracion: 'b' }, { ilustracion: 'c' }] };
    expect(sinFilaDeTabla(t).dibujos).toHaveLength(2);
  });

  it('un cómic tiene entre dos y cuatro viñetas', () => {
    let c = ejercicioVacio('comic');
    c = conVineta(conVineta(conVineta(c)));
    expect(c.vinetas).toHaveLength(MAX_VINETAS);
    c = sinVineta(sinVineta(sinVineta(sinVineta(c, 0), 0), 0), 0);
    expect(c.vinetas).toHaveLength(2);
  });
});
