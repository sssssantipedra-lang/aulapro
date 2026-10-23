/**
 * La IA de Educación Física: se apoya en el currículo de la comunidad, en el
 * DUA-A y en los autores que eligió el dueño, y de quien está exento o
 * lesionado solo recibe lo que no puede hacer: ni su nombre ni el motivo
 * (decisión del dueño, 5-10-2026).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { actividadDesdeFoto, actividadesDesdeManual, reconocerPizarra, curriculoEF, limitacionesParaIA, marcoEF, prepararSesion, proponerActividades, recursosParaIA } from './efIA';
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

  it('desde una foto: la manda con el curso, la edad y las limitaciones sin nombres, y la redacta como de la IA', async () => {
    const foto = { name: 'foto.jpg', mimeType: 'image/jpeg', base64: 'QUJD' };
    callGemini.mockResolvedValue(JSON.stringify({
      visto: 'Un partido de voleibol en un pabellón.', esActividad: 'si', titulo: 'Voleibol 2 contra 2', tipo: 'deporte',
      modalidad: 'red-pared', descripcion: 'Dos parejas, campo pequeño.', organizacion: 'Parejas, 10 minutos.',
      material: 'Balones blandos', variantes: 'Atrapar y lanzar', inclusion: 'Juega sin saltar.', referencias: 'inventada',
    }));
    const lims = limitacionesParaIA(demo.ef, ids('ef-c1'), '2026-10-05');
    const r = await actividadDesdeFoto({ curso: '1º ESO', etapa: 'eso', edad: '12 a 13 años', nota: 'somos 24', limitaciones: lims, conInventario: true },
      foto, demo.ef, 'comunitat-valenciana', 'es');
    const [system, user, files, , opciones] = callGemini.mock.calls[0];
    expect(files).toEqual([foto]);
    expect(system).toContain('DUA-A');
    expect(user).toContain('Para: 1º ESO (12 a 13 años)');
    expect(user).toContain('somos 24');
    expect(user).toContain('No puede correr');
    expect(user).not.toMatch(/Alumno \d|esguince/i);
    expect(user).toMatch(/sin describir ni identificar a las personas/);
    expect(user).toMatch(/no copies su texto/);
    // Listas cerradas, siempre de texto (Gemini no admite otras)
    const props = opciones.responseSchema.properties;
    for (const k of ['esActividad', 'tipo', 'modalidad']) expect(props[k].enum.every((v: unknown) => typeof v === 'string')).toBe(true);
    expect(r).toEqual({
      visto: 'Un partido de voleibol en un pabellón.',
      actividad: {
        titulo: 'Voleibol 2 contra 2', tipo: 'deporte', modalidad: 'red-pared', descripcion: 'Dos parejas, campo pequeño.',
        organizacion: 'Parejas, 10 minutos.', material: 'Balones blandos', variantes: 'Atrapar y lanzar', inclusion: 'Juega sin saltar.', origen: 'ia',
      },
    });
  });

  it('desde una foto: si no es una actividad física, lo dice y no inventa ninguna', async () => {
    const foto = { name: 'foto.jpg', mimeType: 'image/jpeg', base64: 'QUJD' };
    callGemini.mockResolvedValue(JSON.stringify({ visto: 'Una taza de café.', esActividad: 'no', titulo: '', tipo: 'juego', modalidad: 'ninguna', descripcion: '', organizacion: '', material: '', variantes: '', inclusion: '' }));
    expect(await actividadDesdeFoto({ nota: '', limitaciones: [], conInventario: false }, foto, demo.ef, undefined, 'es'))
      .toEqual({ visto: 'Una taza de café.', actividad: null });
    expect(callGemini.mock.calls[0][1]).toContain('curso sin indicar');
    // Un tipo o una modalidad fuera de la lista no pasan
    callGemini.mockResolvedValue(JSON.stringify({ visto: 'Un juego.', esActividad: 'si', titulo: 'Pilla pilla', tipo: 'esgrima', modalidad: 'ninguna', descripcion: 'Correr.', organizacion: '', material: '', variantes: '', inclusion: '' }));
    const r = await actividadDesdeFoto({ nota: '', limitaciones: [], conInventario: false }, foto, demo.ef, undefined, 'es');
    expect(r?.actividad).toMatchObject({ titulo: 'Pilla pilla', tipo: 'juego' });
    expect(r?.actividad && 'modalidad' in r.actividad).toBe(false);
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

  it('el banco incluye los deportes alternativos, cada uno con su modalidad', () => {
    const alternativos = ['banco-korfball', 'banco-colpbol', 'banco-kinball', 'banco-goalball', 'banco-duni', 'banco-tchoukball', 'banco-pinfuvote', 'banco-floorball'];
    const b = bancoEF('es');
    for (const id of alternativos) {
      const a = b.find(x => x.id === id);
      expect(a, id).toBeTruthy();
      expect(a?.tipo).toBe('deporte');
      expect(a?.modalidad, id).toBeTruthy();
    }
  });
});

describe('actividades desde un manual en PDF', () => {
  const PDF = { name: 'manual.pdf', mimeType: 'application/pdf', base64: 'QUJD' };
  const act = (titulo: string, tipo = 'juego', modalidad = 'cooperacion') => ({
    titulo, tipo, modalidad, descripcion: 'Se juega en equipos.', organizacion: 'Grupos de 4', material: 'Aros', variantes: 'Más lejos', inclusion: 'Con un papel de árbitro',
  });
  const peticion = { curso: '5º de Primaria', edad: '10 a 11 años', paginas: '20-45', nota: '', yaTiene: ['El pañuelo por números'] };

  it('manda el PDF con las páginas y las actividades que ya tiene, y clasifica lo que vuelve', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [
      act('Los aros musicales'), act('Estiramientos en círculo', 'calma', 'ninguna'), act('Los aros musicales'), act('Raro', 'inventado', 'inventada'),
      { ...act('Sin reglas'), descripcion: '' },
    ] }));
    const r = await actividadesDesdeManual(peticion, PDF, 'madrid', 'es');
    expect(callGemini.mock.calls[0][2]).toEqual([PDF]);
    expect(callGemini.mock.calls[0][1]).toContain('20-45');
    expect(callGemini.mock.calls[0][1]).toContain('10 a 11 años');
    expect(callGemini.mock.calls[0][1]).toContain('El pañuelo por números');
    expect(callGemini.mock.calls[0][1]).toContain('con tus palabras');
    expect(r?.map(a => a.titulo)).toEqual(['Los aros musicales', 'Estiramientos en círculo', 'Raro']);
    expect(r?.[0]).toMatchObject({ tipo: 'juego', modalidad: 'cooperacion', origen: 'ia' });
    expect(r?.[1]).toMatchObject({ tipo: 'calma' });
    expect(r?.[1].modalidad).toBeUndefined();
    expect(r?.[2]).toMatchObject({ tipo: 'juego' });
  });

  it('si la respuesta se corta a media actividad, se queda con las que llegaron enteras', async () => {
    const entero = JSON.stringify({ actividades: [act('Una'), act('Dos'), act('Tres')] });
    callGemini.mockResolvedValue(entero.slice(0, entero.length - 40));
    const r = await actividadesDesdeManual(peticion, PDF, undefined, 'es');
    expect(r?.map(a => a.titulo)).toEqual(['Una', 'Dos']);
  });

  it('un PDF sin actividades devuelve la lista vacía, no un error', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ actividades: [] }));
    expect(await actividadesDesdeManual(peticion, PDF, undefined, 'es')).toEqual([]);
  });

  it('no pasa de 25 actividades', async () => {
    callGemini.mockResolvedValue(JSON.stringify({ actividades: Array.from({ length: 40 }, (_, i) => act(`Juego ${i}`)) }));
    expect(await actividadesDesdeManual(peticion, PDF, undefined, 'es')).toHaveLength(25);
  });
});

describe('reconocer el croquis de la pizarra', () => {
  const PNG = { name: 'croquis.png', mimeType: 'image/png', base64: 'QUJD' };

  it('manda la imagen con la lista cerrada de material y recorta lo que devuelve a lo posible', async () => {
    callGemini.mockResolvedValue(JSON.stringify({
      resumen: 'Cuatro conos en zigzag.',
      objetos: [
        { material: 'cono', x: 0.2, y: 0.3, ancho: 0.05, alto: 0.07, seguridad: 'alta' },
        { material: 'estacion', x: 0.5, y: 0.5, ancho: 0.05, alto: 0.05, seguridad: 'alta' },
        { material: 'platillo', x: 0.5, y: 0.5, ancho: 0.05, alto: 0.05, seguridad: 'alta' },
        { material: 'aro', x: 1.4, y: -2, ancho: 0.1, alto: 0.1, seguridad: 'rara' },
      ],
    }));
    const r = await reconocerPizarra(PNG, 'madrid', 'es');
    expect(callGemini.mock.calls[0][2]).toEqual([PNG]);
    expect(callGemini.mock.calls[0][1]).toContain('- cono:');
    expect(callGemini.mock.calls[0][1]).not.toContain('- estacion:');
    expect(r?.resumen).toBe('Cuatro conos en zigzag.');
    expect(r?.objetos).toEqual([
      { material: 'cono', x: 0.2, y: 0.3, ancho: 0.05, alto: 0.07, seguridad: 'alta' },
      { material: 'aro', x: 1, y: 0, ancho: 0.1, alto: 0.1, seguridad: 'media' },
    ]);
  });
});
