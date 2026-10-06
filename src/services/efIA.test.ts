/**
 * La IA de Educación Física: se apoya en el currículo de la comunidad, en el
 * DUA-A y en los autores que eligió el dueño, y de quien está exento o
 * lesionado solo recibe lo que no puede hacer: ni su nombre ni el motivo
 * (decisión del dueño, 5-10-2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { curriculoEF, limitacionesParaIA, marcoEF, prepararSesion, proponerActividades, recursosParaIA } from './efIA';
import { cargarCurriculo } from '../lib/curriculum/cargar';
import { resolverGrupo } from '../lib/curriculum/index';
import { buildDemoEF } from '../lib/demoEF';
import { bancoEF, TAMANO_BANCO } from '../lib/bancoEF';
import { MODALIDADES_EF, TIPOS_ACTIVIDAD } from '../lib/ef';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('./gemini', async importOriginal => {
  const real = await importOriginal<typeof import('./gemini')>();
  return { ...real, callGemini };
});

const hoy = new Date(2026, 9, 5);
const demo = buildDemoEF(hoy);
const ids = (claseId: string) => demo.students.filter(s => s.class_id === claseId).map(s => s.id);

/** Educación Física de 1º ESO de la Comunitat Valenciana. */
async function efPrimero(): Promise<MateriaDeClase[]> {
  const { materias } = await cargarCurriculo('comunitat-valenciana', 'eso', 'es');
  return materias.flatMap(e => {
    if (!/f[ií]sica/i.test(e.nombre) || /qu[ií]mica/i.test(e.nombre)) return [];
    const r = resolverGrupo('eso', e.nombre, 1, undefined, materias);
    return r ? [{ asignatura: e.nombre, entry: r.entry, grupo: r.grupo }] : [];
  });
}

beforeEach(() => callGemini.mockReset());

describe('marco de la IA de EF', () => {
  it('cita el currículo de la comunidad, el DUA-A y los autores, y pide no inventar', () => {
    const m = marcoEF('comunitat-valenciana', 'eso', 'es');
    expect(m).toContain('DUA-A');
    expect(m).toContain('Parlebas');
    expect(m).toContain('López-Pastor');
    expect(m).toContain('Granero-Gallegos');
    expect(m).toContain('Orden 20/2019');
    expect(m).toMatch(/no inventes/);
    expect(curriculoEF('comunitat-valenciana', 'eso')).toMatch(/Decreto 107\/2022/);
    expect(curriculoEF(undefined, 'primaria')).toContain('Real Decreto 157/2022');
    expect(marcoEF(undefined, undefined, 'en')).toContain('in English');
  });

  it('de los exentos solo pasa lo que no pueden hacer, sin nombre ni motivo', () => {
    const lims = limitacionesParaIA(demo.ef, ids('ef-c1'), '2026-10-05');
    expect(lims).toEqual(['No puede correr, No puede saltar']);
    const todo = lims.join(' ');
    expect(todo).not.toContain('Alumno 4');
    expect(todo).not.toMatch(/esguince/i);
    // En otra clase, nadie de la primera
    expect(limitacionesParaIA(demo.ef, ids('ef-c2'), '2026-10-05')).toEqual([]);
  });

  it('el material para reponer no cuenta', () => {
    const r = recursosParaIA(demo.ef);
    expect(r.material).toContain('Conos (40)');
    expect(r.material).not.toContain('Volantes');
    expect(r.instalaciones).toContain('Pabellón (cubierta');
  });
});

