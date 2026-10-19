import { describe, it, expect } from 'vitest';
import { clasesDe, conObjetivos, idColumna, objetivoPara, objetivosDe } from './objetivos';
import { gradeItemIdFor } from '../types';

const rub = { id: 'r1', class_id: 'c1', subject: 'Matemáticas', category_id: 'k1', otras_clases: [{ class_id: 'c2', subject: 'Matemáticas', category_id: 'k2' }, { class_id: 'c3' }] };

describe('clases de una rúbrica o diana', () => {
  it('la principal va primero y le siguen las otras, sin repetir', () => {
    expect(clasesDe(rub)).toEqual(['c1', 'c2', 'c3']);
    expect(clasesDe({ ...rub, otras_clases: [{ class_id: 'c1' }, { class_id: 'c2' }, { class_id: 'c2' }] })).toEqual(['c1', 'c2']);
  });

  it('sin clase principal no hay clases: solo historial, como siempre', () => {
    expect(objetivosDe({})).toEqual([]);
    expect(objetivosDe({ otras_clases: [{ class_id: 'c2' }] })).toEqual([]);
  });

  it('cada clase tiene su categoría, y la columna de la principal conserva el id de siempre', () => {
    expect(objetivoPara(rub, 'c2')?.category_id).toBe('k2');
    expect(objetivoPara(rub, 'c9')).toBeUndefined();
    expect(idColumna(rub, 'c1')).toBe(gradeItemIdFor('r1'));
    expect(idColumna(rub, 'c1')).toBe('gi-r1');
    expect(idColumna(rub, 'c2')).toBe('gi-r1-c2');
  });

  it('al guardar se quita lo vacío y lo repetido', () => {
    expect(conObjetivos({ class_id: 'c1', otras_clases: [] })).toEqual({ class_id: 'c1' });
    expect(conObjetivos({ otras_clases: [{ class_id: 'c2' }] })).toEqual({});
    expect(conObjetivos({ class_id: 'c1', otras_clases: [{ class_id: 'c1' }, { class_id: 'c2' }] })).toEqual({ class_id: 'c1', otras_clases: [{ class_id: 'c2' }] });
  });
});
