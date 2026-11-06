/**
 * Las actas y memorias: la cabecera (título, convocante, lugar, asistentes) y las anotaciones van sin datos de contacto
 * ni de salud (auditoría del 5-11-2026). Los nombres del alumnado los cambia `callGemini`.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateWorkSessionDoc } from './workSessions';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

describe('generateWorkSessionDoc', () => {
  it('la cabecera y las anotaciones van sin teléfonos, correos ni datos de salud', async () => {
    callGemini.mockResolvedValueOnce(JSON.stringify({ apartados: [], acuerdos: [], aplicacionAula: [], cierre: '', tareas: [] }));
    await generateWorkSessionDoc({
      id: 'w1', kind: 'meeting', at: '2026-11-05T10:00:00Z', date: '2026-11-05', title: 'Reunión con la familia (madre: 612 345 678)',
      organizer: 'Tutoría', place: 'Aula 12', attendees: 'Madre (elena@correo.es) y orientadora',
      notes: 'La madre explica que tiene TDAH y toma Rubifen. Acordamos revisar la agenda.',
    }, 'es');
    const usuario = callGemini.mock.calls[0][1] as string;
    expect(usuario).not.toMatch(/612|elena@|TDAH|Rubifen/);
    expect(usuario).toContain('Título: Reunión con la familia (madre: [teléfono])');
    expect(usuario).toContain('Asistentes: Madre ([correo]) y orientadora');
    expect(usuario).toContain('Acordamos revisar la agenda');
  });
});
