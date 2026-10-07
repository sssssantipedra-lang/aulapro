/**
 * Documentos del módulo de PT y AL: la programación de cada alumno, los
 * informes trimestrales a la familia y al tutor o al equipo, y el
 * seguimiento del apartado I del PAP (Comunitat Valenciana). Ver
 * `docs/PTAL.md`, «Documentos».
 *
 * Los datos (objetivos, criterios, recuentos del registro, asistencia) los
 * pone la app tal cual. La IA solo redacta a partir de ellos, con la
 * normativa de la comunidad y los autores de referencia como marco
 * (`marcoApoyo`), y no puede inventar logros.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType,
} from 'docx';
import { callGemini, parseGeminiJson } from './gemini';
import { marcoApoyo, alumnoParaIA } from './apoyoIA';
import { CON_QUIEN, coordinacionesDe, datosDelTrimestre, nivelDe, nuevoIdApoyo, type DatosTrimestre } from '../lib/apoyo';
import { describirCriterio, type MateriaDeClase } from '../lib/curriculum/criteriosParaIA';
import { translate, priorityLabel, weekdayLabel, LOCALES, type Lang } from '../i18n';
import { downloadFile } from '../lib/download';
import type { ComunidadId } from '../lib/curriculum/comunidades';
import type {
  AlumnoApoyo, ApartadoDocumento, ApoyoData, CoordinacionApoyo, AspectoRespuesta, CursoDe, DocumentoApoyo, TipoDocumentoApoyo, Trimestre,
} from '../types/apoyo';

type T = (k: string, vars?: Record<string, string | number>) => string;

/* ── Modelos ── */

interface ApartadoModelo {
  id: string;
  /** Título en castellano; se traduce al mostrarlo, salvo en el PAP, que es literal. */
  titulo: string;
  /** Lo redacta la IA, con esta instrucción. Sin ella, lo pone la app. */
  ia?: string;
}

export const MODELOS: Record<Exclude<TipoDocumentoApoyo, 'pap'>, ApartadoModelo[]> = {
  programacion: [
    { id: 'justificacion', titulo: 'Justificación y marco normativo',
      ia: 'Por qué este alumno recibe este apoyo, con la normativa de inclusión de su comunidad y, cuando aporte, los autores de referencia. Dos párrafos.' },
    { id: 'partida', titulo: 'Necesidades educativas y punto de partida',
      ia: 'Sus barreras, sus fortalezas y su nivel de competencia curricular, a partir de su ficha. Un párrafo.' },
    { id: 'objetivos', titulo: 'Objetivos por ámbito y trimestre' },
    { id: 'metodologia', titulo: 'Metodología',
      ia: 'Cómo se trabaja con él: principios del DUA, agrupamiento, apoyos visuales, refuerzo, etc., ajustados a sus necesidades y a los ámbitos. Un párrafo o una lista breve.' },
    { id: 'recursos', titulo: 'Recursos y materiales', ia: 'Materiales y recursos concretos para sus ámbitos. Una lista breve.' },
    { id: 'coordinacion', titulo: 'Coordinación con el tutor, el equipo y la familia',
      ia: 'Con quién y cómo se coordina el especialista, y qué se espera de cada parte. Un párrafo.' },
    { id: 'evaluacion', titulo: 'Evaluación',
      ia: 'Cómo se evalúan sus objetivos: el registro diario de cada sesión (conseguido, en proceso, no conseguido, y cómo responde), los criterios oficiales enlazados y los informes trimestrales. Un párrafo.' },
  ],
  familia: [
    { id: 'trabajado', titulo: 'Lo trabajado y cómo avanza',
      ia: 'Para la familia, en lenguaje cercano y sin tecnicismos: qué se ha trabajado este trimestre y cómo avanza en cada cosa, según los datos del registro. Destaca lo que ha conseguido.' },
    { id: 'respuesta', titulo: 'Cómo ha respondido',
      ia: 'Para la familia: su atención, motivación, conducta y autonomía en las sesiones, según los datos. Un párrafo breve y positivo, sin ocultar lo que cuesta.' },
    { id: 'casa', titulo: 'Orientaciones para casa',
      ia: 'De 3 a 5 ideas sencillas y concretas para que la familia apoye en casa lo que se trabaja. Una lista.' },
    { id: 'proximo', titulo: 'Objetivos del próximo trimestre',
      ia: 'Para la familia: lo que se trabajará el próximo trimestre, a partir de la lista dada (en el 3º trimestre, lo que convendría seguir trabajando el curso siguiente). Una lista breve.' },
  ],
  equipo: [
    { id: 'asistencia', titulo: 'Asistencia a las sesiones' },
    { id: 'evolucion', titulo: 'Evolución por programa y objetivo',
      ia: 'Para el tutor o el equipo, con lenguaje técnico: cómo ha evolucionado cada objetivo del trimestre según los recuentos del registro, por programa.' },
    { id: 'respuesta', titulo: 'Respuesta en las sesiones',
      ia: 'Para el tutor o el equipo: atención, motivación, conducta y autonomía según los datos, y lo que se ha observado en las notas.' },
    { id: 'propuestas', titulo: 'Propuestas para el aula de referencia y coordinación',
      ia: 'Qué puede hacer el tutor o la tutora en su aula para dar continuidad al trabajo (medidas del DUA, adaptaciones de acceso, coordinación), y qué se propone para el próximo trimestre. Una lista.' },
  ],
};

