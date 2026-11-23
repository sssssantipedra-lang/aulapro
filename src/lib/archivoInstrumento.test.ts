import { describe, it, expect } from 'vitest';
import {
  FORMATO_INSTRUMENTO, VERSION_INSTRUMENTO, archivoDeDiana, archivoDeRubrica, leerArchivoDeInstrumento, nombreDeArchivoDeInstrumento,
} from './archivoInstrumento';
import { NIVELES_REGISTRO } from './registro';
import type { EvalDiana, Rubric } from '../types';

const ids = () => { let n = 0; return () => `nuevo${++n}`; };

const rubrica: Rubric = {
  id: 'r1', name: 'Exposición oral', context: 'Para el grupo de 5.º B, que habla poco',
  class_id: 'c1', subject: 'Lengua', category_id: 'cat1', otras_clases: [{ class_id: 'c2', subject: 'Lengua', category_id: 'cat9' }],
  levels: [{ value: 1, label: 'Inicio' }, { value: 2, label: 'En proceso' }, { value: 3, label: 'Logrado' }],
  criteria: [
    { id: 'k1', name: 'Contenido', descriptors: { 1: 'Da datos sueltos.', 2: 'Cuenta las ideas principales.', 3: 'Explica todas las ideas.' }, competencies: ['CCL'], officialCriteria: [{ materia: 'lengua', codigo: '3.1' }] },
    { id: 'k2', name: 'Voz', descriptors: { 1: 'Cuesta oírle.', 2: 'Se le oye.', 3: 'Habla con claridad.' } },
  ],
};

const diana: EvalDiana = {
  id: 'd1', name: 'Trabajo de laboratorio', class_id: 'c1', subject: 'Física', category_id: 'cat2',
  items: [{ id: 'i1', name: 'Seguridad', weight: 2, descriptors: { 1: 'Olvida las gafas.', 4: 'Trabaja con seguridad.' }, competencies: ['STEM'] }, { id: 'i2', name: 'Medidas', weight: 1 }],
};

const escala: EvalDiana = {
  id: 'reg1', tipo: 'registro', name: 'Entrega de una tarea', class_id: 'c1', levels: NIVELES_REGISTRO,
  items: [{ id: 'i1', name: 'La entrega en la fecha acordada', weight: 1 }, { id: 'i2', name: 'La tarea está completa', weight: 1 }],
};

describe('guardar un instrumento como archivo', () => {
  it('lleva el instrumento y nada más: ni clases, ni cuaderno, ni contexto, ni identificadores', () => {
    const a = archivoDeRubrica(rubrica);
    expect(a).toMatchObject({ formato: FORMATO_INSTRUMENTO, version: VERSION_INSTRUMENTO, tipo: 'rubrica', name: 'Exposición oral' });
    const texto = JSON.stringify(a);
    for (const fuera of ['c1', 'c2', 'cat1', 'cat9', 'class_id', 'subject', 'category_id', 'otras_clases', 'context', '5.º B', 'r1', 'k1', '"id"']) {
      expect(texto, fuera).not.toContain(fuera);
    }
    expect(Object.keys(a).sort()).toEqual(['formato', 'levels', 'name', 'partes', 'tipo', 'version']);
    expect(Object.keys(JSON.parse(JSON.stringify(archivoDeDiana(diana)))).sort()).toEqual(['formato', 'name', 'partes', 'tipo', 'version']);
    expect(JSON.stringify(archivoDeDiana(escala))).not.toMatch(/c1|reg1|levels/);
  });

  it('una diana con `tipo: registro` se guarda como escala, y una diana normal, como diana', () => {
    expect(archivoDeDiana(escala).tipo).toBe('registro');
    expect(archivoDeDiana(diana).tipo).toBe('diana');
  });

  it('el nombre del archivo no lleva tildes ni signos', () => {
    expect(nombreDeArchivoDeInstrumento('Exposición oral: ¿qué tal?', 'rubrica')).toBe('aulapro-rubrica-exposicion-oral-que-tal.json');
    expect(nombreDeArchivoDeInstrumento('Hàbits de treball', 'registro')).toBe('aulapro-escala-habits-de-treball.json');
    expect(nombreDeArchivoDeInstrumento('¡¡!!', 'diana')).toBe('aulapro-diana.json');
  });
});

