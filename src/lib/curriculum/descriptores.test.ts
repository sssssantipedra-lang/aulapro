/**
 * Con qué competencias clave conecta cada decreto sus competencias
 * específicas (scripts/curriculo/descriptores.py): de ahí sale lo que llega a
 * la Diana competencial. Los casos concretos están comprobados contra el
 * BOE, el BOCM y las imágenes de las tablas del DOGV.
 */
import { describe, it, expect } from 'vitest';
import primaria from './data/primaria.json';
import eso from './data/eso.json';
import madridPrimaria from './data/madrid/primaria.es.json';
import madridEso from './data/madrid/eso.es.json';
import cvPrimariaEs from './data/comunitat-valenciana/primaria.es.json';
import cvPrimariaCa from './data/comunitat-valenciana/primaria.ca.json';
import cvEsoEs from './data/comunitat-valenciana/eso.es.json';
import cvEsoCa from './data/comunitat-valenciana/eso.ca.json';
import catPrimaria from './data/cataluna/primaria.ca.json';
import catEso from './data/cataluna/eso.ca.json';
import { competenciasClaveDe } from './evaluacionPorCriterios';
import { normalizarEntradas } from './entradas';
import type { RawEntry } from './index';

type Datos = { id?: string; area?: string; materia?: string; competencias: { n: number; descriptores?: string[] }[] }[];
const de = (d: unknown) => d as Datos;
const materia = (d: unknown, id: string) => de(d).find(m => (m.id ?? m.materia ?? m.area) === id)!;
const descriptores = (d: unknown, id: string, n: number) => materia(d, id).competencias[n - 1].descriptores;
const todas = (d: unknown) => de(d).flatMap(m => m.competencias);

describe('conexiones de las competencias específicas con las competencias clave', () => {
  it('solo códigos válidos: descriptores del perfil de salida o, en la Comunitat Valenciana, la competencia clave', () => {
    const DESCRIPTOR = /^(CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)[1-9]$/;
    const CLAVE = /^(CCL|CP|STEM|CD|CPSAA|CC|CE|CCEC)$/;
    for (const d of [primaria, eso, madridPrimaria, madridEso]) {
      for (const c of todas(d)) for (const x of c.descriptores ?? []) expect(x).toMatch(DESCRIPTOR);
    }
    for (const d of [cvPrimariaEs, cvPrimariaCa, cvEsoEs, cvEsoCa]) {
      for (const c of todas(d)) for (const x of c.descriptores ?? []) expect(x).toMatch(CLAVE);
    }
  });

  it('estatal y Madrid ESO, todas; en el BOE, Biología y Geología CE1', () => {
    for (const d of [primaria, eso, madridEso]) expect(todas(d).every(c => c.descriptores?.length)).toBe(true);
    expect(descriptores(eso, 'Biología y Geología', 1)).toEqual(['CCL1', 'CCL2', 'CCL5', 'STEM4', 'CD2', 'CD3', 'CCEC4']);
  });

  it('Madrid Primaria: sus dos áreas propias enteras y, del resto, solo las competencias iguales a las estatales', () => {
    expect(materia(madridPrimaria, 'segunda-lengua-extranjera').competencias.every(c => c.descriptores?.length)).toBe(true);
    // La línea de la CE1 sale en el PDF detrás del enunciado de la CE2: es de la CE1
    expect(descriptores(madridPrimaria, 'tecnologia-y-robotica', 1)?.slice(0, 3)).toEqual(['CCL1', 'CP1', 'STEM1']);
    expect(descriptores(madridPrimaria, 'matematicas', 1)).toEqual(descriptores(primaria, 'Matemáticas', 1));
    expect(descriptores(madridPrimaria, 'matematicas', 6)).toBeUndefined();
    expect(materia(madridPrimaria, 'educacion-fisica').competencias.some(c => c.descriptores)).toBe(false);
  });

  it('Comunitat Valenciana, Primaria: las ocho tablas del 106/2022, iguales en las dos lenguas', () => {
    expect(todas(cvPrimariaEs).every(c => c.descriptores?.length)).toBe(true);
    expect(descriptores(cvPrimariaEs, 'matematicas', 1)).toEqual(['STEM', 'CD', 'CPSAA', 'CC', 'CE']);
    expect(todas(cvPrimariaCa).map(c => c.descriptores)).toEqual(todas(cvPrimariaEs).map(c => c.descriptores));
  });

  it('Comunitat Valenciana, ESO: casos revisados en la imagen de la tabla', () => {
    // Filosofía: en valenciano las X de CC se recortan; vale la tabla castellana
    expect(descriptores(cvEsoEs, 'filosofia', 1)).toEqual(['CD', 'CPSAA', 'CC']);
    expect(descriptores(cvEsoCa, 'filosofia', 1)).toEqual(['CD', 'CPSAA', 'CC']);
    // Biología y Geología (66/2024): las dos versiones oficiales difieren en la CE11; cada lengua, la suya
    expect(descriptores(cvEsoEs, 'biologia-y-geologia', 11)).toEqual(['CCL', 'STEM', 'CC', 'CE']);
    expect(descriptores(cvEsoCa, 'biologia-y-geologia', 11)).toEqual(['CCL', 'STEM', 'CPSAA', 'CC', 'CE']);
    // Etiqueta abajo y X arriba de la celda (en valenciano)
    expect(descriptores(cvEsoCa, 'creatividad-musical', 1)).toEqual(['CCL', 'CP', 'CD', 'CCEC']);
    // Economía: en valenciano solo en párrafos; la tabla castellana dice lo mismo que esos párrafos
    expect(descriptores(cvEsoCa, 'economia-y-emprendimiento', 1)).toEqual(['CPSAA', 'CC', 'CE', 'CCEC']);
    // Sin tabla en ninguna lengua: no se interpreta
    expect(descriptores(cvEsoEs, 'expresion-artistica', 1)).toBeUndefined();
    expect(descriptores(cvEsoEs, 'laboratorio-de-creacion-audiovisual', 1)).toBeUndefined();
  });

  it('Cataluña no conecta sus competencias específicas con las competencias clave', () => {
    expect([...todas(catPrimaria), ...todas(catEso)].some(c => c.descriptores)).toBe(false);
  });

  it('competenciasClaveDe: de los descriptores, la competencia clave, sin repetir y en el orden oficial', () => {
    const [bio] = normalizarEntradas(eso as unknown as RawEntry[]);
    expect(competenciasClaveDe(bio, 1)).toEqual(['CCL', 'STEM', 'CD', 'CCEC']);
    const [, , filo] = normalizarEntradas(de(cvEsoEs).filter(m => ['biologia-y-geologia', 'digitalizacion', 'filosofia'].includes(m.id!)) as unknown as RawEntry[]);
    expect(competenciasClaveDe(filo, 4)).toEqual(['CCL', 'CD', 'CPSAA', 'CC']);
  });
});