/** El apartado I del PAP (Documento 7 de la Conselleria), con sus textos literales. */
export const PAP: Record<'es' | 'va', {
  seccion: string; columnas: string[]; progreso: string; nuevas: string;
  nombre: string; como: string; firma: string; profesorado: string;
}> = {
  es: {
    seccion: 'SEGUIMIENTO Y EVALUACIÓN',
    columnas: ['Medidas de respuesta', '1º Trimestre', '2º Trimestre', '3º Trimestre',
      'Propuesta para el curso siguiente (finaliza o continúa el curso siguiente)'],
    progreso: 'Progreso global del alumnado',
    nuevas: 'Propuesta de nuevas medidas y/o actuaciones para el curso siguiente (incluir solo las que sean diferents de las medidas ya iniciadas)',
    nombre: 'NOMBRE Y APELLIDOS', como: 'COMO', firma: 'FIRMA',
    profesorado: 'Profesorado especializado de apoyo',
  },
  va: {
    seccion: 'SEGUIMENT I AVALUACIÓ',
    columnas: ['Mesures de resposta', '1r Trimestre', '2n Trimestre', '3r trimestre',
      'Proposta per al curs següent (finaliza o continua el curs següent)'],
    progreso: 'Progrés global de l’alumnat',
    nuevas: 'Proposta de noves mesures i/o actuacions per al curs següent (incloure sols les que siguen diferents de les mesures ja iniciades)',
    nombre: 'NOM I COGNOMS', como: 'COM A', firma: 'SIGNATURA',
    profesorado: 'Professorat especialitzat de suport',
  },
};

export const papDe = (lang: Lang) => PAP[lang === 'ca' ? 'va' : 'es'];

/** Qué documentos se pueden hacer en una comunidad: el PAP, solo en la valenciana. */
export function tiposDe(comunidad: ComunidadId | undefined): TipoDocumentoApoyo[] {
  return comunidad === 'comunitat-valenciana'
    ? ['programacion', 'familia', 'equipo', 'pap']
    : ['programacion', 'familia', 'equipo'];
}

export const NOMBRE_TIPO: Record<TipoDocumentoApoyo, string> = {
  programacion: 'Programación',
  familia: 'Informe trimestral a la familia',
  equipo: 'Informe trimestral al tutor o al equipo',
  pap: 'Seguimiento del PAP (apartado I)',
};

/* ── Datos que pone la app ── */

const ASPECTO: Record<AspectoRespuesta, string> = {
  atencion: 'atención', motivacion: 'motivación', conducta: 'conducta', autonomia: 'autonomía',
};

