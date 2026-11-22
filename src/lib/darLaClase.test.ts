// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  claseParaSda, claveSesionDada, encargarClase, ENCARGO_VALE_MS, escribirPlanDeVentana, esDeSesion, esSesionEnPizarra, esTareas,
  fusionarPlan, hayEncargo, huecoParaPlan, leerPlanDeVentana, mismoOrigen, partirActividad, planDeOrigen, planDeSesion, planDeSesionSda,
  sesionesDeHoy, sesionesParaProponer, sesionRecorrida, sesionViva, suscribirEncargo, tomarEncargo, ventanaParaPlan,
  MAX_ACTIVIDADES_POR_MOMENTO, type TareaPlan,
} from './darLaClase';
import { borrarDatosDeVentana, claveDatos } from './pizarraAula';
import type { LearningSituation } from '../types';
import type { SesionEF } from '../types/ef';

const sesion = (x: Partial<SesionEF> = {}): SesionEF => ({
  id: 's1', titulo: 'Voleibol: el toque de dedos', claseId: 'c1',
  objetivo: 'OBJETIVO DEL DOCENTE', material: 'MATERIAL DEL DOCENTE', inclusion: 'MEDIDA DE INCLUSIÓN', planB: 'PLAN B',
  calentamiento: 'Pilla-pilla de movilidad (8 min): dos la paran.\nPases por parejas (4 min): lanzar y atrapar.',
  principal: 'Toque de dedos por parejas (12 min): primero atrapando.',
  calma: 'Recogida del material (3 min).',
  ...x,
});

const sda = (x: Partial<LearningSituation> = {}, sesiones: unknown[] = []): LearningSituation => ({
  id: 'sda1', title: 'Los juegos del mundo', class_id: 'c1', request: { numero: '2' },
  content: { titulo: 'Los juegos del mundo', sesiones },
  ...x,
} as unknown as LearningSituation);

const todo = (plan: { sesion: unknown; tareas: unknown }) => JSON.stringify(plan);

describe('partirActividad', () => {
  it('separa el nombre con sus minutos de cómo se hace', () => {
    expect(partirActividad('Pilla-pilla de movilidad (8 min): dos la paran y quien es tocado estira.'))
      .toEqual({ titulo: 'Pilla-pilla de movilidad (8 min)', detalle: 'dos la paran y quien es tocado estira.' });
    expect(partirActividad('Rondo de pases (10 min). Cuatro jugadores en un cuadrado.'))
      .toEqual({ titulo: 'Rondo de pases (10 min)', detalle: 'Cuatro jugadores en un cuadrado.' });
    expect(partirActividad("Carrera continua (5') suave, por parejas"))
      .toEqual({ titulo: "Carrera continua (5')", detalle: 'suave, por parejas' });
  });

  it('sin minutos, parte por los dos puntos o por el primer punto', () => {
    expect(partirActividad('Lluvia de ideas: qué sabemos de las fracciones'))
      .toEqual({ titulo: 'Lluvia de ideas', detalle: 'qué sabemos de las fracciones' });
    expect(partirActividad('Lectura en voz alta. Cada pareja lee un párrafo.'))
      .toEqual({ titulo: 'Lectura en voz alta', detalle: 'Cada pareja lee un párrafo.' });
  });

  it('una línea sin esa forma es toda título, sin viñeta ni punto final', () => {
    expect(partirActividad('• Recogida del material (3 min).')).toEqual({ titulo: 'Recogida del material (3 min)' });
    expect(partirActividad('2) Corregimos los deberes')).toEqual({ titulo: 'Corregimos los deberes' });
    expect(partirActividad('- Puesta en común.')).toEqual({ titulo: 'Puesta en común' });
    expect(partirActividad('   ')).toEqual({ titulo: '' });
  });

  it('una hora no es un separador', () => {
    expect(partirActividad('Salimos al patio a las 10:30 con los petos')).toEqual({ titulo: 'Salimos al patio a las 10:30 con los petos' });
  });

  it('quita la organización y el material que añade «Pasar a sesiones»', () => {
    expect(partirActividad('El pañuelo (10 min). Dos equipos y un número por jugador. Organización: dos filas enfrentadas. Material: un pañuelo.'))
      .toEqual({ titulo: 'El pañuelo (10 min)', detalle: 'Dos equipos y un número por jugador.' });
    expect(partirActividad('Debat (10 min). Per parelles. Organització: en rotllana. Material: cap.'))
      .toEqual({ titulo: 'Debat (10 min)', detalle: 'Per parelles.' });
    // Si solo quedaba eso, no hay descripción
    expect(partirActividad('Relevos (5 min). Material: conos.')).toEqual({ titulo: 'Relevos (5 min)' });
  });

  it('recorta lo que no cabría en la pizarra', () => {
    const a = partirActividad(`Juego: ${'muy largo '.repeat(200)}`);
    expect(a.detalle!.length).toBeLessThanOrEqual(600);
    expect(a.detalle!.endsWith('…')).toBe(true);
  });
});

