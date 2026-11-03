/**
 * La adaptación curricular significativa (ACS) de Andalucía en PDF y en Word, con sus cuatro bloques. El contenido se
 * prepara una vez (`contenidoAcs`) y se pinta en los dos formatos, con el mismo aspecto que el resto de documentos de
 * PT y AL. Los textos de las competencias, los criterios y los saberes son los oficiales del curso de referencia.
 * Ver `docs/PTAL.md`, «Adaptación curricular significativa (Andalucía)».
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, WidthType, AlignmentType,
} from 'docx';
import { BORDES, ESTILO, celda, esc, nl2br, titulo2 } from './apoyoDocumentos';
import { ESTRATEGIAS_ACS, GRADOS_ACS, desfaseCursos, filasSeguimiento } from '../lib/acs';
import { competenciasDe } from '../lib/curriculum';
import { translate, type Lang } from '../i18n';
import { downloadFile } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';
import type { MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import type { AcsApoyo, AlumnoApoyo, CursoDe, SeguimientoAcs } from '../types/apoyo';

type T = (k: string, vars?: Record<string, string | number>) => string;

export type ParteAcs =
  | { tipo: 'filas'; filas: [string, string][] }
  | { tipo: 'lista'; titulo: string; items: string[] }
  | { tipo: 'texto'; titulo: string; texto: string }
  | { tipo: 'tabla'; titulo?: string; columnas: string[]; filas: string[][]; anchos: number[] };

export interface ContenidoAcs {
  titulo: string;
  cabecera: [string, string][];
  secciones: { titulo: string; partes: ParteAcs[] }[];
}

export interface DocenteAcs { nombre: string; centro: string; curso: string }

const fecha = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export function tituloAcs(acs: AcsApoyo, t: T): string {
  return `${t('Adaptación curricular significativa')} · ${acs.materiaAula.trim() || acs.area}`;
}

/** El texto oficial de cada cosa elegida; sin currículo cargado, solo el código. */
export function textosElegidos(acs: AcsApoyo, materia: MateriaDeClase | undefined) {
  const entry = materia?.entry;
  const grupo = materia?.grupo ?? '';
  const comps = entry ? competenciasDe(entry, grupo) : [];
  const crits = entry?.criterios[grupo] ?? [];
  const bloques = entry?.saberes[grupo] ?? [];
  return {
    competencias: acs.competencias.map(n => {
      const c = comps.find(x => x.n === n);
      return c ? `CE${n}. ${c.texto}` : `CE${n}`;
    }),
    criterios: acs.criterios.map(cod => {
      const c = crits.find(x => x.codigo === cod);
      return c ? `${cod}. ${c.texto}` : cod;
    }),
    saberes: acs.saberes.map(b => {
      const x = bloques.find(y => y.bloque === b);
      return x ? `${b}. ${x.tituloBloque}` : b;
    }),
  };
}

/** Cómo se nombra una fila del seguimiento: el criterio con su texto o el bloque con su título. */
export function nombreFila(f: Pick<SeguimientoAcs, 'tipo' | 'clave'>, materia: MateriaDeClase | undefined, t: T): string {
  const grupo = materia?.grupo ?? '';
  if (f.tipo === 'criterio') {
    const c = materia?.entry.criterios[grupo]?.find(x => x.codigo === f.clave);
    return c ? `${f.clave}. ${c.texto}` : f.clave;
  }
  const b = materia?.entry.saberes[grupo]?.find(x => x.bloque === f.clave);
  return `${t('Saberes')} ${f.clave}${b ? `. ${b.tituloBloque}` : ''}`;
}

