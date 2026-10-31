/**
 * Revisión de privacidad del 31-10-2026: el informe del orientador (y la programación del tutor) nunca se envía como
 * archivo. Se lee en el navegador, se le quitan los datos que identifican y los nombres del alumnado, y la IA recibe
 * solo ese texto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

import { analizarInforme, leerArchivoInforme } from './informeOrientacion';
import { setPrivacyRoster } from './privacy';
import type { AlumnoApoyo } from '../types/apoyo';

const alumno: AlumnoApoyo = { id: 'a1', nombre: 'Lucía Pérez Navarro', claseOrigen: '3º B', categorias: [], diagnostico: 'TEA grado 1', necesidades: '', notas: '' };
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

describe('el informe del orientador va a la IA como texto revisado', () => {
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

  it('lo pegado a mano también pierde los datos que identifican, y nunca se adjunta un archivo', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ categorias: [], diagnostico: '', necesidades: '', nivelEtapa: 'ninguna', nivelCurso: '0', fortalezas: '', orientaciones: '', ambitos: [], objetivos: [] }));
    await analizarInforme({ fuente: { texto: informe }, alumno, ambitos: [], comunidad: undefined, lang: 'es' });
    const [, usuario, archivos] = callGemini.mock.calls[0];
    expect(archivos).toEqual([]);
    expect(usuario).not.toContain('03/05/2016');
    expect(usuario).not.toContain('María Navarro');
    expect(usuario).not.toContain('612 345 678');
  });
});
