import { describe, it, expect, vi } from 'vitest';
import { filasDeLote, generarLote } from './apoyoLote';
import { APOYO_VACIO, cerrarTrimestre } from '../lib/apoyo';
import type { ApoyoData, DocumentoApoyo } from '../types/apoyo';

const alumno = (id: string) => ({ id, nombre: `Alumno ${id}`, claseOrigen: '', categorias: [], diagnostico: '', necesidades: '', notas: '' });
const programa = (alumnoId: string) => ({ id: `p${alumnoId}`, alumnoId, ambito: 'Lectoescritura', especialidad: 'PT' as const, objetivos: [{ id: `o${alumnoId}`, texto: 'Leer', trimestres: [1 as const], criterios: [] }] });
const doc = (alumnoId: string, tipo: DocumentoApoyo['tipo'] = 'familia', trimestre: 1 | 2 | 3 = 1): DocumentoApoyo => ({ id: `d${alumnoId}${tipo}${trimestre}`, alumnoId, tipo, trimestre, fecha: '2026-12-01', titulo: 't', apartados: [] });

const datos = (): ApoyoData => {
  let d: ApoyoData = { ...APOYO_VACIO, alumnos: [alumno('1'), alumno('2'), alumno('3')], programas: [programa('1'), programa('2')], documentos: [doc('1')] };
  d = cerrarTrimestre(d, '2', 1, [{ objetivoId: 'o2', resultado: 'si', comentario: '', seguir: false }], '2026-12-15');
  return d;
};

describe('documentos de todo el alumnado', () => {
  it('cada fila dice si puede prepararse, si el trimestre está cerrado y si ya tiene el documento', () => {
    const f = filasDeLote(datos(), 'familia', 1);
    expect(f.map(x => [x.alumno.id, x.conProgramas, x.cerrado, !!x.existente])).toEqual([['1', true, false, true], ['2', true, true, false], ['3', false, false, false]]);
    // Otro trimestre: el informe de la familia del 1.º no es el del 2.º; la programación no depende del trimestre
    expect(filasDeLote(datos(), 'familia', 2)[0].existente).toBeUndefined();
    expect(filasDeLote(datos(), 'programacion', 2).every(x => x.cerrado)).toBe(true);
  });

  it('prepara de uno en uno, guarda cada documento al acabar y cuenta los que fallan', async () => {
    const guardados: string[] = [];
    const generar = vi.fn(async (a: { alumno: { id: string }; anterior?: DocumentoApoyo }, cb?: { onError?: (m: string) => void }) => {
      if (a.alumno.id === '2') { cb?.onError?.('falló'); return null; }
      return doc(a.alumno.id, 'familia', 1);
    });
    const r = await generarLote({
      data: datos(), tipo: 'familia', trimestre: 1, alumnoIds: ['1', '2'], comunidad: undefined, lang: 'es', nombreCurso: () => '', hoy: '2026-12-20',
      alTerminar: d => guardados.push(d.alumnoId), generar: generar as never, abrirMaterias: async () => [],
    });
    expect(r).toEqual({ hechos: 1, fallidos: ['Alumno 2'], cancelado: false });
    expect(guardados).toEqual(['1']);
    // Al que ya tenía documento se le pasa el anterior (el PAP se va rellenando)
    expect(generar.mock.calls[0][0].anterior?.alumnoId).toBe('1');
  });

  it('se puede parar entre un alumno y el siguiente', async () => {
    let parar = false;
    const r = await generarLote({
      data: datos(), tipo: 'familia', trimestre: 1, alumnoIds: ['1', '2'], comunidad: undefined, lang: 'es', nombreCurso: () => '', hoy: '2026-12-20',
      alTerminar: () => { parar = true; }, cancelado: () => parar, generar: (async (a: { alumno: { id: string } }) => doc(a.alumno.id)) as never, abrirMaterias: async () => [],
    });
    expect(r).toEqual({ hechos: 1, fallidos: [], cancelado: true });
  });
});
