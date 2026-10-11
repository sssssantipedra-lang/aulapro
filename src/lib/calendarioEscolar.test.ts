/**
 * El calendario escolar de cada comunidad: lo que trae la app de serie pasa
 * las comprobaciones, cada día sale como vacaciones o no lectivo según su
 * norma, y una descarga solo sustituye lo guardado si es válida y más nueva.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import deSerie from '../../web/sitio/calendario-escolar.json';
import {
  validarArchivo, cursoDe, calendarioDe, diaEscolar, marcasDelDia, sinCursosPasados, tieneCalendario,
  type ArchivoCalendarios, type CalendarioCurso,
} from './calendarioEscolar';
import { fromIsoDate } from './utils';

const serie = validarArchivo(deSerie)!;
const copia = (): ArchivoCalendarios => JSON.parse(JSON.stringify(deSerie));

describe('calendario de serie', () => {
  it('pasa las comprobaciones y trae el curso 2026-2027 de las tres comunidades', () => {
    expect(serie).not.toBeNull();
    for (const c of ['comunitat-valenciana', 'cataluna', 'madrid'] as const) {
      expect(calendarioDe(serie, c, '2026-2027')).not.toBeNull();
    }
    expect(tieneCalendario(serie, 'andalucia')).toBe(false);
  });

  it('ningún día no lectivo cae en fin de semana ni dentro de unas vacaciones', () => {
    for (const cal of serie.calendarios) {
      for (const d of cal.noLectivos) {
        const dia = fromIsoDate(d.fecha).getDay();
        expect([0, 6], `${cal.comunidad} ${d.fecha}`).not.toContain(dia);
        expect(cal.vacaciones.some(v => d.fecha >= v.desde && d.fecha <= v.hasta), `${cal.comunidad} ${d.fecha}`).toBe(false);
      }
    }
  });

  it('Madrid, según la Orden 2034/2026: Primaria empieza el 7 de septiembre y la ESO el 8', () => {
    const m = calendarioDe(serie, 'madrid', '2026-2027')!;
    expect(m.verificado).toBe(true);
    expect(m.clases.primaria).toEqual({ inicio: '2026-09-07', fin: '2027-06-18' });
    expect(marcasDelDia(m, '2026-09-08', ['primaria', 'eso'])).toEqual([{ tipo: 'inicio', etapa: 'eso' }]);
    expect(diaEscolar(m, '2026-12-23')).toEqual({ tipo: 'vacaciones', nombre: 'Vacaciones de Navidad' });
    expect(diaEscolar(m, '2027-01-07')).toEqual({ tipo: 'no-lectivo', nombre: 'Día no lectivo' });
    expect(diaEscolar(m, '2027-01-11')).toBeNull();
  });
});

describe('Comunitat Valenciana y Cataluña, según sus documentos oficiales', () => {
  it('la Resolución de 15 de junio de 2026 (DOGV 10387): del 9 de septiembre al 18 de junio y cuatro festivos', () => {
    const cv = calendarioDe(serie, 'comunitat-valenciana', '2026-2027')!;
    expect(cv.verificado).toBe(true);
    expect(cv.clases.eso).toEqual({ inicio: '2026-09-09', fin: '2027-06-18' });
    expect(cv.noLectivos.map(d => d.fecha)).toEqual(['2026-10-09', '2026-10-12', '2026-12-08', '2027-03-19']);
    expect(cv.vacaciones.map(v => [v.desde, v.hasta])).toEqual([['2026-12-22', '2027-01-06'], ['2027-03-25', '2027-04-05']]);
  });

  it('el calendario de la Generalitat de Catalunya: del 8 de septiembre al 21 de junio y tres festivos', () => {
    const cat = calendarioDe(serie, 'cataluna', '2026-2027')!;
    expect(cat.clases.primaria).toEqual({ inicio: '2026-09-08', fin: '2027-06-21' });
    expect(cat.noLectivos.map(d => d.fecha)).toEqual(['2026-09-11', '2026-10-12', '2026-12-08']);
    expect(cat.vacaciones.map(v => [v.desde, v.hasta])).toEqual([['2026-12-22', '2027-01-07'], ['2027-03-20', '2027-03-29']]);
  });
});

describe('comprobaciones', () => {
  const cambia = (f: (c: CalendarioCurso) => void) => { const a = copia(); f(a.calendarios[0]); return validarArchivo(a); };

  it('rechaza fechas que no existen o caen fuera de su curso', () => {
    expect(cambia(c => { c.noLectivos[0].fecha = '2026-02-30'; })).toBeNull();
    expect(cambia(c => { c.noLectivos[0].fecha = '2027-09-15'; })).toBeNull();
    expect(cambia(c => { c.vacaciones[0].hasta = '2026-12-01'; })).toBeNull();
  });

  it('rechaza cantidades raras, la fuente sin enlace seguro y comunidades sin calendario', () => {
    expect(cambia(c => { c.noLectivos = Array.from({ length: 31 }, () => ({ fecha: '2026-10-12', nombre: 'x' })); })).toBeNull();
    expect(cambia(c => { c.url = 'http://ejemplo.es'; })).toBeNull();
    expect(cambia(c => { (c as { comunidad: string }).comunidad = 'atlantida'; })).toBeNull();
    const a = copia(); a.calendarios.push(a.calendarios[0]);
    expect(validarArchivo(a)).toBeNull();
  });
});

describe('cursos', () => {
  it('el curso va de septiembre a agosto, y los pasados se borran', () => {
    expect(cursoDe(new Date(2026, 8, 1))).toBe('2026-2027');
    expect(cursoDe(new Date(2027, 7, 31))).toBe('2026-2027');
    expect(sinCursosPasados(serie, new Date(2027, 8, 10)).calendarios).toEqual([]);
    expect(sinCursosPasados(serie, new Date(2026, 9, 10)).calendarios).toHaveLength(3);
  });
});

describe('descarga', () => {
  type Mod = typeof import('./calendarioEscolar');
  let mod: Mod;
  const guardado = new Map<string, string>();
  beforeEach(async () => {
    vi.resetModules();
    guardado.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    });
    mod = await import('./calendarioEscolar');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('un archivo válido y más nuevo sustituye al de serie, se guarda y avisa', async () => {
    const nuevo = copia();
    nuevo.actualizado = '2026-12-01';
    nuevo.calendarios[2].noLectivos.push({ fecha: '2027-05-03', nombre: 'Festivo' });
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(nuevo), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const aviso = vi.fn();
    mod.suscribir(aviso);
    await mod.actualizarCalendarios(new Date(2026, 9, 11));
    expect(fetch).toHaveBeenCalledWith(mod.URL_CALENDARIO, expect.objectContaining({ credentials: 'omit' }));
    expect(aviso).toHaveBeenCalled();
    expect(mod.calendarios().actualizado).toBe('2026-12-01');
    expect(JSON.parse(guardado.get('aulapro_calendario_escolar')!).actualizado).toBe('2026-12-01');
    // Una sola vez por sesión
    await mod.actualizarCalendarios();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('lo que no pasa las comprobaciones, o sin conexión, deja lo que había', async () => {
    const malo = copia(); malo.actualizado = '2027-01-01'; malo.calendarios[0].url = 'ftp://x';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(malo), { status: 200 })));
    await mod.actualizarCalendarios();
    expect(mod.calendarios().actualizado).toBe(serie.actualizado);
    expect(guardado.size).toBe(0);

    vi.resetModules();
    mod = await import('./calendarioEscolar');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await mod.actualizarCalendarios();
    expect(mod.calendarios().actualizado).toBe(serie.actualizado);
  });

  it('al abrir sin conexión usa lo último guardado si es más nuevo que lo de serie', async () => {
    const nuevo = copia(); nuevo.actualizado = '2026-12-01';
    guardado.set('aulapro_calendario_escolar', JSON.stringify(nuevo));
    vi.resetModules();
    mod = await import('./calendarioEscolar');
    expect(mod.calendarios().actualizado).toBe('2026-12-01');
  });
});