describe('planDeSesion', () => {
  it('una casilla por línea de cada uno de los tres momentos, sin marcar', () => {
    const p = planDeSesion(sesion(), true);
    expect(p.sesion).toEqual({ origen: { tipo: 'sesion', id: 's1' }, titulo: 'Voleibol: el toque de dedos', ef: true, claseId: 'c1' });
    expect(p.tareas.map(t => [t.momento, t.texto])).toEqual([
      [0, 'Pilla-pilla de movilidad (8 min)'], [0, 'Pases por parejas (4 min)'],
      [1, 'Toque de dedos por parejas (12 min)'], [2, 'Recogida del material (3 min)'],
    ]);
    expect(p.tareas.every(t => !t.hecha && esDeSesion(t))).toBe(true);
    expect(new Set(p.tareas.map(t => t.id)).size).toBe(4);
    expect(p.tareas[0].detalle).toBe('dos la paran.');
  });

  it('lo proyectado no lleva el objetivo, el material, las medidas de inclusión ni el plan B', () => {
    const texto = todo(planDeSesion(sesion(), false));
    for (const privado of ['OBJETIVO DEL DOCENTE', 'MATERIAL DEL DOCENTE', 'MEDIDA DE INCLUSIÓN', 'PLAN B']) expect(texto).not.toContain(privado);
  });

  it('una sesión sin nada escrito da un plan sin casillas, y un momento muy largo se corta', () => {
    expect(planDeSesion(sesion({ calentamiento: '', principal: '  \n ', calma: '' }), false).tareas).toEqual([]);
    const larga = planDeSesion(sesion({ calentamiento: '', calma: '', principal: Array.from({ length: 30 }, (_, i) => `Actividad ${i + 1}`).join('\n') }), false);
    expect(larga.tareas).toHaveLength(MAX_ACTIVIDADES_POR_MOMENTO);
  });

  it('lo que se guarda en la ventana pasa su validación', () => {
    const p = planDeSesion(sesion(), true);
    expect(esTareas(p.tareas)).toBe(true);
    expect(esSesionEnPizarra(p.sesion)).toBe(true);
  });
});

describe('planDeSesionSda', () => {
  const act = (nombre: string, minutos = 10) => ({ nombre, minutos, descripcion: `Cómo se hace ${nombre}.`, organizacion: 'ORGANIZACIÓN', material: 'MATERIAL' });
  const conMomentos = sda({}, [
    { fase: 'Inicio', titulo: 'Qué sabemos', descripcion: 'RESUMEN PARA EL DOCENTE', momentos: {
      preimpacto: { texto: 'TEXTO DEL MOMENTO', actividades: [act('Lluvia de ideas', 5)] },
      impacto: { texto: '', actividades: [act('Mural'), act('Exposición', 0)] },
      postimpacto: { texto: 'Recogemos y comentamos.', actividades: [] },
    } },
    { fase: 'Desarrollo', titulo: 'Antigua', descripcion: 'Leemos el texto. Subrayamos.\nPuesta en común' },
  ]);

  it('el nombre y la descripción de cada actividad, en su momento', () => {
    const p = planDeSesionSda(conMomentos, 0)!;
    expect(p.sesion).toEqual({ origen: { tipo: 'sda', id: 'sda1', indice: 0 }, titulo: '1. Qué sabemos', ef: false, claseId: 'c1' });
    expect(p.tareas.map(t => [t.momento, t.texto, t.detalle])).toEqual([
      [0, 'Lluvia de ideas (5 min)', 'Cómo se hace Lluvia de ideas.'],
      [1, 'Mural (10 min)', 'Cómo se hace Mural.'],
      [1, 'Exposición', 'Cómo se hace Exposición.'],
      [2, 'Recogemos y comentamos', undefined],
    ]);
  });

  it('no proyecta la organización, el material ni el resumen para el docente', () => {
    const texto = todo(planDeSesionSda(conMomentos, 0)!);
    for (const privado of ['ORGANIZACIÓN', 'MATERIAL', 'RESUMEN PARA EL DOCENTE', 'TEXTO DEL MOMENTO']) expect(texto).not.toContain(privado);
  });

  it('una sesión de antes, sin momentos, da las líneas de su descripción sin momento', () => {
    const p = planDeSesionSda(conMomentos, 1)!;
    expect(p.tareas.map(t => [t.momento, t.texto, t.detalle])).toEqual([
      [undefined, 'Leemos el texto', 'Subrayamos.'], [undefined, 'Puesta en común', undefined],
    ]);
    expect(p.tareas.every(esDeSesion)).toBe(true);
  });

  it('una SdA de Educación Física lleva sus nombres de momento, y un índice que no existe no da plan', () => {
    const ef = sda({ content: { ...conMomentos.content, ef: { modelos: [] } } } as unknown as Partial<LearningSituation>);
    expect(planDeSesionSda(ef, 0)!.sesion.ef).toBe(true);
    expect(planDeSesionSda(conMomentos, 7)).toBeNull();
  });
});

