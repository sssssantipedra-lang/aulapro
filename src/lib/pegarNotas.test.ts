import { describe, it, expect } from 'vitest';
import {
  cambiosDeRelleno, cambiosReales, conCambios, entenderPegado, esBloque, leerNota, leerPegado, nombresParecidos,
  esMarcaSinNota, pareceCabecera, planDePegado, sinNota, MAX_FILAS,
} from './pegarNotas';
import type { GradeMap } from '../types';

const alumnado = [1, 2, 3, 4, 5].map(n => ({ id: `s${n}`, name: `Alumno ${n}` }));
const actividades = [{ id: 'i1', name: 'Examen' }, { id: 'i2', name: 'Trabajo' }, { id: 'i3', name: 'Cuaderno' }];

describe('leerNota', () => {
  it('lee una nota de 0 a 10 con coma o con punto', () => {
    expect(leerNota('7')).toEqual({ tipo: 'nota', valor: 7 });
    expect(leerNota('7,5')).toEqual({ tipo: 'nota', valor: 7.5 });
    expect(leerNota('7.5')).toEqual({ tipo: 'nota', valor: 7.5 });
    expect(leerNota(' 10 ')).toEqual({ tipo: 'nota', valor: 10 });
    expect(leerNota('0')).toEqual({ tipo: 'nota', valor: 0 });
    expect(leerNota('10,00')).toEqual({ tipo: 'nota', valor: 10 });
    expect(leerNota('7,')).toEqual({ tipo: 'nota', valor: 7 });
    expect(leerNota(',5')).toEqual({ tipo: 'nota', valor: 0.5 });
  });

  it('redondea a dos decimales, como la celda del cuaderno', () => {
    expect(leerNota('6,666')).toEqual({ tipo: 'nota', valor: 6.67 });
  });

  it('una celda en blanco no es una nota ni un error', () => {
    expect(leerNota('')).toEqual({ tipo: 'vacia' });
    expect(leerNota('    ')).toEqual({ tipo: 'vacia' });
  });

  it('lo que no es una nota de 0 a 10 se señala', () => {
    for (const mal of ['11', '85', '-1', 'NP', '7/10', '75%', '1e1', '0x5', '7,5,2', 'siete', '10,5', '1.234,5', '+7']) {
      expect(leerNota(mal), mal).toEqual({ tipo: 'mal' });
    }
  });
});

describe('leerPegado', () => {
  it('una columna copiada de una hoja de cálculo: una fila por línea, sin la vacía del final', () => {
    expect(leerPegado('7,5\r\n8\r\n\r\n6\r\n')).toEqual([['7,5'], ['8'], [''], ['6']]);
  });

  it('varias columnas van separadas por tabuladores y todas las filas quedan igual de anchas', () => {
    expect(leerPegado('7\t8\n6\n5\t4\t3')).toEqual([['7', '8', ''], ['6', '', ''], ['5', '4', '3']]);
  });

  it('las columnas vacías del final se quitan', () => {
    expect(leerPegado('7\t\t\n8\t\t')).toEqual([['7'], ['8']]);
  });

  it('una celda entre comillas puede llevar saltos de línea, tabuladores y comillas', () => {
    expect(leerPegado('"Pérez,\nLucía"\t7\n"Dice ""hola"""\t8')).toEqual([['Pérez, Lucía', '7'], ['Dice "hola"', '8']]);
  });

  it('una comilla suelta no se come el resto', () => {
    expect(leerPegado('"7\t8\n9\t10')).toEqual([['"7', '8'], ['9', '10']]);
  });

  it('sin tabuladores, el punto y coma separa; la coma nunca, que es el decimal', () => {
    expect(leerPegado('Alumno 1;7,5\nAlumno 2;8')).toEqual([['Alumno 1', '7,5'], ['Alumno 2', '8']]);
    expect(leerPegado('7,5')).toEqual([['7,5']]);
  });

  it('nada pegado es nada', () => {
    expect(leerPegado('')).toEqual([]);
    expect(leerPegado('\n\n')).toEqual([]);
  });

  it('un texto enorme no pasa del tope de filas', () => {
    expect(leerPegado(Array.from({ length: 1000 }, (_, k) => String(k % 10)).join('\n')).length).toBe(MAX_FILAS);
  });

  it('solo un bloque de más de una celda pide vista previa', () => {
    expect(esBloque(leerPegado('7,5'))).toBe(false);
    expect(esBloque(leerPegado('7\n8'))).toBe(true);
    expect(esBloque(leerPegado('7\t8'))).toBe(true);
    expect(esBloque([])).toBe(false);
  });
});