/** Los objetivos de sus programas por ámbito y trimestre, con sus criterios oficiales. */
export function objetivosTexto(d: ApoyoData, alumnoId: string, materias: MateriaDeClase[], t: T, lang: Lang = 'es'): string {
  return d.programas.filter(p => p.alumnoId === alumnoId).map(p => {
    const nivel = p.intensidad && priorityLabel(p.intensidad === 'baja' ? 'low' : p.intensidad === 'media' ? 'medium' : 'high', lang).toLowerCase();
    const cab = nivel ? `${p.ambito} (${t('intensidad {i}', { i: nivel })})` : p.ambito;
    const porTrimestre = ([1, 2, 3] as const).map(n => {
      const objs = p.objetivos.filter(o => o.trimestres.includes(n));
      if (!objs.length) return '';
      return `${t('{n}º trimestre', { n })}:\n` + objs.map(o => {
        const crit = o.criterios.map(r => {
          const c = describirCriterio(materias, r);
          return c ? `${c.materia} ${r.codigo}` : r.codigo;
        });
        return `- ${o.texto}${crit.length ? ` (${crit.join('; ')})` : ''}`;
      }).join('\n');
    }).filter(Boolean).join('\n');
    return `${cab}\n${porTrimestre || t('Sin objetivos todavía.')}`;
  }).join('\n\n') || t('Todavía no tiene programas.');
}

/** Lo que dice el registro de un trimestre, como texto para la IA. */
export function datosParaIA(datos: DatosTrimestre, trimestre: Trimestre): string {
  const lineas = [
    `Trimestre: ${trimestre}º. Sesiones registradas: ${datos.sesiones}; ausencias: ${datos.ausencias}.`,
    'Objetivos del trimestre y cómo han ido en el registro:',
    ...datos.objetivos.map(({ programa, objetivo, resumen: r }) => {
      const total = r.si + r.proceso + r.no;
      return `- [${programa.ambito}] ${objetivo.texto}: ` + (total
        ? `conseguido ${r.si}, en proceso ${r.proceso}, no conseguido ${r.no}; último registro: ${r.ultimo === 'si' ? 'conseguido' : r.ultimo === 'proceso' ? 'en proceso' : 'no conseguido'}.`
        : 'sin registros este trimestre.');
    }),
    'Cómo ha respondido (media de 1 a 3, donde 3 es bien):',
    ...(Object.keys(datos.respuesta) as AspectoRespuesta[]).map(a => {
      const x = datos.respuesta[a];
      return `- ${ASPECTO[a]}: ${x.media === null ? 'sin datos' : `${String(x.media).replace('.', ',')} en ${x.veces} sesiones`}`;
    }),
  ];
  if (datos.notas.length) lineas.push('Notas del especialista:', ...datos.notas.slice(-15).map(n => `- ${n.fecha}: ${n.texto}`));
  if (datos.temas.length) lineas.push('Lo que trabajaba su clase:', ...datos.temas.slice(-10).map(n => `- ${n.fecha}: ${n.texto}`));
  if (datos.coordinaciones.length) lineas.push('Coordinaciones de este trimestre:', ...coordinacionesTexto(datos.coordinaciones));
  return lineas.join('\n');
}

/**
 * Cada coordinación en una línea para la IA: cuándo, con quién, de qué se
 * habló y qué se acordó. Quiénes estuvieron no se envía: pueden ser nombres de
 * personas adultas que la IA no necesita.
 */
export function coordinacionesTexto(cs: readonly CoordinacionApoyo[]): string[] {
  return cs.map(c => `- ${c.fecha}, con ${CON_QUIEN[c.con].toLowerCase()}: `
    + `${c.temas.trim() || 'sin tema anotado'}.${c.acuerdos.trim() ? ` Acuerdos: ${c.acuerdos.trim()}` : ''}`);
}