describe('planDeOrigen y sesionViva', () => {
  const img = { id: 'i1', src: 'data:image/jpeg;base64,AAAA', ancho: 10, alto: 10 };
  const fuente = {
    sesiones: [sesion({ imagenes: [img], pizarraId: 'pz1' }), sesion({ id: 's2', completada: true, pizarraId: 'no-existe' })],
    sdas: [sda({}, [{ fase: 'Inicio', titulo: 'Uno', descripcion: 'Hacemos esto', completada: true, imagenes: [img] }])],
    pizarras: [{ id: 'pz1', nombre: 'Circuito de fuerza', elementos: [], trazos: [] }],
    ef: true,
  };

  it('busca la sesión por su origen', () => {
    expect(planDeOrigen(fuente, { tipo: 'sesion', id: 's1' })!.sesion.titulo).toBe('Voleibol: el toque de dedos');
    expect(planDeOrigen(fuente, { tipo: 'sda', id: 'sda1', indice: 0 })!.sesion.titulo).toBe('1. Uno');
    expect(planDeOrigen(fuente, { tipo: 'sesion', id: 'borrada' })).toBeNull();
    expect(planDeOrigen(fuente, { tipo: 'sda', id: 'sda1', indice: 3 })).toBeNull();
  });

  it('da las imágenes, el circuito y si ya está dada, mirados en el momento', () => {
    expect(sesionViva(fuente, { tipo: 'sesion', id: 's1' })).toEqual({ completada: false, imagenes: [img], circuito: fuente.pizarras[0] });
    expect(sesionViva(fuente, { tipo: 'sesion', id: 's2' })).toEqual({ completada: true, imagenes: [] });
    expect(sesionViva(fuente, { tipo: 'sda', id: 'sda1', indice: 0 })).toEqual({ completada: true, imagenes: [img] });
    expect(sesionViva(fuente, { tipo: 'sesion', id: 'borrada' })).toBeNull();
  });

  it('una imagen que no es una imagen incrustada no se enseña', () => {
    const rara = { ...fuente, sesiones: [sesion({ imagenes: [{ ...img, src: 'https://ejemplo.invalid/foto.jpg' }, { ...img, id: 'i2', src: 'data:image/svg+xml,<svg/>' }] })] };
    expect(sesionViva(rara, { tipo: 'sesion', id: 's1' })!.imagenes).toEqual([]);
  });
});

