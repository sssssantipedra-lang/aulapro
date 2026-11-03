/**
 * El calendario escolar de cada comunidad: lo que trae la app de serie pasa
 * las comprobaciones, cada día sale como vacaciones o no lectivo según su
 * norma, y una descarga solo sustituye lo guardado si es válida y más nueva.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import deSerie from '../../web/sitio/calendario-escolar.json';
import {
  validarArchivo, cursoDe, esLectivo, calendarioDe, diaEscolar, faltaProvincia, marcasDelDia, sinCursosPasados, tieneCalendario,
  type ArchivoCalendarios, type CalendarioCurso,
} from './calendarioEscolar';
import { fromIsoDate } from './utils';

const serie = validarArchivo(deSerie)!;
const copia = (): ArchivoCalendarios => JSON.parse(JSON.stringify(deSerie));

describe('calendario de serie', () => {
  it('pasa las comprobaciones y trae el curso 2026-2027 de las tres comunidades y de siete provincias andaluzas', () => {
    expect(serie).not.toBeNull();
    for (const c of ['comunitat-valenciana', 'cataluna', 'madrid'] as const) {
      expect(calendarioDe(serie, c, '2026-2027')).not.toBeNull();
    }
    for (const p of ['almeria', 'cadiz', 'cordoba', 'granada', 'huelva', 'malaga', 'sevilla'] as const) {
      expect(calendarioDe(serie, 'andalucia', '2026-2027', p), p).not.toBeNull();
    }
    expect(tieneCalendario(serie, 'aragon')).toBe(false);
  });

  it('Andalucía: el calendario es de cada provincia; sin provincia no hay ninguno y la Agenda la pide', () => {
    expect(calendarioDe(serie, 'andalucia', '2026-2027')).toBeNull();
    expect(tieneCalendario(serie, 'andalucia')).toBe(false);
    expect(faltaProvincia(serie, 'andalucia', undefined)).toBe(true);
    expect(faltaProvincia(serie, 'andalucia', 'sevilla')).toBe(false);
    expect(faltaProvincia(serie, 'madrid', undefined)).toBe(false);
    // Jaén: su resolución aún no está; ni calendario ni aviso
    expect(tieneCalendario(serie, 'andalucia', 'jaen')).toBe(false);
    expect(calendarioDe(serie, 'andalucia', '2026-2027', 'jaen')).toBeNull();
    // Cada provincia, con su resolución
    const sevilla = calendarioDe(serie, 'andalucia', '2026-2027', 'sevilla')!;
    expect(sevilla.clases).toEqual({ primaria: { inicio: '2026-09-10', fin: '2027-06-23' }, eso: { inicio: '2026-09-15', fin: '2027-06-23' } });
    expect(diaEscolar(sevilla, '2027-01-08')).toEqual({ tipo: 'no-lectivo', nombre: 'Día no lectivo provincial' });
    expect(diaEscolar(sevilla, '2027-03-01')).toEqual({ tipo: 'no-lectivo', nombre: 'Día de Andalucía' });
    const malaga = calendarioDe(serie, 'andalucia', '2026-2027', 'malaga')!;
    expect(diaEscolar(malaga, '2027-02-23')).toEqual({ tipo: 'vacaciones', nombre: 'Semana Blanca' });
    expect(esLectivo(serie, 'andalucia', fromIsoDate('2027-02-23'), ['primaria'], 'malaga')).toBe(false);
    expect(esLectivo(serie, 'andalucia', fromIsoDate('2027-02-23'), ['primaria'], 'sevilla')).toBe(true);
    // Los festivos de la Junta (2 de noviembre, 7 de diciembre, por caer en domingo el 1 y el 6) en todas
    for (const c of serie.calendarios.filter(c => c.comunidad === 'andalucia')) {
      for (const f of ['2026-10-12', '2026-11-02', '2026-12-07', '2026-12-08', '2027-03-01']) {
        expect(diaEscolar(c, f), `${c.provincia} ${f}`).not.toBeNull();
      }
    }
  });

  it('la provincia es obligatoria en Andalucía y no se admite en las demás', () => {
    const sin = copia();
    delete (sin.calendarios.find(c => c.comunidad === 'andalucia') as Partial<CalendarioCurso>).provincia;
    expect(validarArchivo(sin)).toBeNull();
    const rara = copia();
    (rara.calendarios.find(c => c.comunidad === 'andalucia') as unknown as Record<string, unknown>).provincia = 'toledo';
    expect(validarArchivo(rara)).toBeNull();
    const conProvincia = copia();
    (conProvincia.calendarios.find(c => c.comunidad === 'madrid') as unknown as Record<string, unknown>).provincia = 'sevilla';
    expect(validarArchivo(conProvincia)).toBeNull();
    const repetida = copia();
    repetida.calendarios.push(JSON.parse(JSON.stringify(repetida.calendarios.find(c => c.provincia === 'cadiz'))));
    expect(validarArchivo(repetida)).toBeNull();
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
    // Cataluña ya lleva los tres cursos de su orden: en septiembre de 2027 quedan los dos últimos
    expect(sinCursosPasados(serie, new Date(2027, 8, 10)).calendarios.map(c => `${c.comunidad} ${c.curso}`)).toEqual(['cataluna 2027-2028', 'cataluna 2028-2029']);
    expect(sinCursosPasados(serie, new Date(2029, 8, 10)).calendarios).toEqual([]);
    expect(sinCursosPasados(serie, new Date(2026, 9, 10)).calendarios).toHaveLength(12);   // 5 de las tres comunidades y 7 provincias andaluzas
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
    nuevo.calendarios.find(c => c.comunidad === 'madrid')!.noLectivos.push({ fecha: '2027-05-03', nombre: 'Festivo' });
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

describe('esLectivo', () => {
  const dia = (iso: string) => fromIsoDate(iso);

  it('un festivo, unas vacaciones o un día fuera del curso no son lectivos', () => {
    expect(esLectivo(serie, 'madrid', dia('2026-10-13'), ['eso'])).toBe(true);
    expect(esLectivo(serie, 'madrid', dia('2026-10-12'), ['eso'])).toBe(false);
    expect(esLectivo(serie, 'madrid', dia('2026-12-28'), ['eso'])).toBe(false);
    expect(esLectivo(serie, 'madrid', dia('2027-07-05'), ['eso'])).toBe(false);
  });

  it('el primer día de cada etapa cuenta solo para la suya', () => {
    expect(esLectivo(serie, 'madrid', dia('2026-09-07'), ['eso'])).toBe(false);
    expect(esLectivo(serie, 'madrid', dia('2026-09-07'), ['primaria', 'eso'])).toBe(true);
  });

  it('sin calendario de la comunidad o del curso, manda el horario', () => {
    expect(esLectivo(serie, 'andalucia', dia('2026-10-12'), ['eso'])).toBe(true);
    expect(esLectivo(serie, undefined, dia('2026-12-28'), ['eso'])).toBe(true);
  });
});
