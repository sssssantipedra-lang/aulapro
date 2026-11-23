/**
 * El informe como documento para la familia (PDF, vista previa, Word y texto): qué partes lleva y, sobre
 * todo, lo que no lleva nunca (de qué dato sale cada frase, que solo lo ve el docente).
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { CompetencyReport } from '../types';
import { translate, EN_DICT } from '../i18n';
import { CA } from '../i18n/ca';
import { cuerpoDeInformeHtml, informeEnTexto, informesHtml, partesDeInforme, textoDePeriodo, type ContextoDeInforme } from './informeDocumento';
import { informesDocxBlob } from '../services/exportInformeDocx';
import { LOMLOE_COMPETENCES } from './utils';

const es = (k: string, v?: Record<string, string | number>) => translate('es', k, v);
const ctx = (extra: Partial<ContextoDeInforme> = {}): ContextoDeInforme => ({
  grupo: '5.º A', t: es, locale: 'es-ES',
  etiquetaCompetencia: clave => LOMLOE_COMPETENCES.find(c => c.key === clave)?.label ?? '',
  ...extra,
});

const ORIGEN = 'Notas: Media de 8,4 en Lengua';
const deSeguimiento = (extra: Partial<CompetencyReport> = {}): CompetencyReport => ({
  id: 'r1', student_id: 'a', student_name: 'Alumno 1', class_id: 'c1', period: '2ª evaluación', date: '2027-02-10', text: '', origen: 'reglas',
  tabla: [{ clave: 'CCL', valoracion: 'excelente', comentario: '' }, { clave: 'STEM', valoracion: 'mejorable', comentario: '' }],
  seguimiento: {
    desde: '2027-01-01', hasta: '2027-03-31',
    notas: [{ asignatura: 'Lengua', media: 8.4, categorias: [{ nombre: 'Pruebas', peso: 60, media: 8 }, { nombre: 'Tareas', peso: 40, media: 9 }, { nombre: 'Proyectos', peso: 0, media: null }] }],
    asistencia: { dias: 20, faltas: 1, justificadas: 2, retrasos: 0 },
    positivos: [{ texto: 'En Lengua su nota es de 8,4 sobre 10, un buen resultado.', origen: ORIGEN }, { texto: 'Ayuda a quien lo necesita.' }],
    mejorar: [{ texto: 'Ha faltado a clase 1 día sin justificante.', origen: 'Asistencia: 1 falta sin justificar' }],
    observacion: 'Me gustaría veros en enero.',
  },
  ...extra,
});

describe('las partes del informe', () => {
  it('el de seguimiento lleva notas, asistencia, competencias, frases y la observación', () => {
    const p = partesDeInforme(deSeguimiento(), ctx());
    expect(p.titulo).toBe('Informe de seguimiento');
    expect(p.datos).toEqual([['Grupo', '5.º A'], ['Periodo', textoDePeriodo(deSeguimiento(), es, 'es-ES')], ['Fecha', '10 de febrero de 2027']]);
    expect(p.datos[1][1]).toMatch(/^2ª evaluación \(del 1 ene 2027 al 31 mar 2027\)$/);
    // Una categoría sin notas no sale; la nota, con un decimal y la coma del idioma
    expect(p.notas).toEqual([{ asignatura: 'Lengua', filas: [['Pruebas', '60 %', '8,0'], ['Tareas', '40 %', '9,0']], total: ['Nota de la evaluación', '8,4'] }]);
    expect(p.asistencia).toEqual([['Días registrados', '20'], ['Faltas sin justificar', '1'], ['Faltas justificadas', '2'], ['Retrasos', '0']]);
    expect(p.competencias.map(c => [c.clave, c.nombre, c.valoracion])).toEqual([['CCL', 'Comunicación lingüística', 'Excelente'], ['STEM', 'Matemática, ciencia, tecnología e ingeniería', 'Necesita mejorar']]);
    expect(p.positivos).toEqual(['En Lengua su nota es de 8,4 sobre 10, un buen resultado.', 'Ayuda a quien lo necesita.']);
    expect(p.mejorar).toEqual(['Ha faltado a clase 1 día sin justificante.']);
    expect(p.observacion).toBe('Me gustaría veros en enero.');
  });

  it('lo que el docente desmarca no se entrega', () => {
    const r = deSeguimiento();
    const p = partesDeInforme({ ...r, seguimiento: { ...r.seguimiento!, ocultar: ['notas', 'asistencia', 'competencias'] } }, ctx());
    expect(p.notas).toEqual([]);
    expect(p.asistencia).toEqual([]);
    expect(p.competencias).toEqual([]);
    expect(p.positivos).toHaveLength(2);
  });

  it('en «Final de curso» la tabla empieza por la nota de cada evaluación', () => {
    const r = deSeguimiento({ period: 'Final de curso' });
    const p = partesDeInforme({
      ...r, seguimiento: { ...r.seguimiento!, desde: undefined, hasta: undefined, notas: [{ asignatura: 'Lengua', media: 6.6, evaluaciones: [4.8, 8.4, null], categorias: [{ nombre: 'Pruebas', peso: 100, media: 6 }] }] },
    }, ctx());
    expect(p.datos[1]).toEqual(['Periodo', 'Final de curso']);
    expect(p.notas[0].filas).toEqual([['1ª evaluación', '', '4,8'], ['2ª evaluación', '', '8,4'], ['3ª evaluación', '', '—'], ['Pruebas', '100 %', '6,0']]);
    expect(p.notas[0].total).toEqual(['Nota final de curso', '6,6']);
  });

  it('el pie dice quién lo ha hecho: el docente con sus datos, el docente a mano o la IA revisada por él', () => {
    expect(partesDeInforme(deSeguimiento(), ctx()).pie).toMatch(/^Informe elaborado por el docente a partir de las calificaciones/);
    expect(partesDeInforme(deSeguimiento({ text: 'Un párrafo mío.', origen: 'mano' }), ctx()).pie).toMatch(/^Informe elaborado por el docente/);
    expect(partesDeInforme(deSeguimiento({ text: 'Un párrafo.', origen: 'ia' }), ctx()).pie).toMatch(/inteligencia artificial/);
    const aMano: CompetencyReport = { id: 'r2', student_id: 'a', student_name: 'Alumno 1', class_id: 'c1', period: '1ª evaluación', date: '2026-12-01', text: 'Todo escrito por mí.', origen: 'mano' };
    expect(partesDeInforme(aMano, ctx()).pie).toBe('Informe redactado por el docente.');
    expect(partesDeInforme(aMano, ctx()).titulo).toBe('Informe de evaluación competencial');
    // Los de antes no dicen quién los redactó: fue la IA, y el pie de las competencias específicas se añade detrás
    const deAntes = { ...aMano, origen: undefined };
    expect(partesDeInforme(deAntes, ctx({ pieExtra: () => 'Competencias específicas según el Decreto.' })).pie).toMatch(/inteligencia artificial.*Competencias específicas según el Decreto\.$/);
  });

  it('los pies y los títulos están en inglés y en catalán', () => {
    const r = deSeguimiento();
    const claves = [
      partesDeInforme(r, ctx()).pie, partesDeInforme({ ...r, origen: 'ia', text: 'x' }, ctx()).pie,
      'Informe redactado por el docente.', 'Informe de seguimiento', 'Nota de la evaluación', 'Nota final de curso',
      'Días registrados', 'Faltas sin justificar', 'Faltas justificadas', 'Retrasos', 'Calificaciones', 'Asistencia', 'Competencias clave',
      'Lo positivo', 'A mejorar', 'Observaciones del docente', '{periodo} (del {desde} al {hasta})', 'Grupo', 'Periodo', 'Fecha',
    ];
    expect(claves.filter(k => !(k in EN_DICT) || !(k in CA))).toEqual([]);
  });
});

describe('el documento', () => {
  it('nunca lleva de qué dato sale cada frase: eso es solo para el docente', () => {
    const r = deSeguimiento();
    const html = informesHtml([r], 'informe', 'es', ctx());
    const texto = informeEnTexto(r, ctx());
    for (const doc of [html, texto]) {
      expect(doc).toContain('En Lengua su nota es de 8,4 sobre 10, un buen resultado.');
      expect(doc).not.toContain(ORIGEN);
      expect(doc).not.toContain('Asistencia: 1 falta sin justificar');
      expect(doc).not.toMatch(/Sale de/);
    }
    expect(JSON.stringify(partesDeInforme(r, ctx()))).not.toContain(ORIGEN);
  });

  it('el HTML lleva su @page, una sección por alumno y lo escrito a mano escapado', () => {
    const r = deSeguimiento();
    const malo = { ...r, id: 'r3', student_name: 'Alumno <2>', seguimiento: { ...r.seguimiento!, observacion: 'Un 5 < 6 & <script>alert(1)</script>' } };
    const html = informesHtml([r, malo], 'informes', 'es', ctx());
    expect(html).toMatch(/@page \{ size: A4 portrait/);
    expect(html.match(/<section class="alumno hoja/g)).toHaveLength(2);
    // Cada alumno en su página, sin página en blanco al final
    expect(html.match(/class="alumno hoja salto"/g)).toHaveLength(1);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Alumno &lt;2&gt;');
    expect(html).toContain('Un 5 &lt; 6 &amp; &lt;script&gt;');
  });

  it('la tabla de competencias no lleva la columna de comentarios si no hay ninguno', () => {
    const r = deSeguimiento();
    const sin = cuerpoDeInformeHtml(partesDeInforme(r, ctx()), es);
    expect(sin).not.toContain('Comentario');
    const con = cuerpoDeInformeHtml(partesDeInforme({ ...r, tabla: [{ clave: 'CCL', valoracion: 'excelente', comentario: 'Expone con soltura.' }] }, ctx()), es);
    expect(con).toContain('<th>Comentario</th>');
    expect(con).toContain('Expone con soltura.');
  });

  it('un informe solo de texto (el de la IA o el escrito a mano) sale como siempre: el texto y, si la tiene, su tabla', () => {
    const r: CompetencyReport = {
      id: 'r4', student_id: 'a', student_name: 'Alumno 1', class_id: 'c1', period: '1ª evaluación', date: '2026-12-01', text: 'Primer párrafo.\n\nSegundo párrafo.',
      tabla: [{ clave: 'CD', valoracion: 'bien', comentario: 'Usa bien las herramientas.' }],
    };
    const cuerpo = cuerpoDeInformeHtml(partesDeInforme(r, ctx()), es);
    expect(cuerpo).toContain('<div class="cuerpo">Primer párrafo.');
    expect(cuerpo).toContain('<table class="comp">');
    expect(cuerpo).not.toContain('<h2>');
    expect(informesHtml([r], 'x', 'es', ctx())).toContain('<section class="alumno">');
    expect(informeEnTexto(r, ctx())).toContain('- CD (Digital): Bien. Usa bien las herramientas.');
  });

  it('el Word lleva las mismas partes y tampoco el origen de las frases', async () => {
    const blob = await informesDocxBlob([deSeguimiento(), deSeguimiento({ id: 'r5', student_name: 'Alumno 2' })], ctx());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    for (const x of ['Alumno 1', 'Alumno 2', 'Informe de seguimiento', 'CALIFICACIONES', 'Nota de la evaluación', 'Faltas sin justificar', 'Ayuda a quien lo necesita.', 'Me gustaría veros en enero.', 'Informe elaborado por el docente']) {
      expect(xml).toContain(x);
    }
    expect(xml).not.toContain(ORIGEN);
    // Un salto de página entre los dos y ninguno al final
    expect(xml.match(/<w:br w:type="page"\/>/g)).toHaveLength(1);
  });
});