describe('fusionarPlan y sesionRecorrida', () => {
  const t = (id: string, texto: string, hecha = false, momento?: 0 | 1 | 2): TareaPlan => ({ id, texto, hecha, ...(momento === undefined ? {} : { momento }) });
  const aMano = t('t1700000000000', 'Repartir las autorizaciones', true);

  it('al volver a traer la misma sesión conserva lo marcado y lo escrito a mano', () => {
    const antes = [t('s0-0', 'Calentar', true, 0), t('s1-0', 'Partido', false, 1), aMano];
    const nuevas = [t('s0-0', 'Calentar', false, 0), t('s1-0', 'Partido reducido', false, 1), t('s2-0', 'Estirar', false, 2)];
    expect(fusionarPlan(antes, nuevas, true)).toEqual([
      t('s0-0', 'Calentar', true, 0), t('s1-0', 'Partido reducido', false, 1), t('s2-0', 'Estirar', false, 2), aMano,
    ]);
  });

  it('con otra sesión, las casillas de la anterior se van y lo escrito a mano se queda', () => {
    const antes = [t('s0-0', 'Calentar', true, 0), aMano];
    expect(fusionarPlan(antes, [t('s0-0', 'Calentar', false, 0)], false)).toEqual([t('s0-0', 'Calentar', false, 0), aMano]);
  });

  it('la sesión está recorrida cuando todas sus actividades están marcadas, cuente lo que cuente lo escrito a mano', () => {
    expect(sesionRecorrida([t('s0-0', 'A', true, 0), t('s1-0', 'B', true, 1), t('t1', 'a mano', false)])).toBe(true);
    expect(sesionRecorrida([t('s0-0', 'A', true, 0), t('s1-0', 'B', false, 1)])).toBe(false);
    expect(sesionRecorrida([t('t1', 'a mano', true)])).toBe(false);
    expect(sesionRecorrida([])).toBe(false);
  });

  it('la sugerencia de darla por dada tiene una clave por sesión', () => {
    expect(claveSesionDada({ tipo: 'sesion', id: 's1' })).toBe('sesiondada:s1');
    expect(claveSesionDada({ tipo: 'sda', id: 'a', indice: 2 })).toBe('sesiondada:sda:a:2');
  });
});

describe('sesionesParaProponer', () => {
  const HOY = '2026-11-20';
  const sdas = [sda({ id: 'a', title: 'Los juegos del mundo' }), sda({ id: 'b', title: 'El agua', request: { numero: '1' } } as unknown as Partial<LearningSituation>)];
  const s = (id: string, x: Partial<SesionEF> = {}) => sesion({ id, titulo: id, ...x });

  it('primero las de hoy; de los demás grupos, la primera sin dar que no sea de más adelante', () => {
    const sesiones = [
      s('a1', { sdaId: 'a', sdaOrden: 1, completada: true }),
      s('a2', { sdaId: 'a', sdaOrden: 2 }),
      s('a3', { sdaId: 'a', sdaOrden: 3 }),
      s('b1', { sdaId: 'b', sdaOrden: 1, fecha: '2026-11-18' }),
      s('b2', { sdaId: 'b', sdaOrden: 2, fecha: HOY }),
      s('suelta', { fecha: '2026-11-27' }),
      s('otra-clase', { claseId: 'c2', fecha: HOY }),
      s('archivada', { fecha: HOY, archivada: true }),
    ];
    const p = sesionesParaProponer({ sesiones, sdas }, 'c1', HOY);
    // «El agua» tiene una para hoy: no se propone además su atrasada. «Los juegos del mundo», su siguiente.
    expect(p.map(x => [x.sesion.id, x.motivo, x.sda])).toEqual([['b2', 'hoy', 'El agua'], ['a2', 'siguiente', 'Los juegos del mundo']]);
    expect(sesionesDeHoy({ sesiones, sdas }, 'c1', HOY).map(x => x.id)).toEqual(['b2']);
    expect(sesionesDeHoy({ sesiones, sdas }, 'c2', HOY).map(x => x.id)).toEqual(['otra-clase']);
  });

  it('sin ninguna para hoy propone la siguiente, también una que quedó atrás, y nunca una ya dada ni una de más adelante', () => {
    const sesiones = [s('x1', { fecha: '2026-11-10', completada: true }), s('x2', { fecha: '2026-11-17' }), s('x3', { fecha: '2026-12-01' })];
    expect(sesionesParaProponer({ sesiones, sdas: [] }, 'c1', HOY).map(x => [x.sesion.id, x.motivo, x.sda])).toEqual([['x2', 'siguiente', undefined]]);
    expect(sesionesParaProponer({ sesiones: [s('x3', { fecha: '2026-12-01' })], sdas: [] }, 'c1', HOY)).toEqual([]);
    expect(sesionesParaProponer({ sesiones, sdas: [] }, 'c9', HOY)).toEqual([]);
  });

  it('respeta el orden que el docente dio a las sesiones y no pasa de cuatro', () => {
    const sesiones = [s('z1', { orden: 2 }), s('z2', { orden: 1 })];
    expect(sesionesParaProponer({ sesiones, sdas: [] }, 'c1', HOY)[0].sesion.id).toBe('z2');
    const muchas = Array.from({ length: 9 }, (_, i) => s(`h${i}`, { fecha: HOY }));
    expect(sesionesParaProponer({ sesiones: muchas, sdas: [] }, 'c1', HOY)).toHaveLength(4);
  });

  it('las sesiones sin clase son de la pizarra sin clase', () => {
    const sesiones = [s('sin', { claseId: undefined, fecha: HOY })];
    expect(sesionesParaProponer({ sesiones, sdas: [] }, '', HOY).map(x => x.sesion.id)).toEqual(['sin']);
    expect(sesionesParaProponer({ sesiones, sdas: [] }, 'c1', HOY)).toEqual([]);
  });
});