export function contenidoAcs(
  acs: AcsApoyo, alumno: AlumnoApoyo, materia: MateriaDeClase | undefined, docente: DocenteAcs,
  nombreCurso: (c: CursoDe) => string, lang: Lang,
): ContenidoAcs {
  const t: T = (k, vars) => translate(lang, k, vars);
  const desfase = desfaseCursos(alumno.matricula, acs.nivel);
  const elegidos = textosElegidos(acs, materia);
  const estrategias = (grupo: 'metodologica' | 'organizativa') =>
    ESTRATEGIAS_ACS.filter(e => e.grupo === grupo && acs.estrategias.includes(e.id)).map(e => t(e.texto));
  const grado = (g: SeguimientoAcs['grado']) => (g ? t(GRADOS_ACS.find(x => x.id === g)!.texto) : '');
  const limpia = (filas: [string, string][]) => filas.filter(([, v]) => v.trim() !== '');

  const cabecera = limpia([
    [t('Alumno o alumna'), alumno.nombre],
    [t('Clase de origen'), alumno.claseOrigen],
    [t('Curso'), alumno.matricula ? nombreCurso(alumno.matricula) : ''],
    [t('Curso escolar'), docente.curso],
    [t('Necesidades específicas de apoyo educativo'), alumno.categorias.map(c => t(c)).join(', ')],
    [t('Centro'), docente.centro],
  ]);

  const seguimiento = ([1, 2, 3] as const).map(n => {
    const filas = filasSeguimiento(acs, n);
    const partes: ParteAcs[] = [{
      tipo: 'tabla', titulo: t('{n}º trimestre', { n }),
      columnas: [t('Criterio de evaluación o saber básico'), t('Grado de consecución'), t('Observaciones')],
      filas: filas.map(f => [nombreFila(f, materia, t), grado(f.grado), f.observaciones]),
      anchos: [50, 18, 32],
    }];
    if (acs.ajustes[n]?.trim()) partes.push({ tipo: 'texto', titulo: t('Medidas de ajuste del {n}º trimestre', { n }), texto: acs.ajustes[n]! });
    return partes;
  }).flat();

  return {
    titulo: tituloAcs(acs, t),
    cabecera,
    secciones: [
      {
        titulo: `1. ${t('Datos generales y dictamen')}`,
        partes: [{
          tipo: 'filas', filas: limpia([
            [t('Fecha del informe de evaluación psicopedagógica'), fecha(acs.fechaInforme)],
            [t('Curso de referencia de la ACS'), nombreCurso(acs.nivel)],
            [t('Desfase curricular'), desfase === null ? '' : t(desfase === 1 ? '{n} curso' : '{n} cursos', { n: desfase })],
            [t('Justificación del desfase'), acs.justificacion],
            [t('Tutor o tutora'), acs.responsables.tutor],
            [t('Especialista de PT o AL'), acs.responsables.especialista],
            [t('Profesorado de la materia'), acs.responsables.materia],
          ]),
        }],
      },
      {
        titulo: `2. ${t('Selección curricular')}`,
        partes: [
          { tipo: 'filas', filas: limpia([
            [t('Área o materia del curso de referencia'), acs.area],
            [t('Materia en su clase'), acs.materiaAula.trim() && acs.materiaAula.trim() !== acs.area ? acs.materiaAula : ''],
          ]) },
          { tipo: 'lista', titulo: t('Competencias específicas'), items: elegidos.competencias },
          { tipo: 'lista', titulo: t('Criterios de evaluación'), items: elegidos.criterios },
          { tipo: 'lista', titulo: t('Saberes básicos'), items: elegidos.saberes },
        ],
      },
      {
        titulo: `3. ${t('Adaptaciones metodológicas y criterios de calificación')}`,
        partes: [
          { tipo: 'lista', titulo: t('Estrategias metodológicas'), items: estrategias('metodologica') },
          { tipo: 'lista', titulo: t('Estrategias organizativas'), items: estrategias('organizativa') },
          { tipo: 'texto', titulo: t('Otras estrategias'), texto: acs.otrasEstrategias },
          {
            tipo: 'tabla', titulo: t('Instrumentos de evaluación adaptados'),
            columnas: [t('Instrumento'), t('Peso en la calificación')],
            filas: acs.instrumentos.map(i => [i.nombre, `${i.peso} %`]), anchos: [75, 25],
          },
          { tipo: 'texto', titulo: t('Criterios de calificación'), texto: acs.calificacion },
        ],
      },
      { titulo: `4. ${t('Seguimiento y valoración trimestral')}`, partes: seguimiento },
    ],
  };
}

/** Las partes sin nada que decir no salen; la tabla del seguimiento sí, aunque esté vacía, para rellenarla en papel. */
const conContenido = (p: ParteAcs) =>
  p.tipo === 'filas' ? p.filas.length > 0 : p.tipo === 'lista' ? p.items.length > 0 : p.tipo === 'texto' ? p.texto.trim() !== '' : p.filas.length > 0;

