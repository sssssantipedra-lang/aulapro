// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PuntuaEnAreas } from './PuntuaEnAreas';
import { destinoDeAreas, type ModoAreas } from '../lib/areasMaterial';
import { I18nProvider } from '../i18n';
import type { Class, GradeCategory } from '../types';

afterEach(cleanup);
const clase = { id: 'c1', name: '5º A', subject: 'Lengua', subjects: ['Lengua', 'Matemáticas'] } as unknown as Class;
const cats = [
  { id: 'k1', class_id: 'c1', subject: 'Lengua', name: 'Trabajos', weight: 40 },
  { id: 'k2', class_id: 'c1', subject: 'Matemáticas', name: 'Trabajos', weight: 40 },
] as unknown as GradeCategory[];
const areas = [{ area: 'Lengua', materia: 'lengua' }, { area: 'Matemáticas', materia: 'mates' }, { area: 'Música' }];

function Prueba({ alCambiar }: { alCambiar: (d: unknown) => void }) {
  const [sel, setSel] = useState(['Lengua', 'Matemáticas']);
  const [modo, setModo] = useState<ModoAreas>('misma');
  const [cat, setCat] = useState('Trabajos');
  alCambiar(destinoDeAreas(clase, areas, sel, modo, cat, cats));
  return <I18nProvider><PuntuaEnAreas areas={areas} clase={clase} gradeCategories={cats} elegidas={sel} onElegidas={setSel} modo={modo} onModo={setModo} categoria={cat} onCategoria={setCat} /></I18nProvider>;
}

describe('PuntuaEnAreas', () => {
  it('elige áreas y la forma de reflejarlo, y deshabilita lo que no es de la clase', async () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    expect((screen.getByRole('button', { name: 'Música' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('radio', { name: /Nota por criterios/ }));
    expect(alCambiar.mock.lastCall![0]).toMatchObject({ subject: 'Lengua', category_id: 'k1', modo_areas: 'criterio', areas: [{ subject: 'Lengua' }, { subject: 'Matemáticas', category_id: 'k2', materia: 'mates' }] });
    // Con una sola área, como siempre: sin opciones de reparto ni `areas`
    await userEvent.click(screen.getByRole('button', { name: 'Matemáticas' }));
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(alCambiar.mock.lastCall![0]).toEqual({ subject: 'Lengua', category_id: 'k1' });
  });
});