describe('ventanaParaPlan', () => {
  const o1 = { tipo: 'sesion', id: 's1' } as const;
  const con = (id: string, sesionId?: string, tareas: TareaPlan[] = [{ id: 't1', texto: 'a mano', hecha: false }]) => ({
    id, tareas, sesion: sesionId ? { origen: { tipo: 'sesion' as const, id: sesionId }, titulo: 'x', ef: false } : null,
  });

  it('la que ya tiene esa sesión, antes que una vacía', () => {
    expect(ventanaParaPlan([con('agenda', undefined, []), con('agenda-2', 's1')], o1)).toEqual({ id: 'agenda-2', modo: 'misma' });
  });
  it('si no, la primera vacía', () => {
    expect(ventanaParaPlan([con('agenda', 's9'), con('agenda-2', undefined, [])], o1)).toEqual({ id: 'agenda-2', modo: 'vacia' });
  });
  it('con todas ocupadas por otra cosa, ninguna: se abre una nueva y no se pisa nada', () => {
    expect(ventanaParaPlan([con('agenda'), con('agenda-2', 's9')], o1)).toBeNull();
    expect(ventanaParaPlan([], o1)).toBeNull();
  });
  it('sin sesión, la vacía o la primera que haya', () => {
    expect(ventanaParaPlan([con('agenda', 's9'), con('agenda-2', undefined, [])], null)).toEqual({ id: 'agenda-2', modo: 'vacia' });
    expect(ventanaParaPlan([con('agenda', 's9')], null)).toEqual({ id: 'agenda', modo: 'misma' });
    expect(ventanaParaPlan([], null)).toBeNull();
  });
  it('la sesión 2 de una SdA no es la sesión 1', () => {
    expect(mismoOrigen({ tipo: 'sda', id: 'a', indice: 0 }, { tipo: 'sda', id: 'a', indice: 1 })).toBe(false);
    expect(mismoOrigen({ tipo: 'sda', id: 'a', indice: 1 }, { tipo: 'sda', id: 'a', indice: 1 })).toBe(true);
    expect(mismoOrigen({ tipo: 'sesion', id: 'a' }, { tipo: 'sda', id: 'a', indice: 0 })).toBe(false);
    expect(mismoOrigen(null, o1)).toBe(false);
  });
});

describe('claseParaSda', () => {
  it('si la clase de ahora es una de las de la situación, esa; si no, la principal', () => {
    const sda = { class_id: 'c1', otras_clases: ['c2', 'c3'] };
    expect(claseParaSda(sda, 'c3')).toBe('c3');
    expect(claseParaSda(sda, 'c9')).toBe('c1');
    expect(claseParaSda(sda, null)).toBe('c1');
    expect(claseParaSda({ otras_clases: ['c2'] }, 'c9')).toBe('c2');
    expect(claseParaSda({}, 'c9')).toBeUndefined();
  });
});