export function htmlAcs(c: ContenidoAcs, lang: Lang, firmas: string[]): string {
  const t: T = (k, vars) => translate(lang, k, vars);
  const filas = (fs: [string, string][], clase = 'head') =>
    `<table class="${clase}"><tbody>${fs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${nl2br(v)}</td></tr>`).join('')}</tbody></table>`;
  const parte = (p: ParteAcs) => {
    if (p.tipo === 'filas') return filas(p.filas);
    if (p.tipo === 'lista') return `<h3>${esc(p.titulo)}</h3><ul>${p.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (p.tipo === 'texto') return `<h3>${esc(p.titulo)}</h3><p>${nl2br(p.texto)}</p>`;
    return (p.titulo ? `<h3>${esc(p.titulo)}</h3>` : '') +
      `<table class="acs"><colgroup>${p.anchos.map(a => `<col style="width:${a}%">`).join('')}</colgroup>` +
      `<thead><tr>${p.columnas.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead>` +
      `<tbody>${p.filas.map(f => `<tr>${f.map(x => `<td>${nl2br(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  };
  const firmasHtml = `<table class="acs firmas"><thead><tr>${firmas.map(f => `<th>${esc(f)}</th>`).join('')}</tr></thead>` +
    `<tbody><tr>${firmas.map(() => '<td class="hueco"></td>').join('')}</tr></tbody></table>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title><style>${ESTILO}${ESTILO_ACS}</style></head>` +
    `<body><article class="ap-doc"><p class="kind">${esc(t('PT y AL').toUpperCase())}</p><h1>${esc(c.titulo)}</h1>` +
    (c.cabecera.length ? filas(c.cabecera) : '') +
    c.secciones.map(s => `<h2>${esc(s.titulo)}</h2>${s.partes.filter(conContenido).map(parte).join('')}`).join('') +
    `<h2>${esc(t('Firmas'))}</h2>${firmasHtml}` +
    `<p class="pie">${esc(t('Documento generado con AulaPro'))}</p></article></body></html>`;
}

const ESTILO_ACS = `
h3 { font-size: 11.5px; margin: 12px 0 4px; color: #1e3a5f; }
ul { margin: 0 0 8px; padding-left: 18px; }
li { margin-bottom: 3px; }
.acs { table-layout: fixed; }
.acs th { font-size: 10px; }
.firmas .hueco { height: 22mm; }
`;

export async function guardarAcsPdf(c: ContenidoAcs, lang: Lang, firmas: string[], nombre: string) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const res = await docs.savePdf(htmlAcs(c, lang, firmas), nombre + '.pdf', { landscape: false, carpeta: CARPETAS.apoyo });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

export async function docxAcs(c: ContenidoAcs, lang: Lang, firmas: string[]): Promise<Blob> {
  const t: T = (k, vars) => translate(lang, k, vars);
  const tabla = (filas: string[][], anchos: number[], cabecera?: string[]) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
    rows: [
      ...(cabecera ? [new TableRow({ children: cabecera.map((x, i) => celda(x, { label: true, width: anchos[i], size: 17 })) })] : []),
      ...filas.map(f => new TableRow({ children: f.map((x, i) => celda(x, { width: anchos[i], size: 18 })) })),
    ],
  });
  const filas = (fs: [string, string][]) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
    rows: fs.map(([k, v]) => new TableRow({ children: [celda(k, { label: true, width: 32 }), celda(v, { width: 68 })] })),
  });
  const titulo3 = (text: string) => new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text, bold: true, size: 20, color: '1E3A5F' })] });
  const parrafo = (text: string, bullet = false) => new Paragraph({
    spacing: { after: 80 }, ...(bullet ? { bullet: { level: 0 } } : {}), children: [new TextRun({ text, size: 21 })],
  });
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: t('PT y AL').toUpperCase(), bold: true, size: 18, color: '1F4E79' })] }),
    new Paragraph({ text: c.titulo, heading: HeadingLevel.TITLE, spacing: { after: 200 } }),
  ];
  if (c.cabecera.length) children.push(filas(c.cabecera));
  for (const s of c.secciones) {
    children.push(titulo2(s.titulo));
    for (const p of s.partes.filter(conContenido)) {
      if (p.tipo === 'filas') children.push(filas(p.filas));
      else if (p.tipo === 'lista') { children.push(titulo3(p.titulo)); p.items.forEach(i => children.push(parrafo(i, true))); }
      else if (p.tipo === 'texto') { children.push(titulo3(p.titulo)); p.texto.split('\n').forEach(l => children.push(parrafo(l))); }
      else { if (p.titulo) children.push(titulo3(p.titulo)); children.push(tabla(p.filas, p.anchos, p.columnas)); }
    }
  }
  children.push(titulo2(t('Firmas')));
  const ancho = Math.floor(100 / firmas.length);
  children.push(tabla([firmas.map(() => '\n\n\n')], firmas.map(() => ancho), firmas));
  children.push(new Paragraph({
    spacing: { before: 400 }, alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: t('Documento generado con AulaPro'), size: 16, color: '94A3B8', italics: true })],
  }));
  const d = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } } }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });
  return Packer.toBlob(d);
}

export async function guardarAcsDocx(c: ContenidoAcs, lang: Lang, firmas: string[], nombre: string) {
  await downloadFile(await docxAcs(c, lang, firmas), nombre + '.docx', CARPETAS.apoyo);
}

/** El nombre del archivo: el título y la fecha, sin caracteres raros. */
export function nombreArchivoAcs(c: ContenidoAcs, alumno: AlumnoApoyo, fechaIso: string): string {
  const slug = (x: string) => x.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '');
  return [c.titulo, alumno.nombre].map(slug).join('-').toLowerCase() + (fechaIso ? `-${fechaIso}` : '');
}

/** Quién firma: el tutor, el especialista y el profesorado de la materia, como los nombre el documento. */
export function firmasAcs(lang: Lang): string[] {
  const t: T = (k, vars) => translate(lang, k, vars);
  return [t('Tutor o tutora'), t('Especialista de PT o AL'), t('Profesorado de la materia')];
}