describe('abrir un archivo de instrumento', () => {
  it('una rúbrica vuelve igual, con identificadores nuevos y sin clase', () => {
    const r = leerArchivoDeInstrumento(JSON.stringify(archivoDeRubrica(rubrica)), ids());
    expect(r.ok && r.tipo).toBe('rubrica');
    if (!r.ok || r.tipo !== 'rubrica') return;
    expect(r.rubrica.name).toBe('Exposición oral');
    expect(r.rubrica.levels).toEqual(rubrica.levels);
    expect(r.rubrica.criteria.map(c => c.id)).toEqual(['nuevo1', 'nuevo2']);
    expect(r.rubrica.criteria.map(c => ({ ...c, id: '' }))).toEqual(rubrica.criteria.map(c => ({ ...c, id: '' })));
    expect(Object.keys(r.rubrica).sort()).toEqual(['criteria', 'levels', 'name']);
  });

  it('una diana conserva pesos y descriptores; una escala vuelve con sus dos pulgares', () => {
    const d = leerArchivoDeInstrumento(JSON.stringify(archivoDeDiana(diana)), ids());
    if (!d.ok || d.tipo !== 'diana') throw new Error('no es una diana');
    expect(d.diana.items).toEqual([
      { id: 'nuevo1', name: 'Seguridad', weight: 2, descriptors: { 1: 'Olvida las gafas.', 4: 'Trabaja con seguridad.' }, competencies: ['STEM'] },
      { id: 'nuevo2', name: 'Medidas', weight: 1 },
    ]);
    expect(d.diana.levels).toBeUndefined();

    const e = leerArchivoDeInstrumento(JSON.stringify(archivoDeDiana(escala)), ids());
    if (!e.ok || e.tipo !== 'registro') throw new Error('no es una escala');
    expect(e.diana).toMatchObject({ tipo: 'registro', levels: NIVELES_REGISTRO, name: 'Entrega de una tarea' });
    expect(e.diana.items.map(i => i.name)).toEqual(['La entrega en la fecha acordada', 'La tarea está completa']);
  });

  it('lo que no es un instrumento se rechaza diciendo por qué, sin lanzar', () => {
    expect(leerArchivoDeInstrumento('esto no es JSON', ids())).toEqual({ ok: false, motivo: 'ilegible' });
    expect(leerArchivoDeInstrumento('[1,2]', ids())).toEqual({ ok: false, motivo: 'no-es-instrumento' });
    expect(leerArchivoDeInstrumento('null', ids())).toEqual({ ok: false, motivo: 'no-es-instrumento' });
    // Una copia de datos o un paquete de «Trabajo compartido»
    expect(leerArchivoDeInstrumento(JSON.stringify({ classes: [], students: [] }), ids())).toEqual({ ok: false, motivo: 'no-es-instrumento' });
    expect(leerArchivoDeInstrumento(JSON.stringify({ ...archivoDeRubrica(rubrica), tipo: 'examen' }), ids())).toEqual({ ok: false, motivo: 'no-es-instrumento' });
    expect(leerArchivoDeInstrumento(JSON.stringify({ ...archivoDeRubrica(rubrica), version: VERSION_INSTRUMENTO + 1 }), ids())).toEqual({ ok: false, motivo: 'version-posterior' });
    expect(leerArchivoDeInstrumento(JSON.stringify({ ...archivoDeRubrica(rubrica), name: '  ' }), ids())).toEqual({ ok: false, motivo: 'vacio' });
    expect(leerArchivoDeInstrumento(JSON.stringify({ ...archivoDeRubrica(rubrica), partes: [{ name: '' }, {}, null, 7] }), ids())).toEqual({ ok: false, motivo: 'vacio' });
  });

  it('un archivo retocado a mano no mete en el perfil lo que la app no espera', () => {
    const retocado = {
      formato: FORMATO_INSTRUMENTO, version: 1, tipo: 'rubrica', name: 'Rúbrica  de   fuera', class_id: 'c-ajena', id: 'r-que-ya-existe',
      levels: [{ value: 2, label: 'Dos' }, { value: 1, label: 'Uno' }, { value: 1, label: 'Repetido' }, { value: 0, label: 'Cero' }, { value: 3, label: '' }, 'x'],
      partes: [
        {
          id: 'k-ajeno', name: 'Criterio', class_id: 'c-ajena', evaluaciones: [{ student_name: 'Alguien' }],
          descriptors: { 1: 'Nivel uno.', 2: 'Nivel dos.', 3: 'De un nivel que no existe.', __proto__x: 'raro', 2.5: 'medio' },
          competencies: ['ccl', 'INVENTADA', 7], officialCriteria: [{ materia: 'lengua', codigo: '1.1' }, { materia: 'lengua', codigo: '1.1' }, { materia: '', codigo: '2' }, 'x'],
        },
        ...Array.from({ length: 60 }, (_, i) => ({ name: `Criterio ${i}` })),
      ],
    };
    const r = leerArchivoDeInstrumento(JSON.stringify(retocado), ids());
    if (!r.ok || r.tipo !== 'rubrica') throw new Error('no se ha leído');
    expect(r.rubrica.name).toBe('Rúbrica de fuera');
    expect(r.rubrica.levels).toEqual([{ value: 1, label: 'Uno' }, { value: 2, label: 'Dos' }]);
    expect(r.rubrica.criteria).toHaveLength(40);
    expect(r.rubrica.criteria[0]).toEqual({
      id: 'nuevo1', name: 'Criterio', descriptors: { 1: 'Nivel uno.', 2: 'Nivel dos.' }, competencies: ['CCL'], officialCriteria: [{ materia: 'lengua', codigo: '1.1' }],
    });
    expect(JSON.stringify(r)).not.toMatch(/ajen|Alguien|evaluaciones|ya-existe/);
  });

  it('sin niveles propios valen los cuatro de partida: los descriptores del 1 al 4', () => {
    const r = leerArchivoDeInstrumento(JSON.stringify({
      formato: FORMATO_INSTRUMENTO, version: 1, tipo: 'rubrica', name: 'Cuaderno',
      partes: [{ name: 'Orden', descriptors: { 1: 'a', 4: 'd', 5: 'de más', 0: 'de menos' } }],
    }), ids());
    if (!r.ok || r.tipo !== 'rubrica') throw new Error('no se ha leído');
    expect(r.rubrica.levels).toBeUndefined();
    expect(r.rubrica.criteria[0].descriptors).toEqual({ 1: 'a', 4: 'd' });
  });
});