describe('huecoParaPlan', () => {
  const margen = { arriba: 70, abajo: 84, lados: 16 };
  const TAM = { width: 420, height: 520 };

  it('en una pizarra de ordenador cabe entero al lado de lo que hay', () => {
    const area = { width: 1184, height: 800 };
    const r = huecoParaPlan(TAM, 200, [{ x: 24, y: 70, width: 290, height: 350 }, { x: 330, y: 70, width: 290, height: 340 }], area, margen)!;
    expect(r).toMatchObject({ width: 420, height: 520 });
    expect(r.x).toBeGreaterThanOrEqual(632);
  });

  it('en un móvil se recorta a lo que dejan las barras y baja para no tapar los iconos minimizados', () => {
    const area = { width: 560, height: 760 };
    const barras = { arriba: 90, abajo: 250, lados: 16 };
    const iconos = [{ x: 24, y: 90, width: 44, height: 44 }, { x: 330, y: 90, width: 44, height: 44 }];
    const r = huecoParaPlan(TAM, 200, iconos, area, barras)!;
    expect(r.width).toBe(420);
    expect(r.y).toBeGreaterThanOrEqual(90 + 44);
    expect(r.y + r.height).toBeLessThanOrEqual(760 - 250);
    expect(r.height).toBeGreaterThanOrEqual(200);
    // Sin iconos, todo el alto libre
    expect(huecoParaPlan(TAM, 200, [], area, barras)).toMatchObject({ y: 90, height: 420 });
  });

  it('si no cabe ni con el alto mínimo, lo dice', () => {
    expect(huecoParaPlan(TAM, 200, [{ x: 0, y: 0, width: 1000, height: 1000 }], { width: 600, height: 700 }, margen)).toBeNull();
  });
});

describe('lo guardado en la ventana', () => {
  beforeEach(() => localStorage.clear());

  it('se lee lo que se escribe, y cerrar la ventana lo borra', () => {
    const p = planDeSesion(sesion(), true);
    escribirPlanDeVentana('agenda-2', p.tareas, p.sesion);
    expect(leerPlanDeVentana('agenda-2')).toEqual({ id: 'agenda-2', tareas: p.tareas, sesion: p.sesion });
    expect(leerPlanDeVentana('agenda')).toEqual({ id: 'agenda', tareas: [], sesion: null });
    borrarDatosDeVentana('agenda-2');
    expect(leerPlanDeVentana('agenda-2')).toEqual({ id: 'agenda-2', tareas: [], sesion: null });
  });

  it('lee los planes escritos a mano antes de «Dar la clase» y descarta lo roto', () => {
    localStorage.setItem(claveDatos('agenda', 'plan'), JSON.stringify([{ id: 't1', texto: 'Corregir', hecha: true }]));
    expect(leerPlanDeVentana('agenda').tareas).toEqual([{ id: 't1', texto: 'Corregir', hecha: true }]);
    localStorage.setItem(claveDatos('agenda', 'plan'), '{roto');
    localStorage.setItem(claveDatos('agenda', 'sesion'), JSON.stringify({ origen: { tipo: 'otra' }, titulo: 3 }));
    expect(leerPlanDeVentana('agenda')).toEqual({ id: 'agenda', tareas: [], sesion: null });
    expect(esTareas([{ id: 't', texto: 'x', hecha: false, momento: 5 }])).toBe(false);
  });
});

describe('el encargo a la pizarra', () => {
  beforeEach(() => { tomarEncargo(); });

  it('se recoge una sola vez', () => {
    encargarClase({ claseId: 'c1', plan: null });
    expect(hayEncargo()).toBe(true);
    expect(tomarEncargo()).toEqual({ claseId: 'c1', plan: null });
    expect(tomarEncargo()).toBeNull();
    expect(hayEncargo()).toBe(false);
  });

  it('avisa a la pizarra montada, y a la que se monta después', () => {
    let avisos = 0;
    const dejar = suscribirEncargo(() => { avisos++; });
    expect(avisos).toBe(0);
    encargarClase({ plan: null });
    expect(avisos).toBe(1);
    dejar();
    encargarClase({ plan: null });
    expect(avisos).toBe(1);
    // Sigue esperando: quien se suscribe ahora lo recibe en el acto
    suscribirEncargo(() => { avisos += 10; })();
    expect(avisos).toBe(11);
  });

  it('si la pizarra no llega a abrirse, se olvida', () => {
    encargarClase({ plan: null }, 1000);
    expect(hayEncargo(1000 + ENCARGO_VALE_MS)).toBe(true);
    expect(tomarEncargo(1000 + ENCARGO_VALE_MS + 1)).toBeNull();
  });
});
