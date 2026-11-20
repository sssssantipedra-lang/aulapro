import { describe, it, expect } from 'vitest';
import { copiasQueSobran, copiaConMotivo, fechaDeCopia, MAX_COPIAS, COPIAS_RECIENTES } from './copiasEscalonadas';

/** El nombre que pone `backup()` a una copia hecha en ese momento (hora local del docente). */
function copia(anio: number, mes: number, dia: number, hora: number, minuto = 0, motivo = ''): string {
  const d = new Date(anio, mes - 1, dia, hora, minuto, 0);
  return `copia-${d.toISOString().replace(/[:.]/g, '-').slice(0, 19)}${motivo ? '-' + motivo : ''}.json`;
}
const quedan = (nombres: string[]) => { const fuera = new Set(copiasQueSobran(nombres)); return nombres.filter(n => !fuera.has(n)); };

/** Un día de clase: una copia cada 10 minutos de 9:00 a 13:50 (30 copias). */
function jornada(anio: number, mes: number, dia: number): string[] {
  const out: string[] = [];
  for (let h = 9; h < 14; h++) for (let m = 0; m < 60; m += 10) out.push(copia(anio, mes, dia, h, m));
  return out;
}

describe('el nombre de una copia', () => {
  it('lleva su fecha y, si lo tiene, su motivo', () => {
    expect(fechaDeCopia('copia-2026-11-20T10-30-05.json')?.toISOString()).toBe('2026-11-20T10:30:05.000Z');
    expect(fechaDeCopia('copia-2026-11-20T10-30-05-antes-de-vaciar.json')?.toISOString()).toBe('2026-11-20T10:30:05.000Z');
    expect(copiaConMotivo('copia-2026-11-20T10-30-05-antes-de-vaciar.json')).toBe(true);
    expect(copiaConMotivo('copia-2026-11-20T10-30-05.json')).toBe(false);
    expect(fechaDeCopia('copia-de-otra-cosa.json')).toBeNull();
    expect(fechaDeCopia('datos.json')).toBeNull();
  });
});

describe('qué copias se conservan', () => {
  it('con pocas copias no sobra ninguna', () => {
    expect(copiasQueSobran([])).toEqual([]);
    expect(copiasQueSobran(jornada(2026, 11, 20).slice(0, COPIAS_RECIENTES))).toEqual([]);
  });

  it('en un día de trabajo: las 5 últimas y la primera del día', () => {
    const hoy = jornada(2026, 11, 20);
    expect(quedan(hoy)).toEqual([hoy[0], ...hoy.slice(-5)]);
  });

  it('nunca sobra la copia que se acaba de hacer', () => {
    const todas: string[] = [];
    for (const d of [9, 10, 11, 12, 13, 16, 17, 18, 19, 20]) {
      for (const c of jornada(2026, 11, d)) {
        todas.push(c);
        expect(copiasQueSobran(todas)).not.toContain(c);
      }
    }
  });

  it('tras varias semanas de uso: 12 copias como mucho, que llegan a semanas atrás', () => {
    expect(MAX_COPIAS).toBe(12);
    // Cinco semanas de lunes a viernes, podando después de cada copia, como hace la app
    let hay: string[] = [];
    const lunes = [19, 26, 2, 9, 16];   // 19 y 26 de octubre; 2, 9 y 16 de noviembre de 2026
    lunes.forEach((l, i) => {
      for (let d = 0; d < 5; d++) {
        for (const c of jornada(2026, i < 2 ? 10 : 11, l + d)) { hay.push(c); hay = quedan(hay); }
      }
    });
    expect(hay.length).toBe(MAX_COPIAS);
    const ultimo = jornada(2026, 11, 20);
    expect(hay).toEqual([
      // Por detrás de los días que se conservan, la primera copia de cada una de las tres últimas semanas
      // (la del lunes 16 es la de esta misma semana)
      copia(2026, 11, 2, 9), copia(2026, 11, 9, 9), copia(2026, 11, 16, 9),
      // La primera de cada uno de los cuatro últimos días con uso (el viernes 20 es hoy)
      copia(2026, 11, 17, 9), copia(2026, 11, 18, 9), copia(2026, 11, 19, 9), copia(2026, 11, 20, 9),
      // Y las cinco últimas
      ...ultimo.slice(-5),
    ]);
  });

  it('la copia que se queda de un día no cambia con las horas: es la primera', () => {
    let hay: string[] = jornada(2026, 11, 19);
    hay = quedan(hay);
    const manana = jornada(2026, 11, 20);
    for (const c of manana) { hay.push(c); hay = quedan(hay); expect(hay).toContain(copia(2026, 11, 19, 9)); }
  });

  it('solo cuentan los días con uso: unas vacaciones no se llevan las copias', () => {
    let hay: string[] = [];
    for (const d of [14, 15, 16, 17, 18]) for (const c of jornada(2026, 12, d)) { hay.push(c); hay = quedan(hay); }
    const antes = [...hay];
    // Tres semanas después se abre la app y se hace una copia
    hay.push(copia(2027, 1, 8, 9, 10)); hay = quedan(hay);
    expect(hay.length).toBeLessThanOrEqual(MAX_COPIAS);
    expect(hay).toContain(copia(2026, 12, 18, 9));
    expect(hay).toContain(copia(2026, 12, 14, 9));
    expect(antes.filter(c => !hay.includes(c)).length).toBeLessThanOrEqual(1);
  });

  it('una copia con nombre («antes-de-vaciar») manda sobre las demás de su día y de su semana', () => {
    const dia = jornada(2026, 6, 22);
    const antesDeVaciar = copia(2026, 6, 22, 11, 5, 'antes-de-vaciar');
    let hay = quedan([...dia, antesDeVaciar]);
    expect(hay).toContain(antesDeVaciar);
    expect(hay).not.toContain(dia[0]);
    // Y sigue ahí semanas después, con el curso nuevo ya en marcha
    for (const d of [7, 8, 9, 10, 11, 14, 15, 16]) for (const c of jornada(2026, 9, d)) { hay.push(c); hay = quedan(hay); }
    expect(hay).toContain(antesDeVaciar);
    expect(hay.length).toBeLessThanOrEqual(MAX_COPIAS);
  });

  it('un archivo cuyo nombre no se entiende no se borra', () => {
    const hay = [...jornada(2026, 11, 20), 'copia-rara.json', 'copia-2026-99-99.json'];
    const sobran = copiasQueSobran(hay);
    expect(sobran).not.toContain('copia-rara.json');
    expect(sobran).not.toContain('copia-2026-99-99.json');
  });

  it('no depende del orden en que llegan los nombres ni de que vengan repetidos', () => {
    const hay = [...jornada(2026, 11, 19), ...jornada(2026, 11, 20)];
    const alReves = [...hay].reverse();
    expect(copiasQueSobran([...alReves, ...hay]).sort()).toEqual(copiasQueSobran(hay).sort());
  });
});