describe('entenderPegado', () => {
  it('una columna de notas se queda como está', () => {
    const p = entenderPegado(leerPegado('7\n8\n9'));
    expect(p.celdas).toEqual([['7'], ['8'], ['9']]);
    expect(p).toMatchObject({ etiquetas: null, titulos: null, cabecera: false, numeroDeLista: false });
  });

  it('la primera fila sin notas, con notas debajo, es la cabecera y no se cuenta', () => {
    const filas = leerPegado('Examen T3\tTrabajo\n7\t8\n6\t5');
    expect(pareceCabecera(filas)).toBe(true);
    const p = entenderPegado(filas);
    expect(p.cabecera).toBe(true);
    expect(p.titulos).toEqual(['Examen T3', 'Trabajo']);
    expect(p.celdas).toEqual([['7', '8'], ['6', '5']]);
  });

  it('el docente puede decir que la primera fila no es una cabecera, o que sí lo es', () => {
    const filas = leerPegado('Examen\n7\n6');
    expect(entenderPegado(filas).celdas).toEqual([['7'], ['6']]);
    expect(entenderPegado(filas, { cabecera: false }).celdas).toEqual([['Examen'], ['7'], ['6']]);
    expect(entenderPegado(leerPegado('5\n7\n6'), { cabecera: true }).celdas).toEqual([['7'], ['6']]);
    expect(entenderPegado(leerPegado('NP\n7\n6'), { cabecera: true }).celdas).toEqual([['7'], ['6']]);
  });

  it('una primera fila con alguna nota no es una cabecera', () => {
    expect(pareceCabecera(leerPegado('NP\t7\n6\t5'))).toBe(false);
    expect(pareceCabecera(leerPegado('Examen'))).toBe(false);
    expect(pareceCabecera(leerPegado('Hola\nAdiós'))).toBe(false);
  });

  it('el primer alumno sin nota no es la cabecera: tomarlo por ella correría una fila todas las notas', () => {
    // Lo que se escribe en vez de una nota
    for (const marca of ['NP', 'N.P.', 'np', '-', '—', '?', 'x', 'Falta', 'Exento', 'No presentado', 'IN', 'Pendiente']) {
      const filas = leerPegado(`${marca}\n7\n8\n9`);
      expect(pareceCabecera(filas), marca).toBe(false);
      expect(entenderPegado(filas).celdas, marca).toEqual([[marca], ['7'], ['8'], ['9']]);
    }
    expect(esMarcaSinNota('Examen T3')).toBe(false);
    expect(esMarcaSinNota('Nota')).toBe(false);
    expect(esMarcaSinNota('')).toBe(false);
    // Un texto que se repite más abajo en su columna tampoco es un título
    expect(pareceCabecera(leerPegado('No lo hizo\n7\nNo lo hizo\n9'))).toBe(false);
    // Con los nombres al lado: el primero sin nota, o con «NP», es un alumno
    expect(pareceCabecera(leerPegado('Alumno 1\t\nAlumno 2\t7\nAlumno 3\t8'))).toBe(false);
    expect(pareceCabecera(leerPegado('Alumno 1\tNP\nAlumno 2\t7\nAlumno 3\t8'))).toBe(false);
    expect(entenderPegado(leerPegado('Alumno 1\tNP\nAlumno 2\t7\nAlumno 3\t8'))).toMatchObject({
      cabecera: false, etiquetas: ['Alumno 1', 'Alumno 2', 'Alumno 3'], celdas: [['NP'], ['7'], ['8']],
    });
    // Y con el número de lista delante
    expect(pareceCabecera(leerPegado('1\tAlumno 1\tNP\n2\tAlumno 2\t7'))).toBe(false);
  });

  it('una cabecera de verdad se sigue reconociendo, aunque debajo haya alumnos sin nota', () => {
    expect(pareceCabecera(leerPegado('Nota\nNP\n7\n8'))).toBe(true);
    expect(pareceCabecera(leerPegado('Nombre\tExamen\nAlumno 1\tNP\nAlumno 2\t7'))).toBe(true);
    expect(pareceCabecera(leerPegado('Nº\tNombre\tExamen\tTrabajo\n1\tAlumno 1\t\t6\n2\tAlumno 2\t7\t'))).toBe(true);
    // Basta con un título en una columna de notas: la otra puede venir sin él
    expect(pareceCabecera(leerPegado('Examen\t\n7\t8\n6\t5'))).toBe(true);
  });

  it('las columnas de nombre del principio se apartan y se enseñan como etiqueta', () => {
    const p = entenderPegado(leerPegado('Apellidos\tNombre\tExamen\nPérez Navarro\tLucía\t7\nGil\tMarc\t8'));
    expect(p.etiquetas).toEqual(['Pérez Navarro Lucía', 'Gil Marc']);
    expect(p.titulos).toEqual(['Examen']);
    expect(p.celdas).toEqual([['7'], ['8']]);
  });

  it('el número de lista (1, 2, 3…) delante de otras columnas no es una nota', () => {
    const p = entenderPegado(leerPegado('1\tAlumno 1\t7\n2\tAlumno 2\t8\n3\tAlumno 3\t9\n4\tAlumno 4\t5\n5\tAlumno 5\t6'));
    expect(p.numeroDeLista).toBe(true);
    expect(p.etiquetas).toEqual(['Alumno 1', 'Alumno 2', 'Alumno 3', 'Alumno 4', 'Alumno 5']);
    expect(p.celdas.map(f => f[0])).toEqual(['7', '8', '9', '5', '6']);
  });

  it('una sola columna de 1 a 5 son notas, no el número de lista', () => {
    const p = entenderPegado(leerPegado('1\n2\n3\n4\n5'));
    expect(p.numeroDeLista).toBe(false);
    expect(p.celdas.length).toBe(5);
  });

  it('una columna de texto en medio conserva su sitio: no desplaza a la siguiente', () => {
    const p = entenderPegado(leerPegado('7\tNP\t8\n6\tNP\t5'));
    expect(p.celdas).toEqual([['7', 'NP', '8'], ['6', 'NP', '5']]);
    expect(p.etiquetas).toBeNull();
  });

  it('si todo es texto no queda ninguna columna de notas', () => {
    const p = entenderPegado(leerPegado('Alumno 1\nAlumno 2'));
    expect(p.celdas).toEqual([[], []]);
  });
});

