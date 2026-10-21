import { describe, it, expect } from 'vitest';
import { aCantidad, aEstado, aplicarImportacion, claveDeMaterial, filasDeCsv, materialDeFilas, materialDeTexto, prepararImportacion } from './importarMaterial';
import type { MaterialEF } from '../types/ef';

describe('importar material · cantidades y estados', () => {
  it('entiende las cantidades escritas de varias formas', () => {
    expect([aCantidad('12'), aCantidad(' 12 uds'), aCantidad('x8'), aCantidad('1.200'), aCantidad(5), aCantidad('doce'), aCantidad('')]).toEqual([12, 12, 8, 1200, 5, null, null]);
  });
  it('entiende el estado', () => {
    expect([aEstado('Nuevo'), aEstado('regular'), aEstado('Roto'), aEstado('para reponer'), aEstado('???'), aEstado('')]).toEqual(['bien', 'regular', 'reponer', 'reponer', undefined, undefined]);
  });
  it('compara nombres sin tildes ni plural', () => {
    expect(claveDeMaterial('Balones de Voleibol')).toBe(claveDeMaterial('balon de voleibol'));
  });
});

describe('importar material · tablas', () => {
  it('con títulos, usa las columnas que dicen ser', () => {
    const r = materialDeFilas([
      ['Inventario del pabellón'], [],
      ['Estado', 'Material', 'Uds.', 'Ubicación'],
      ['Bien', 'Balones de voleibol', '12', 'Almacén'],
      ['Regular', 'Conos', '30 uds', ''],
      ['', 'Total', 'x', ''],
    ]);
    expect(r).toEqual([
      { nombre: 'Balones de voleibol', cantidad: 12, estado: 'bien', ubicacion: 'Almacén' },
      { nombre: 'Conos', cantidad: 30, estado: 'regular' },
    ]);
  });
  it('sin títulos, nombre a la izquierda y cantidad en la primera columna de números', () => {
    expect(materialDeFilas([['Aros', '20'], ['Petos', '24'], ['Cuerdas', '15']])).toEqual([
      { nombre: 'Aros', cantidad: 20 }, { nombre: 'Petos', cantidad: 24 }, { nombre: 'Cuerdas', cantidad: 15 },
    ]);
  });
  it('lee un CSV con punto y coma, comillas y BOM', () => {
    const filas = filasDeCsv('﻿Material;Cantidad;Estado\r\n"Balones, de baloncesto";8;Bien\r\nPicas;10;roto\r\n');
    expect(filas[1]).toEqual(['Balones, de baloncesto', '8', 'Bien']);
    expect(materialDeFilas(filas)).toEqual([
      { nombre: 'Balones, de baloncesto', cantidad: 8, estado: 'bien' },
      { nombre: 'Picas', cantidad: 10, estado: 'reponer' },
    ]);
  });
});

describe('importar material · textos', () => {
  it('lee una línea por material, de varias formas, y salta lo que no tiene cantidad', () => {
    const r = materialDeTexto('Material del pabellón\n- 12 balones de voleibol\n• Conos: 30\nAros - 20\n3. Colchonetas ; 6\nTotal pendiente de revisar');
    expect(r).toEqual([
      { nombre: 'balones de voleibol', cantidad: 12 }, { nombre: 'Conos', cantidad: 30 },
      { nombre: 'Aros', cantidad: 20 }, { nombre: 'Colchonetas', cantidad: 6 },
    ]);
  });
});

describe('importar material · fusionar con el inventario', () => {
  const inv: MaterialEF[] = [
    { id: 'm1', nombre: 'Balón de voleibol', cantidad: 5, estado: 'regular', ubicacion: 'Pabellón' },
    { id: 'm2', nombre: 'Aros', cantidad: 10, estado: 'bien', ubicacion: '' },
  ];
  it('junta los repetidos del documento y marca los que ya están', () => {
    const p = prepararImportacion([{ nombre: 'Balones de voleibol', cantidad: 8 }, { nombre: 'balones de voleibol', cantidad: 2 }, { nombre: 'Petos', cantidad: 24 }], inv);
    expect(p.map(x => [x.nombre, x.cantidad, x.existente?.id])).toEqual([['Balones de voleibol', 10, 'm1'], ['Petos', 24, undefined]]);
  });
  it('lo nuevo se añade y lo que estaba toma la cantidad, conservando su estado y su sitio si el documento no los dice', () => {
    const p = prepararImportacion([{ nombre: 'Balones de voleibol', cantidad: 10 }, { nombre: 'Petos', cantidad: 24, estado: 'regular', ubicacion: 'Armario' }], inv);
    let n = 0;
    const r = aplicarImportacion(inv, p, () => 'nuevo' + n++);
    expect(r).toEqual([
      { id: 'm1', nombre: 'Balón de voleibol', cantidad: 10, estado: 'regular', ubicacion: 'Pabellón' },
      inv[1],
      { id: 'nuevo0', nombre: 'Petos', cantidad: 24, estado: 'regular', ubicacion: 'Armario' },
    ]);
  });
  it('solo lo elegido', () => {
    const p = prepararImportacion([{ nombre: 'Petos', cantidad: 24 }, { nombre: 'Conos', cantidad: 30 }], inv);
    expect(aplicarImportacion(inv, [p[1]], () => 'x').map(m => m.nombre)).toEqual(['Balón de voleibol', 'Aros', 'Conos']);
  });
});
