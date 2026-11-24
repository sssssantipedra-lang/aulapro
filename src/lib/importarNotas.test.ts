import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { columnasDeNotas, destinosPropuestos, leerArchivoDeNotas, pegadoDeColumnas, recortarTabla } from './importarNotas';
import { entenderPegado, planDePegado } from './pegarNotas';

/** Un .xlsx de verdad, hecho con la misma librería que lo lee. */
function xlsx(hojas: Record<string, (string | number)[][]>, nombre = 'notas.xlsx'): File {
  const libro = XLSX.utils.book_new();
  for (const [n, filas] of Object.entries(hojas)) XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), n);
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([datos], nombre);
}

describe('recortarTabla', () => {
  it('quita los títulos de encima, las columnas vacías de los lados y las filas vacías del final', () => {
    const t = recortarTabla([
      ['', 'Notas de la 1.ª evaluación', '', ''],
      ['', '', '', ''],
      ['', 'Alumno', 'Examen', ''],
      ['', 'Ruiz Mora, Ana', '9', ''],
      ['', 'Gil Soler, Marcos', '4', ''],
      ['', '', '', ''],
    ]);
    expect(t).toEqual([['Alumno', 'Examen'], ['Ruiz Mora, Ana', '9'], ['Gil Soler, Marcos', '4']]);
  });

  it('una hoja vacía no trae nada', () => {
    expect(recortarTabla([['', ''], ['']])).toEqual([]);
  });
});

describe('leerArchivoDeNotas', () => {
  it('lee un Excel con varias hojas y se salta las vacías', async () => {
    const hojas = await leerArchivoDeNotas(xlsx({
      'Portada': [],
      '1ª ev': [['Notas 1.ª evaluación'], [], ['Alumno', 'Examen', 'Trabajo'], ['Ruiz Mora, Ana', 9, 7.5], ['Gil Soler, Marcos', 4, 'NP']],
    }));
    expect(hojas.map(h => h.nombre)).toEqual(['1ª ev']);
    expect(hojas[0].filas[0]).toEqual(['Alumno', 'Examen', 'Trabajo']);
    // Los números llegan como se ven en la celda
    expect(hojas[0].filas[1][2]).toMatch(/^7[.,]5$/);
    expect(hojas[0].filas[2][2]).toBe('NP');
  });

  it('lee un CSV con punto y coma (el de Excel en castellano) y uno con comas', async () => {
    const pc = await leerArchivoDeNotas(new File(['Alumno;Examen\r\nRuiz Mora, Ana;7,5\r\n'], 'notas.csv'));
    expect(pc[0].filas).toEqual([['Alumno', 'Examen'], ['Ruiz Mora, Ana', '7,5']]);
    const coma = await leerArchivoDeNotas(new File(['Alumno,Examen\n"Ruiz Mora, Ana",7.5\n'], 'notas.csv'));
    expect(coma[0].filas).toEqual([['Alumno', 'Examen'], ['Ruiz Mora, Ana', '7.5']]);
  });

  it('un formato que no es una hoja, o un archivo vacío, se rechaza', async () => {
    await expect(leerArchivoDeNotas(new File(['x'], 'notas.pdf'))).rejects.toThrow('formato');
    await expect(leerArchivoDeNotas(new File([''], 'notas.csv'))).rejects.toThrow('vacio');
  });
});

describe('a qué actividad va cada columna', () => {
  const actividades = [{ id: 'e1', name: 'Examen tema 3' }, { id: 'e2', name: 'Trabajo de clase' }, { id: 'e3', name: 'Dictado' }];
  const hoja = [
    ['Alumno', 'Examen tema 3', 'TRABAJO', 'Exposición oral', '', 'Observaciones'],
    ['Ruiz Mora, Ana', '9', '7', '8', '', 'muy bien'],
    ['Gil Soler, Marcos', '4', '5', '6', '', ''],
  ];

  it('propone la actividad que se llama igual o la única que lo contiene, una nueva para el resto y nada para lo que no trae notas', () => {
    const pegado = entenderPegado(hoja);
    const columnas = columnasDeNotas(pegado);
    expect(columnas.map(c => [c.titulo, c.notas])).toEqual([
      ['Examen tema 3', 2], ['TRABAJO', 2], ['Exposición oral', 2], ['', 0], ['Observaciones', 0],
    ]);
    expect(destinosPropuestos(columnas, actividades)).toEqual(['e1', 'e2', 'nueva', null, null]);
  });

  it('dos columnas no van a la misma actividad, y sin título no se propone crear nada', () => {
    const pegado = entenderPegado([['Alumno', 'Dictado', 'Dictado 2', ''], ['Ruiz Mora, Ana', '9', '8', '7']]);
    expect(destinosPropuestos(columnasDeNotas(pegado), actividades)).toEqual(['e3', 'nueva', null]);
  });

  it('solo las columnas elegidas llegan al plan, y cada nota va a su alumno por el nombre', () => {
    const pegado = entenderPegado(hoja);
    const elegido = pegadoDeColumnas(pegado, [0, 2]);
    expect(elegido.titulos).toEqual(['Examen tema 3', 'Exposición oral']);
    const alumnado = [{ id: 'g', name: 'Marcos Gil Soler' }, { id: 'r', name: 'Ana Ruiz Mora' }];
    const plan = planDePegado(elegido, {
      alumnado, actividades: [{ id: 'e1', name: 'Examen tema 3' }, { id: 'nueva:2', name: 'Exposición oral' }],
      alumnoId: 'g', actividadId: 'e1', notas: {},
    })!;
    expect(plan.modo).toBe('nombre');
    expect(plan.cambios).toEqual([
      { itemId: 'e1', studentId: 'g', value: 4 }, { itemId: 'nueva:2', studentId: 'g', value: 6 },
      { itemId: 'e1', studentId: 'r', value: 9 }, { itemId: 'nueva:2', studentId: 'r', value: 8 },
    ]);
  });
});