/** Las filas de la ficha de cabecera, comunes a la pantalla, al PDF y al Word. */
export function cabecera(
  doc: DocumentoApoyo, alumno: AlumnoApoyo, d: ApoyoData,
  docente: { nombre: string; centro: string; curso: string }, nombreCurso: (c: CursoDe) => string, t: T, lang: Lang,
): [string, string][] {
  const nivel = nivelDe(alumno);
  const grupos = d.grupos.filter(g => g.alumnos.includes(alumno.id));
  const horario = grupos.flatMap(g => g.horario.map(f => `${g.nombre}: ${weekdayLabel(f.dia, LOCALES[lang], 'short')} ${f.inicio}–${f.fin}`)).join('; ');
  const filas: [string, string | undefined][] = [
    [t('Alumno o alumna'), alumno.nombre],
    [t('Clase de origen'), alumno.claseOrigen],
    [t('Curso'), alumno.matricula ? nombreCurso(alumno.matricula) : undefined],
    [t('Curso escolar'), docente.curso],
    ...(doc.tipo !== 'familia' ? [
      [t('Nivel de competencia curricular'), nivel ? nombreCurso(nivel) : undefined] as [string, string | undefined],
      [t('Necesidades específicas de apoyo educativo'), alumno.categorias.map(c => t(c)).join(', ')] as [string, string | undefined],
    ] : []),
    ...(doc.tipo === 'programacion' ? [[t('Horario de apoyo'), horario] as [string, string | undefined]] : []),
    ...(doc.trimestre && doc.tipo !== 'pap' && doc.tipo !== 'programacion' ? [[t('Trimestre'), t('{n}º trimestre', { n: doc.trimestre })] as [string, string]] : []),
    [t('Especialista'), docente.nombre],
    [t('Centro'), docente.centro],
  ];
  return filas.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== '');
}

export function tituloDe(tipo: TipoDocumentoApoyo, alumno: AlumnoApoyo, trimestre: Trimestre | undefined, t: T): string {
  if (tipo === 'programacion') return t('Programación de {name}', { name: alumno.nombre });
  if (tipo === 'pap') return t('Seguimiento del PAP de {name}', { name: alumno.nombre });
  return `${t(NOMBRE_TIPO[tipo])} · ${t('{n}º trimestre', { n: trimestre ?? 1 })}`;
}

/* ── Generar con la IA ── */

export interface GenerarArgs {
  tipo: TipoDocumentoApoyo;
  alumno: AlumnoApoyo;
  trimestre: Trimestre;
  data: ApoyoData;
  /** Criterios del curso de su nivel, para nombrarlos. */
  materias: MateriaDeClase[];
  comunidad: ComunidadId | undefined;
  lang: Lang;
  nombreCurso: (c: CursoDe) => string;
  /** El documento que ya había (el PAP se va rellenando trimestre a trimestre). */
  anterior?: DocumentoApoyo;
  hoy: string;
}

type Callbacks = { onStart?: () => void; onEnd?: () => void; onError?: (m: string) => void };