describe('nombresParecidos', () => {
  it('no le importan el orden, las tildes, las mayúsculas ni la coma', () => {
    expect(nombresParecidos('Pérez Navarro, Lucía', 'Lucía Pérez Navarro')).toBe(true);
    expect(nombresParecidos('LUCIA PEREZ', 'Lucía Pérez Navarro')).toBe(true);
    expect(nombresParecidos('Alumno 3', 'Alumno 3')).toBe(true);
  });
  it('avisa cuando es otra persona', () => {
    expect(nombresParecidos('Alumno 3', 'Alumno 4')).toBe(false);
    expect(nombresParecidos('Marc Gil', 'Lucía Pérez')).toBe(false);
  });
  it('sin nombre no hay nada que avisar', () => {
    expect(nombresParecidos('', 'Alumno 1')).toBe(true);
  });
});

describe('planDePegado', () => {
  const notas: GradeMap = { i1: { s1: 5, s2: 8, s3: null }, i2: { s2: 6 } };
  const donde = { alumnado, actividades, notas, alumnoId: 's1', actividadId: 'i1' };

  it('rellena hacia abajo desde la celda, casando por posición', () => {
    const plan = planDePegado(entenderPegado(leerPegado('7,5\n8\n9')), { ...donde, alumnoId: 's2' })!;
    expect(plan.filas.map(f => f.alumnoId)).toEqual(['s2', 's3', 's4']);
    expect(plan.columnas.map(c => c.id)).toEqual(['i1']);
    expect(plan.filas.map(f => f.celdas[0].estado)).toEqual(['cambia', 'nueva', 'nueva']);
    expect(plan.cambios).toEqual([
      { itemId: 'i1', studentId: 's2', value: 7.5 },
      { itemId: 'i1', studentId: 's3', value: 8 },
      { itemId: 'i1', studentId: 's4', value: 9 },
    ]);
    expect(plan).toMatchObject({ nuevas: 2, cambian: 1, iguales: 0, mal: 0, filasQueSobran: 0, columnasQueSobran: 0 });
  });

  it('con varias columnas rellena también hacia la derecha', () => {
    const plan = planDePegado(entenderPegado(leerPegado('7\t4\n8\t6')), donde)!;
    expect(plan.columnas.map(c => c.id)).toEqual(['i1', 'i2']);
    expect(plan.cambios).toEqual([
      { itemId: 'i1', studentId: 's1', value: 7 },
      { itemId: 'i2', studentId: 's1', value: 4 },
    ]);
    // Alumno 2 ya tenía un 8 y un 6: no cambia nada
    expect(plan.filas[1].celdas.map(c => c.estado)).toEqual(['igual', 'igual']);
    expect(plan).toMatchObject({ nuevas: 1, cambian: 1, iguales: 2 });
  });

  it('dice lo que pisa: la nota que había y la que queda', () => {
    const plan = planDePegado(entenderPegado(leerPegado('9\n3')), donde)!;
    expect(plan.filas[0].celdas[0]).toEqual({ texto: '9', estado: 'cambia', antes: 5, valor: 9 });
    expect(plan.filas[1].celdas[0]).toEqual({ texto: '3', estado: 'cambia', antes: 8, valor: 3 });
  });

  it('lo que no es una nota se señala y no entra; una celda vacía no borra la nota que había', () => {
    const plan = planDePegado(entenderPegado(leerPegado('NP\n\n11\n7'), { cabecera: false }), donde)!;
    expect(plan.filas.map(f => f.celdas[0].estado)).toEqual(['mal', 'vacia', 'mal', 'nueva']);
    expect(plan.filas[0].celdas[0].valor).toBe(5);
    expect(plan.filas[1].celdas[0].valor).toBe(8);
    expect(plan.mal).toBe(2);
    expect(plan.cambios).toEqual([{ itemId: 'i1', studentId: 's4', value: 7 }]);
  });

  it('lo que no cabe se cuenta y no entra', () => {
    const texto = ['1\t2\t3', '4\t5\t6', '7\t8\t9', '1\t1\t1'].join('\n');
    const plan = planDePegado(entenderPegado(leerPegado(texto)), { ...donde, alumnoId: 's4', actividadId: 'i2' })!;
    expect(plan.filas.map(f => f.alumnoId)).toEqual(['s4', 's5']);
    expect(plan.columnas.map(c => c.id)).toEqual(['i2', 'i3']);
    expect(plan.filasQueSobran).toBe(2);
    expect(plan.columnasQueSobran).toBe(1);
    expect(plan.cambios.length).toBe(4);
  });

  it('con los nombres de la hoja, avisa de las filas que no cuadran con el alumno', () => {
    const texto = 'Alumno 1\t7\nAlumno 3\t8\nAlumno 3\t9';
    const plan = planDePegado(entenderPegado(leerPegado(texto)), donde)!;
    expect(plan.filas.map(f => f.etiqueta)).toEqual(['Alumno 1', 'Alumno 3', 'Alumno 3']);
    expect(plan.filas.map(f => f.descuadra)).toEqual([false, true, false]);
    expect(plan.descuadradas).toBe(1);
    // Sigue casando por posición: el aviso no cambia a quién va cada nota
    expect(plan.cambios.map(c => c.studentId)).toEqual(['s1', 's3']);
  });

  it('lleva el título que la columna tenía en la hoja', () => {
    const plan = planDePegado(entenderPegado(leerPegado('Control\tRedacción\n7\t8')), donde)!;
    expect(plan.columnas).toEqual([{ id: 'i1', nombre: 'Examen', titulo: 'Control' }, { id: 'i2', nombre: 'Trabajo', titulo: 'Redacción' }]);
  });

  it('sin la celda de partida no hay plan', () => {
    expect(planDePegado(entenderPegado(leerPegado('7\n8')), { ...donde, alumnoId: 'nadie' })).toBeNull();
    expect(planDePegado(entenderPegado(leerPegado('7\n8')), { ...donde, actividadId: 'ninguna' })).toBeNull();
  });

  it('no toca las notas que recibe', () => {
    const copia = JSON.stringify(notas);
    planDePegado(entenderPegado(leerPegado('1\t2\n3\t4')), donde);
    expect(JSON.stringify(notas)).toBe(copia);
  });
});

