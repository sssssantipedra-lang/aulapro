/**
 * Los documentos del alumnado van a la IA como texto leído en el navegador, nunca como archivo, y sin lo que
 * identifica a una persona aunque no esté en la lista del alumnado. Ver `lib/documentoParaIA.ts`.
 */
import { describe, it, expect } from 'vitest';
import { avisoDeLectura, leerDocumento, quitarDatosDeContacto, quitarIdentificadores, textoDePdf } from './documentoParaIA';

/** Un PDF mínimo con Helvetica: una lista de páginas, cada una con sus líneas (solo ASCII). */
function pdf(paginas: string[][]): Uint8Array<ArrayBuffer> {
  const objetos: string[] = [];
  const nPag = paginas.length;
  // 1 catálogo, 2 páginas, 3 letra, luego página y contenido de cada una
  const kids = paginas.map((_, i) => `${4 + i * 2} 0 R`).join(' ');
  objetos.push('<< /Type /Catalog /Pages 2 0 R >>');
  objetos.push(`<< /Type /Pages /Kids [${kids}] /Count ${nPag} >>`);
  objetos.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  paginas.forEach((lineas, i) => {
    const flujo = `BT /F1 12 Tf 72 720 Td ${lineas.map((l, j) => `${j ? '0 -18 Td ' : ''}(${l}) Tj`).join(' ')} ET`;
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objetos.push(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`);
  });
  let s = '%PDF-1.4\n';
  const pos: number[] = [];
  objetos.forEach((o, i) => { pos.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${pos.map(p => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  s += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(new TextEncoder().encode(s));
}

describe('textoDePdf', () => {
  it('saca el texto de cada página, línea a línea', async () => {
    const texto = await textoDePdf(pdf([
      ['Informe psicopedagogico de la alumna', 'Presenta dificultades en la lectoescritura y en el calculo'],
      ['Orientaciones: apoyo visual, instrucciones cortas y tiempo extra en las pruebas'],
    ]));
    expect(texto).toContain('Informe psicopedagogico de la alumna');
    expect(texto).toContain('Presenta dificultades');
    expect(texto).toContain('Orientaciones: apoyo visual');
    expect(texto.indexOf('Informe')).toBeLessThan(texto.indexOf('Orientaciones'));
  });

  it('un PDF sin texto (escaneado) no se lee: error «escaneado»', async () => {
    await expect(textoDePdf(pdf([['x'], ['']]))).rejects.toThrow('escaneado');
  });
});

describe('leerDocumento', () => {
  it('lee un texto y rechaza un Word antiguo y lo que no es un documento', async () => {
    expect(await leerDocumento(new File(['hola, esto es un texto'], 'notas.txt', { type: 'text/plain' }))).toBe('hola, esto es un texto');
    await expect(leerDocumento(new File(['x'], 'viejo.doc'))).rejects.toThrow('doc');
    await expect(leerDocumento(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))).rejects.toThrow('formato');
  });

  it('lee un PDF', async () => {
    const f = new File([pdf([['Programacion de aula de Matematicas, primer trimestre, fracciones y decimales']])], 'prog.pdf', { type: 'application/pdf' });
    expect(await leerDocumento(f)).toContain('fracciones y decimales');
  });

  it('cada error tiene su aviso para el docente', () => {
    expect(avisoDeLectura(new Error('escaneado'))).toMatch(/escaneada/);
    expect(avisoDeLectura(new Error('doc'))).toMatch(/\.docx/);
    expect(avisoDeLectura(new Error('otro'))).toMatch(/No se pudo leer/);
  });
});

describe('quitarIdentificadores', () => {
  it('quita correos, teléfonos, DNI y NIE', () => {
    const r = quitarIdentificadores('Contacto: lucia.perez@gmail.com, 612 345 678, +34 963 12 34 56. DNI 12345678Z, NIE X1234567L.');
    expect(r).not.toMatch(/gmail|612|963|12345678Z|X1234567L/);
    expect(r).toContain('[correo]');
    expect(r).toContain('[teléfono]');
    expect(r).toContain('[DNI]');
  });

  it('quita la fecha de nacimiento y los números de expediente, pero no las demás fechas ni las cifras cortas', () => {
    const r = quitarIdentificadores('Fecha de nacimiento: 03/05/2016\nNIA 10293847\nEvaluación del 12/11/2026. Lee 45 palabras por minuto. Curso 2026-2027.');
    expect(r).toContain('Fecha de nacimiento: [fecha]');
    expect(r).not.toContain('03/05/2016');
    expect(r).not.toContain('10293847');
    expect(r).toContain('12/11/2026');
    expect(r).toContain('45 palabras');
    expect(r).toContain('2026-2027');
  });

  it('quita lo que sigue a una etiqueta de nombre, familiar, domicilio o centro, en los tres idiomas', () => {
    const r = quitarIdentificadores([
      'Nombre y apellidos: Lucía Pérez Navarro',
      'Madre: María Navarro Gil',
      'Domicilio: Calle Mayor, 3',
      'Centro educativo: CEIP Lluís Vives',
      'Nom i cognoms: Pau Ferrer',
      'Father: John Smith',
      'Nombre de la unidad: Las fracciones',
      'Necesidades: apoyo en lectura.',
    ].join('\n'));
    for (const fuera of ['Lucía', 'María', 'Calle Mayor', 'Lluís Vives', 'Pau Ferrer', 'John Smith']) expect(r).not.toContain(fuera);
    expect(r).toContain('Nombre y apellidos: [dato quitado]');
    // Lo demás se queda
    expect(r).toContain('Nombre de la unidad: Las fracciones');
    expect(r).toContain('Necesidades: apoyo en lectura.');
  });

  it('no toca un texto sin datos personales', () => {
    const t = 'Objetivos: 1. Leer textos de 100 palabras. 2. Sumar con llevadas hasta 1.000. Sesiones 6, 7 y 8.';
    expect(quitarIdentificadores(t)).toBe(t);
  });
});

describe('quitarDatosDeContacto (textos libres: avisos, anotaciones, notas de una reunión)', () => {
  it('quita correos, teléfonos y DNI, pero deja las líneas con etiqueta, que aquí son contenido', () => {
    const r = quitarDatosDeContacto('Madre: se compromete a revisar la agenda. Llamar al 612 345 678 o escribir a casa@correo.es.');
    expect(r).toContain('Madre: se compromete a revisar la agenda.');
    expect(r).not.toMatch(/612|casa@correo/);
  });
});