export async function generarDocumento(args: GenerarArgs, callbacks: Callbacks = {}): Promise<DocumentoApoyo | null> {
  const { tipo, alumno, trimestre, data, materias, comunidad, lang, nombreCurso, anterior, hoy } = args;
  const t: T = (k, vars) => translate(lang, k, vars);
  const programas = data.programas.filter(p => p.alumnoId === alumno.id);
  const datos = datosDelTrimestre(data, alumno.id, trimestre);
  const base = {
    id: anterior?.id ?? nuevoIdApoyo('doc'), alumnoId: alumno.id, tipo, fecha: hoy,
    titulo: tituloDe(tipo, alumno, trimestre, t),
    ...(tipo === 'programacion' ? {} : { trimestre }),
  };

  const contexto =
    `${alumnoParaIA(alumno, nombreCurso)}\n\n` +
    `Programas y objetivos (por trimestre):\n${objetivosTexto(data, alumno.id, materias, t, lang)}\n\n` +
    (tipo === 'programacion' ? '' : `${datosParaIA(datos, trimestre)}\n`) +
    // La programación es del curso: todas las coordinaciones hasta hoy
    (tipo === 'programacion' && coordinacionesDe(data, alumno.id).length
      ? `Coordinaciones hasta ahora:\n${coordinacionesTexto(coordinacionesDe(data, alumno.id)).join('\n')}\n` : '') +
    (tipo === 'familia' ? `\nObjetivos del próximo trimestre:\n${proximos(data, alumno.id, trimestre).join('\n') || '(ninguno todavía)'}\n` : '');
  const reglas = '\nRedacta SOLO a partir de estos datos. Si un objetivo no tiene registros, dilo así; no inventes logros, ' +
    'pruebas, fechas ni datos del alumno. Usa el nombre del alumno tal como aparece. Sin títulos ni negritas dentro de los textos.';

  if (tipo === 'pap') {
    const pap = papDe(lang);
    const userPrompt = contexto +
      `\nRellena el apartado I del PAP («${pap.seccion}») para el ${trimestre}º trimestre: para cada medida de respuesta ` +
      '(cada programa), en "seguimiento" de 1 a 3 frases sobre cómo ha ido este trimestre según el registro' +
      (trimestre === 3 ? ', y en "propuesta" si finaliza o continúa el curso siguiente y por qué, en una frase' : '') +
      '. En "progreso" un párrafo con el progreso global del alumno' +
      (trimestre === 3 ? ', y en "nuevas" las nuevas medidas o actuaciones que propones para el curso siguiente (solo las distintas de las ya iniciadas)' : '') + '.' +
      reglas;
    const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
      responseSchema: {
        type: 'OBJECT',
        properties: {
          medidas: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
            id: { type: 'STRING', enum: programas.map(p => p.id) },
            seguimiento: { type: 'STRING' },
            ...(trimestre === 3 ? { propuesta: { type: 'STRING' } } : {}),
          }, required: ['id', 'seguimiento'] } },
          progreso: { type: 'STRING' },
          ...(trimestre === 3 ? { nuevas: { type: 'STRING' } } : {}),
        },
        required: ['medidas', 'progreso'],
      },
      thinkingLevel: 'high',
      maxOutputTokens: 8192,
    });
    if (!raw) return null;
    const r = parseGeminiJson<{ medidas?: { id?: string; seguimiento?: string; propuesta?: string }[]; progreso?: string; nuevas?: string }>(raw);
    if (!r?.medidas) { callbacks.onError?.('La IA no devolvió el documento. Inténtalo de nuevo.'); return null; }
    const previa = new Map((anterior?.tabla ?? []).map(f => [f[0], f]));
    const tabla = programas.map(p => {
      const fila = [...(previa.get(p.ambito) ?? [p.ambito, '', '', '', ''])];
      const m = r.medidas!.find(x => x.id === p.id);
      if (m?.seguimiento) fila[trimestre] = m.seguimiento.trim();
      if (trimestre === 3 && m?.propuesta) fila[4] = m.propuesta.trim();
      return fila;
    });
    const viejo = (id: string) => anterior?.apartados.find(a => a.id === id)?.texto ?? '';
    return {
      ...base, trimestre, tabla,
      apartados: [
        { id: 'progreso', titulo: pap.progreso, texto: r.progreso?.trim() || viejo('progreso') },
        { id: 'nuevas', titulo: pap.nuevas, texto: (trimestre === 3 ? r.nuevas?.trim() : '') || viejo('nuevas') },
      ],
    };
  }

  const modelo = MODELOS[tipo];
  const conIA = modelo.filter(a => a.ia);
  const userPrompt = contexto +
    `\nRedacta los apartados de «${t(NOMBRE_TIPO[tipo])}»` + (tipo === 'programacion' ? ' del curso' : ` del ${trimestre}º trimestre`) + ':\n' +
    conIA.map(a => `- ${a.id} («${a.titulo}»): ${a.ia}`).join('\n') + reglas;
  const raw = await callGemini(marcoApoyo(comunidad, lang) + '\nResponde SOLO con JSON válido.', userPrompt, [], callbacks, {
    responseSchema: {
      type: 'OBJECT',
      properties: {
        apartados: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          id: { type: 'STRING', enum: conIA.map(a => a.id) },
          texto: { type: 'STRING' },
        }, required: ['id', 'texto'] } },
      },
      required: ['apartados'],
    },
    thinkingLevel: 'high',
    maxOutputTokens: 8192,
  });
  if (!raw) return null;
  const r = parseGeminiJson<{ apartados?: { id?: string; texto?: string }[] }>(raw);
  if (!r?.apartados) { callbacks.onError?.('La IA no devolvió el documento. Inténtalo de nuevo.'); return null; }
  const apartados: ApartadoDocumento[] = modelo.map(a => ({
    id: a.id, titulo: t(a.titulo),
    texto: a.id === 'objetivos'
      ? objetivosTexto(data, alumno.id, materias, t, lang)
      : a.id === 'asistencia'
        ? t('Ha asistido a {n} de {total} sesiones registradas este trimestre.', { n: datos.sesiones - datos.ausencias, total: datos.sesiones })
        : (r.apartados!.find(x => x.id === a.id)?.texto ?? '').trim(),
  }));
  return { ...base, apartados };
}

