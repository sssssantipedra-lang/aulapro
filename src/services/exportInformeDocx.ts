/**
 * Los informes en Word, con las mismas partes que el PDF (`lib/informeDocumento.ts`). Va en su archivo
 * porque la librería `docx` pesa: la pantalla de Informes lo pide al pulsar «Word», no al abrirse.
 */
import {
  AlignmentType, BorderStyle, Document, HeadingLevel, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import type { CompetencyReport } from '../types';
import { partesDeInforme, type ContextoDeInforme, type PartesDeInforme } from '../lib/informeDocumento';
import { downloadFile } from '../lib/download';
import { CARPETAS } from '../lib/carpetas';

const BORDE = { style: BorderStyle.SINGLE, size: 2, color: 'BFC5CE' };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE, insideHorizontal: BORDE, insideVertical: BORDE };

function celda(text: string, o: { fondo?: boolean; bold?: boolean; width?: number; right?: boolean; color?: string; size?: number } = {}) {
  return new TableCell({
    width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
    shading: o.fondo ? { fill: 'F3F4F6' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (text || ' ').split('\n').map(l => new Paragraph({
      alignment: o.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: l, bold: !!o.bold, size: o.size ?? 20, color: o.color })],
    })),
  });
}

const titulo2 = (text: string) => new Paragraph({
  spacing: { before: 280, after: 100 }, keepNext: true,
  children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: '374151' })],
});

const parrafos = (texto: string) => texto.split('\n').filter(l => l.trim()).map(l => new Paragraph({
  spacing: { after: 120, line: 320 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: l, size: 22 })],
}));

/** Lo que ocupa un informe en el documento; `ultimo` evita la página en blanco del final. */
function bloque(p: PartesDeInforme, t: ContextoDeInforme['t'], ultimo: boolean): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    new Paragraph({ text: p.alumno, heading: HeadingLevel.TITLE, spacing: { after: 40 } }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: p.titulo, size: 20, color: '6B7280' })] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: [
        new TableRow({ children: p.datos.map(([k]) => celda(k, { fondo: true, bold: true, size: 17 })) }),
        new TableRow({ children: p.datos.map(([, v]) => celda(v, { bold: true })) }),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
  if (p.parrafo) out.push(...parrafos(p.parrafo));
  if (p.notas.length) {
    out.push(titulo2(t('Calificaciones')));
    for (const n of p.notas) {
      out.push(new Paragraph({ spacing: { before: 80, after: 60 }, keepNext: true, children: [new TextRun({ text: n.asignatura, bold: true, size: 22 })] }));
      out.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
        rows: [
          ...n.filas.map(([a, b, c]) => new TableRow({ children: [celda(a, { width: 64 }), celda(b, { width: 18, right: true, color: '6B7280' }), celda(c, { width: 18, right: true })] })),
          new TableRow({ children: [celda(n.total[0], { width: 64, fondo: true, bold: true }), celda('', { width: 18, fondo: true }), celda(n.total[1], { width: 18, right: true, fondo: true, bold: true })] }),
        ],
      }));
    }
  }
  if (p.asistencia.length) {
    out.push(titulo2(t('Asistencia')));
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: [
        new TableRow({ children: p.asistencia.map(([k]) => celda(k, { fondo: true, bold: true, size: 17, width: 25 })) }),
        new TableRow({ children: p.asistencia.map(([, v]) => celda(v, { bold: true, width: 25 })) }),
      ],
    }));
  }
  if (p.competencias.length) {
    const conComentario = p.competencias.some(f => f.comentario);
    out.push(titulo2(t('Competencias clave')));
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: BORDES,
      rows: [
        new TableRow({ children: [
          celda(t('Competencia clave'), { fondo: true, bold: true, size: 17, width: conComentario ? 30 : 70 }),
          celda(t('Valoración'), { fondo: true, bold: true, size: 17, width: conComentario ? 18 : 30 }),
          ...(conComentario ? [celda(t('Comentario'), { fondo: true, bold: true, size: 17, width: 52 })] : []),
        ] }),
        ...p.competencias.map(f => new TableRow({ children: [
          celda(`${f.clave}\n${f.nombre}`, { width: conComentario ? 30 : 70, size: 18 }),
          celda(f.valoracion, { width: conComentario ? 18 : 30, bold: true, color: f.color.replace('#', '') }),
          ...(conComentario ? [celda(f.comentario, { width: 52, size: 19 })] : []),
        ] })),
      ],
    }));
  }
  const lista = (titulo: string, frases: string[]) => {
    if (!frases.length) return;
    out.push(titulo2(t(titulo)));
    frases.forEach(f => out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: f, size: 22 })] })));
  };
  lista('Lo positivo', p.positivos);
  lista('A mejorar', p.mejorar);
  if (p.observacion) out.push(titulo2(t('Observaciones del docente')), ...parrafos(p.observacion));
  out.push(new Paragraph({
    spacing: { before: 400 },
    children: [new TextRun({ text: p.pie, size: 16, color: '6B7280', italics: true }), ...(ultimo ? [] : [new PageBreak()])],
  }));
  return out;
}

/** Construye el .docx con uno o varios informes, cada alumno en su página. Separado del guardado para poder probarlo. */
export async function informesDocxBlob(lista: CompetencyReport[], c: ContextoDeInforme): Promise<Blob> {
  const children = lista.flatMap((r, i) => bloque(partesDeInforme(r, c), c.t, i === lista.length - 1));
  const d = new Document({
    sections: [{ children, properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } } }],
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
  });
  return Packer.toBlob(d);
}

export async function guardarInformesDocx(lista: CompetencyReport[], nombre: string, c: ContextoDeInforme): Promise<void> {
  await downloadFile(await informesDocxBlob(lista, c), nombre + '.docx', CARPETAS.informes);
}