describe('sesión con IA', () => {
  it('manda la clase, el material y las limitaciones sin nombres, y solo acepta criterios de la lista', async () => {
    const materias = await efPrimero();
    expect(materias.length).toBe(1);
    const codigo = materias[0].entry.criterios[materias[0].grupo][0].codigo;
    callGemini.mockResolvedValue(JSON.stringify({
      titulo: 'Voleibol', objetivo: 'Pasar con toque de dedos.', calentamiento: 'Movilidad (10 min)',
      principal: 'Toque por parejas (20 min)', calma: 'Estiramientos (5 min)', material: 'Balones',
      inclusion: 'Juega de colocador.', planB: 'En el porche.',
      criterios: [`${materias[0].entry.nombre}|${codigo}`, 'Matemáticas|1.1'],
    }));
    const r = await prepararSesion({
      curso: '1º ESO', etapa: 'eso', tema: 'toque de dedos', minutos: 55,
      instalacion: demo.ef.instalaciones[1], cubiertas: [demo.ef.instalaciones[0]],
      limitaciones: limitacionesParaIA(demo.ef, ids('ef-c1'), '2026-10-05'),
      materias, banco: bancoEF('es'),
    }, demo.ef, 'comunitat-valenciana', 'es');
    const [system, user, , , opciones] = callGemini.mock.calls[0];
    expect(system).toContain('DUA-A');
    expect(user).toContain('No puede correr, No puede saltar');
    expect(user).toContain('Pista exterior (al aire libre)');
    expect(user).toContain('Espacios cubiertos para el plan B: Pabellón');
    expect(user).not.toMatch(/Alumno 4|esguince/i);
    expect(opciones.responseSchema.properties.criterios.items.enum.every((x: unknown) => typeof x === 'string')).toBe(true);
    expect(r?.criterios).toEqual([{ materia: materias[0].entry.id, codigo }]);
    expect(r?.planB).toBe('En el porche.');
  });
});

describe('actividades con IA y banco de partida', () => {
  it('las propuestas se guardan como de la IA, del tipo pedido', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [
      { titulo: 'Bolos', descripcion: 'Derribar botellas.', organizacion: 'Equipos', material: 'Botellas', variantes: 'Más lejos', inclusion: 'Sentado' },
      { titulo: '', descripcion: 'sin título' },
    ] }));
    const r = await proponerActividades({ tipo: 'lluvia', tema: 'puntería', limitaciones: [], conInventario: true, yaTiene: ['Bolos con botellas'] },
      demo.ef, 'madrid', 'es');
    expect(r).toEqual([expect.objectContaining({ titulo: 'Bolos', tipo: 'lluvia', origen: 'ia' })]);
    expect(callGemini.mock.calls[0][1]).toContain('no las repitas');
  });

  it('con una modalidad, la IA recibe su lógica y su preparación, y las actividades la llevan', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [
      { titulo: 'Sumo de palmas', descripcion: 'Empujar palma con palma.', organizacion: 'Parejas', material: 'Colchonetas', variantes: 'Sentados', inclusion: 'Sentado' },
    ] }));
    const r = await proponerActividades({ tipo: 'juego', modalidad: 'lucha', tema: 'equilibrio', limitaciones: [], conInventario: false, yaTiene: [] },
      demo.ef, undefined, 'es');
    const [system, user] = callGemini.mock.calls[0];
    expect(system).toContain('invasión, red y pared, lucha, blanco y diana, cooperación, juegos tradicionales y populares, medio natural y urbano');
    expect(user).toContain('Modalidad: Lucha');
    expect(user).toContain('caídas seguras');
    expect(r?.[0].modalidad).toBe('lucha');
  });

  it('el banco de partida tiene de todos los tipos, en los tres idiomas y con inclusión', () => {
    for (const lang of ['es', 'ca', 'en'] as const) {
      const b = bancoEF(lang);
      expect(b).toHaveLength(TAMANO_BANCO);
      expect(new Set(b.map(a => a.id)).size).toBe(b.length);
      for (const tipo of TIPOS_ACTIVIDAD) expect(b.filter(a => a.tipo === tipo.id).length).toBeGreaterThanOrEqual(3);
      for (const a of b) {
        for (const campo of ['titulo', 'descripcion', 'organizacion', 'material', 'variantes', 'inclusion'] as const) {
          expect(a[campo].trim(), `${a.id} ${campo} ${lang}`).not.toBe('');
          expect(a[campo], `${a.id} ${campo} ${lang}`).not.toMatch(/—|\bprofes\b/);
        }
      }
    }
    // Cada modalidad tiene al menos dos juegos o deportes en el banco
    for (const m of MODALIDADES_EF) expect(bancoEF('es').filter(a => a.modalidad === m.id).length, m.id).toBeGreaterThanOrEqual(2);
    // Cada idioma tiene su texto, no una copia del castellano
    expect(bancoEF('ca')[0].descripcion).not.toBe(bancoEF('es')[0].descripcion);
    expect(bancoEF('en')[0].titulo).toBe('Handkerchief by numbers');
  });
});