/** Los objetivos del trimestre siguiente; en el 3º, los que siguen abiertos. */
function proximos(d: ApoyoData, alumnoId: string, trimestre: Trimestre): string[] {
  const programas = d.programas.filter(p => p.alumnoId === alumnoId);
  if (trimestre < 3) {
    const sig = (trimestre + 1) as Trimestre;
    return programas.flatMap(p => p.objetivos.filter(o => o.trimestres.includes(sig)).map(o => `- [${p.ambito}] ${o.texto}`));
  }
  const datos = datosDelTrimestre(d, alumnoId, 3);
  return datos.objetivos.filter(o => o.resumen.ultimo !== 'si').map(o => `- [${o.programa.ambito}] ${o.objetivo.texto} (sin conseguir del todo)`);
}

/* ── Exportar ── */

const esc = (x: string) => (x ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
const nl2br = (x: string) => esc(x).replace(/\n/g, '<br>');

function nombreArchivo(doc: DocumentoApoyo): string {
  const slug = (x: string) => x.trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '');
  return slug(doc.titulo || 'documento').toLowerCase() + (doc.fecha ? `-${doc.fecha}` : '');
}

export function buildDocumentoHtml(doc: DocumentoApoyo, filas: [string, string][], lang: Lang, firma?: { nombre: string; como: string }): string {
  const t: T = (k, vars) => translate(lang, k, vars);
  const pap = papDe(lang);
  const ficha = filas.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${nl2br(v)}</td></tr>`).join('');
  const tabla = doc.tipo === 'pap' && doc.tabla
    ? `<h2>I. ${esc(pap.seccion)}</h2><table class="pap"><thead><tr>${pap.columnas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
      doc.tabla.map(f => `<tr>${f.map(c => `<td>${nl2br(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>'
    : '';
  const apartados = doc.apartados.filter(a => a.texto.trim())
    .map(a => `<h2>${esc(a.titulo)}</h2><p>${nl2br(a.texto)}</p>`).join('');
  const firmaHtml = firma
    ? `<table class="firma"><tbody><tr><th>${esc(pap.nombre)}</th><td>${esc(firma.nombre)}</td></tr>` +
      `<tr><th>${esc(pap.como)}</th><td>${esc(firma.como)}</td></tr><tr><th>${esc(pap.firma)}</th><td class="hueco"></td></tr></tbody></table>`
    : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(doc.titulo)}</title><style>${ESTILO}</style></head>` +
    `<body><article class="ap-doc"><p class="kind">${esc(t('PT y AL').toUpperCase())}</p><h1>${esc(doc.titulo)}</h1>` +
    (ficha ? `<table class="head"><tbody>${ficha}</tbody></table>` : '') +
    tabla + apartados + firmaHtml +
    `<p class="pie">${esc(t('Documento generado con Aula Pro'))}</p></article></body></html>`;
}

const ESTILO = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.ap-doc { max-width: 175mm; margin: 0 auto; padding: 4mm 2mm; color: #1e293b; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 12px; line-height: 1.6; }
.kind { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #1f4e79; margin: 0 0 4px; }
h1 { font-size: 19px; margin: 0 0 14px; }
h2 { font-size: 13px; color: #1f4e79; margin: 18px 0 6px; border-bottom: 1.5px solid #bdd7ee; padding-bottom: 3px; }
p { margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 8px; }
th, td { border: 0.75px solid #8faadc; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #dce6f1; color: #1e3a5f; }
.head th, .firma th { width: 42mm; }
.pap th { font-size: 10px; }
.firma { margin-top: 18px; }
.firma .hueco { height: 22mm; }
.pie { margin-top: 18px; text-align: right; font-size: 9px; color: #94a3b8; font-style: italic; }
h2, tr { break-inside: avoid; page-break-inside: avoid; }
@media print { @page { size: A4 portrait; margin: 15mm 16mm; } }
`;

export async function guardarDocumentoPdf(doc: DocumentoApoyo, filas: [string, string][], lang: Lang, firma?: { nombre: string; como: string }) {
  const docs = window.electronAPI?.docs;
  if (!docs) return { error: 'not-desktop' as const };
  const res = await docs.savePdf(buildDocumentoHtml(doc, filas, lang, firma), nombreArchivo(doc) + '.pdf', { landscape: false });
  if (!res.canceled && !res.error && res.path) docs.reveal(res.path);
  return res;
}

const BORDE = { style: BorderStyle.SINGLE, size: 2, color: '8FAADC' };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE, insideHorizontal: BORDE, insideVertical: BORDE };

function celda(text: string, opts: { label?: boolean; width?: number; size?: number } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.label ? { fill: 'DCE6F1' } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: (text || ' ').split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, bold: !!opts.label, size: opts.size ?? 20 })] })),
  });
}

