/**
 * Revisión de privacidad del 31-10-2026: un documento del alumnado (hoy, la programación de aula del tutor; el informe
 * del orientador ya no lo lee la IA desde el 3-11-2026) nunca se envía como archivo. Se lee en el navegador, se le
 * quitan los datos que identifican, los de salud y los nombres del alumnado, y la IA recibe solo ese texto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import { leerArchivoInforme } from './informeOrientacion';
import { setPrivacyRoster } from './privacy';

const informe = [
  'Nombre y apellidos: Lucía Pérez Navarro',
  'Fecha de nacimiento: 03/05/2016',
  'Madre: María Navarro Gil, teléfono 612 345 678',
  'Lucía presenta dificultades en la lectura.',
].join('\n');

beforeEach(() => {
  callGemini.mockReset();
  setPrivacyRoster([{ id: 'a1', name: 'Lucía Pérez Navarro' }]);
});

describe('un documento del alumnado va a la IA como texto revisado', () => {
  it('al abrir el archivo, el texto que se enseña ya no lleva nombres, fecha de nacimiento ni familiares', async () => {
    const f = await leerArchivoInforme(new File([informe], 'informe.txt', { type: 'text/plain' }));
    expect(f.nombre).toBe('informe.txt');
    for (const fuera of ['Lucía', 'Pérez', '03/05/2016', 'María', '612']) expect(f.texto).not.toContain(fuera);
    expect(f.texto).toContain('presenta dificultades en la lectura');
    expect(f.texto).toMatch(/\[ALU-\d+\] presenta/);
  });

  it('un archivo que no es un documento no se acepta', async () => {
    await expect(leerArchivoInforme(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))).rejects.toThrow('formato');
  });

  it('tampoco lleva datos de salud', async () => {
    const f = await leerArchivoInforme(new File(['Presenta TDAH y toma metilfenidato. Necesita instrucciones cortas.'], 'p.txt', { type: 'text/plain' }));
    expect(f.texto).not.toMatch(/TDAH|metilfenidato/);
    expect(f.texto).toContain('Necesita instrucciones cortas');
  });
});
