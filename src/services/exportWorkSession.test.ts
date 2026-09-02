import { describe, it, expect } from 'vitest';
import { buildWorkSessionHtml, buildWorkSessionDocxBlob } from './exportWorkSession';
import type { WorkSession } from '../types';

function acta(): WorkSession {
  return {
    id: 'ws1', kind: 'meeting', at: new Date().toISOString(), date: '2026-09-02',
    timeStart: '16:00', timeEnd: '17:30',
    title: 'Claustro de septiembre',
    organizer: 'Jefatura de estudios',
    place: 'Sala de profesores',
    attendees: 'Todo el claustro',
    notes: 'Notas en bruto que no deben salir cuando ya hay acta.',
    document: {
      at: new Date().toISOString(),
      titulo: 'Acta del Claustro de septiembre',
      resumen: 'Reunión de inicio de curso.',
      apartados: [{ titulo: 'Fechas de evaluación', contenido: 'La primera evaluación será el 12 de diciembre.' }],
      acuerdos: ['Reunión de departamento cada martes a las 14:00.'],
      tareas: [{ tarea: 'Revisar el plan lector', responsable: 'Marta', plazo: 'Antes del 20/9' }],
      aplicacionAula: [],
      cierre: 'Quedan pendientes las guardias del recreo.',
    },
  };
}

function memoria(): WorkSession {
  return {
    id: 'ws2', kind: 'training', at: new Date().toISOString(), date: '2026-09-01',
    title: 'Evaluación competencial',
    organizer: 'CEFIRE',
    hours: 20,
    notes: 'Ideas del ponente.',
    document: {
      at: new Date().toISOString(),
      titulo: 'Memoria de la formación',
      resumen: 'Curso sobre evaluación competencial.',
      apartados: [{ titulo: 'Rúbricas', contenido: 'Cómo redactar descriptores observables.' }],
      acuerdos: ['Los descriptores deben ser observables.'],
      tareas: [],
      aplicacionAula: ['Rehacer la rúbrica de exposiciones orales.'],
      cierre: 'Formación muy aplicable.',
    },
  };
}

describe('exportWorkSession — acta de reunión', () => {
  it('el HTML lleva la ficha de cabecera, los apartados y la tabla de tareas', () => {
    const html = buildWorkSessionHtml(acta(), 'es');
    expect(html).toContain('ACTA DE REUNIÓN');
    expect(html).toContain('Acta del Claustro de septiembre');
    expect(html).toContain('2/9/2026');            // fecha en formato local, sin restar un día
    expect(html).toContain('16:00 – 17:30');
    expect(html).toContain('Jefatura de estudios');
    expect(html).toContain('Fechas de evaluación');
    expect(html).toContain('Revisar el plan lector');
    expect(html).toContain('Marta');
  });

  it('con documento generado no se imprimen las anotaciones en bruto', () => {
    const html = buildWorkSessionHtml(acta(), 'es');
    expect(html).not.toContain('Notas en bruto');
  });

  it('sin documento se imprimen las anotaciones, para poder llevarse el papel igualmente', () => {
    const sinDoc = { ...acta(), document: undefined };
    const html = buildWorkSessionHtml(sinDoc, 'es');
    expect(html).toContain('Notas en bruto');
  });

  it('un acta no muestra el apartado de aplicación en el aula', () => {
    const html = buildWorkSessionHtml(acta(), 'es');
    expect(html).not.toContain('Aplicación en el aula');
  });

  it('genera un .docx sin lanzar excepción', async () => {
    const blob = await buildWorkSessionDocxBlob(acta(), 'es');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('exportWorkSession — memoria de formación', () => {
  it('cambia las etiquetas y añade la aplicación en el aula y las horas', () => {
    const html = buildWorkSessionHtml(memoria(), 'es');
    expect(html).toContain('MEMORIA DE FORMACIÓN');
    expect(html).toContain('Contenidos trabajados');
    expect(html).toContain('Ideas clave');
    expect(html).toContain('Aplicación en el aula');
    expect(html).toContain('Rehacer la rúbrica de exposiciones orales.');
    expect(html).toContain('Entidad y ponente');
    expect(html).toContain('Horas certificadas');
    expect(html).toContain('20');
    // Es una memoria, no un acta: no aparecen ni «Acuerdos» ni «Cierre».
    expect(html).not.toContain('>Acuerdos<');
    expect(html).toContain('Valoración');
  });

  it('en inglés usa la terminología traducida', () => {
    const html = buildWorkSessionHtml(memoria(), 'en');
    expect(html).toContain('TRAINING REPORT');
    expect(html).toContain('Content covered');
    expect(html).toContain('Key takeaways');
  });

  it('genera un .docx sin lanzar excepción', async () => {
    const blob = await buildWorkSessionDocxBlob(memoria(), 'en');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('exportWorkSession — escapado', () => {
  it('el HTML no se rompe con caracteres especiales en las anotaciones', () => {
    const s: WorkSession = {
      ...acta(),
      document: undefined,
      title: 'Reunión <urgente> & extra',
      notes: 'Acordado: nota > 5 & <script>alert(1)</script>',
    };
    const html = buildWorkSessionHtml(s, 'es');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Reunión &lt;urgente&gt; &amp; extra');
  });
});