describe('poner una nota a quien no tiene', () => {
  const deActividad = { s1: 5, s2: null, s4: 0 };

  it('sin nota es quien no tiene número: el 0 es una nota', () => {
    expect(sinNota(alumnado, deActividad).map(a => a.id)).toEqual(['s2', 's3', 's5']);
    expect(sinNota(alumnado, undefined).length).toBe(5);
  });

  it('solo escribe en los vacíos, nunca pisa', () => {
    expect(cambiosDeRelleno('i1', alumnado, deActividad, 5)).toEqual([
      { itemId: 'i1', studentId: 's2', value: 5 },
      { itemId: 'i1', studentId: 's3', value: 5 },
      { itemId: 'i1', studentId: 's5', value: 5 },
    ]);
  });
});

describe('aplicar los cambios', () => {
  const notas: GradeMap = { i1: { s1: 5, s2: null }, i2: { s1: 3 } };

  it('de lo pedido, solo cuenta lo que cambia algo', () => {
    expect(cambiosReales([
      { itemId: 'i1', studentId: 's1', value: 5 },
      { itemId: 'i1', studentId: 's2', value: null },
      { itemId: 'i1', studentId: 's3', value: null },
      { itemId: 'i1', studentId: 's3', value: 7 },
      { itemId: 'i3', studentId: 's1', value: 2 },
    ], notas)).toEqual([{ itemId: 'i1', studentId: 's3', value: 7 }, { itemId: 'i3', studentId: 's1', value: 2 }]);
  });

  it('pone las notas sin tocar el mapa de antes ni las columnas que no cambian', () => {
    const despues = conCambios(notas, [{ itemId: 'i1', studentId: 's2', value: 9 }, { itemId: 'i3', studentId: 's1', value: 2 }]);
    expect(despues).toEqual({ i1: { s1: 5, s2: 9 }, i2: { s1: 3 }, i3: { s1: 2 } });
    expect(notas.i1.s2).toBeNull();
    expect(despues.i2).toBe(notas.i2);
    expect(conCambios(notas, [])).toBe(notas);
  });
});