const titulo2 = (text: string) => new Paragraph({
  spacing: { before: 260, after: 100 },
  children: [new TextRun({ text, bold: true, size: 22, color: '1F4E79' })],
});

export async function buildDocumentoDocxBlob(doc: DocumentoApoyo, filas: [string, string][], lang: Lang, firma?: { nombre: string; como: string }): Promise<Blob> {
  const t: T = (k, vars) => translate(lang, k, vars);
  const pap = papDe(lang);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: t('PT y AL').toUpperCase(), bold: true, size: 18, color: '1F4E79' })] }),
    new Paragraph({ text: doc.titulo, heading: HeadingLevel.TITLE, spacing: { after: 200 } }),
  ];
  if (filas.length) {
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: filas.map(([k, v]) => new TableRow({ children: [celda(k, { label: true, width: 32 }), celda(v, { width: 68 })] })),
    }));
  }
  if (doc.tipo === 'pap' && doc.tabla) {
    children.push(titulo2(`I. ${pap.seccion}`));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: [
        new TableRow({ children: pap.columnas.map(c => celda(c, { label: true, size: 17 })) }),
        ...doc.tabla.map(f => new TableRow({ children: f.map(c => celda(c, { size: 18 })) })),
      ],
    }));
  }
  doc.apartados.filter(a => a.texto.trim()).forEach(a => {
    children.push(titulo2(a.titulo));
    a.texto.split('\n').forEach(l => children.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: l, size: 22 })] })));
  });
  if (firma) {
    children.push(new Paragraph({ spacing: { before: 300 }, children: [] }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: [
        new TableRow({ children: [celda(pap.nombre, { label: true, width: 32 }), celda(firma.nombre, { width: 68 })] }),
        new TableRow({ children: [celda(pap.como, { label: true, width: 32 }), celda(firma.como, { width: 68 })] }),
        new TableRow({ children: [celda(pap.firma, { label: true, width: 32 }), celda('\n\n\n', { width: 68 })] }),
      ],
    }));
  }
  children.push(new Paragraph({
    spacing: { before: 400 }, alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: t('Documento generado con Aula Pro'), size: 16, color: '94A3B8', italics: true })],
  }));
  const d = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } } }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });
  return Packer.toBlob(d);
}

export async function guardarDocumentoDocx(doc: DocumentoApoyo, filas: [string, string][], lang: Lang, firma?: { nombre: string; como: string }) {
  await downloadFile(await buildDocumentoDocxBlob(doc, filas, lang, firma), nombreArchivo(doc) + '.docx');
}
