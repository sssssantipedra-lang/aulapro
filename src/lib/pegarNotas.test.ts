import { describe, it, expect } from 'vitest';
import {
  cambiosDeRelleno, cambiosReales, conCambios, emparejarPorNombre, entenderPegado, esBloque, leerNota, leerPegado, nombresParecidos,
  esMarcaSinNota, parecidoDeNombres, pareceCabecera, planDePegado, puedeSerTitulo, sinNota, MAX_FILAS,
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

  it('una nota mal escrita en la primera fila no es la cabecera: es la del primer alumno y se señala', () => {
    // Antes «11» o «7'5» se tomaban por el título: desaparecían sin aviso y las demás notas subían una fila
    for (const mala of ['11', "7'5", '7+', '5-6', '7/10', '85', '7,5 (rec)', '-3', '10,5']) {
      const filas = leerPegado(`${mala}\n7\n8\n6`);
      expect(pareceCabecera(filas), mala).toBe(false);
      expect(entenderPegado(filas).celdas, mala).toEqual([[mala], ['7'], ['8'], ['6']]);
      expect(puedeSerTitulo(mala), mala).toBe(false);
    }
    // Con los nombres al lado, igual
    expect(entenderPegado(leerPegado('Alumno 1\t11\nAlumno 2\t7\nAlumno 3\t8'))).toMatchObject({
      cabecera: false, etiquetas: ['Alumno 1', 'Alumno 2', 'Alumno 3'], celdas: [['11'], ['7'], ['8']],
    });
    // Y el plan la señala en su alumno, sin mover a nadie
    const plan = planDePegado(entenderPegado(leerPegado('11\n7\n8')), {
      alumnado: [{ id: 'a', name: 'Alumno 1' }, { id: 'b', name: 'Alumno 2' }, { id: 'c', name: 'Alumno 3' }],
      actividades: [{ id: 'x', name: 'Examen' }], alumnoId: 'a', actividadId: 'x', notas: {},
    });
    expect(plan?.filas.map(f => f.celdas[0].estado)).toEqual(['mal', 'nueva', 'nueva']);
    expect(plan?.cambios).toEqual([{ itemId: 'x', studentId: 'b', value: 7 }, { itemId: 'x', studentId: 'c', value: 8 }]);
  });

  it('un título lleva letras o es una fecha', () => {
    for (const titulo of ['Examen T3', 'T1', '1.ª ev.', '2º examen', 'Nº', '12/11/2026', '12-11-26', '12.11.2026', '15/10', '3/12']) {
      expect(puedeSerTitulo(titulo), titulo).toBe(true);
      expect(pareceCabecera(leerPegado(`${titulo}\n7\n8`)), titulo).toBe(true);
    }
    for (const no of ['', '7', '7,5', 'NP', '-', '32/11', '5/13']) expect(puedeSerTitulo(no), no).toBe(false);
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

  it('con los nombres detrás, el número de lista lo es aunque sean pocas filas o no empiece en 1', () => {
    // Un grupo pequeño: antes el 1, 2, 3 entraba como notas de la primera actividad
    const pocos = entenderPegado(leerPegado('1\tAlumno 1\t7\n2\tAlumno 2\t8\n3\tAlumno 3\t9'));
    expect(pocos).toMatchObject({ numeroDeLista: true, etiquetas: ['Alumno 1', 'Alumno 2', 'Alumno 3'], celdas: [['7'], ['8'], ['9']] });
    // La segunda mitad de la lista, con su cabecera
    const mitad = entenderPegado(leerPegado('Nº\tNombre\tExamen\n7\tAlumno 7\t5\n8\tAlumno 8\tNP\n9\tAlumno 9\t6,5'));
    expect(mitad).toMatchObject({ numeroDeLista: true, cabecera: true, titulos: ['Examen'], celdas: [['5'], ['NP'], ['6,5']] });
    // Sin nombres detrás y con pocas filas, dos columnas de números son dos columnas de notas
    const notas = entenderPegado(leerPegado('5\t7\n6\t8\n7\t9'));
    expect(notas).toMatchObject({ numeroDeLista: false, celdas: [['5', '7'], ['6', '8'], ['7', '9']] });
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

  it('una columna entera de «NP» al principio es una actividad, no los nombres: no desplaza a la siguiente', () => {
    // Antes se apartaba como si fueran los nombres y las notas de la segunda actividad caían en la primera
    const p = entenderPegado(leerPegado('NP\t7\nNP\t8\n-\t9'));
    expect(p.etiquetas).toBeNull();
    expect(p.celdas).toEqual([['NP', '7'], ['NP', '8'], ['-', '9']]);
    // Con los nombres delante, los nombres se apartan y la columna de «NP» se queda en su sitio
    const con = entenderPegado(leerPegado('Alumno 1\tNP\t7\nAlumno 2\tNP\t8'));
    expect(con).toMatchObject({ etiquetas: ['Alumno 1', 'Alumno 2'], celdas: [['NP', '7'], ['NP', '8']] });
    // Y el número de lista con una columna de «NP» detrás no pasa por número de lista con nombres
    expect(entenderPegado(leerPegado('5\tNP\n6\tNP\n7\tNP')).numeroDeLista).toBe(false);
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

  it('con los nombres de la hoja coloca por nombre; dos filas con el mismo nombre no van a nadie', () => {
    const texto = 'Alumno 1\t7\nAlumno 3\t8\nAlumno 3\t9';
    const plan = planDePegado(entenderPegado(leerPegado(texto)), donde)!;
    expect(plan.modo).toBe('nombre');
    expect(plan.cambios.map(c => c.studentId)).toEqual(['s1']);
    expect(plan.sinColocar.map(f => [f.etiqueta, f.motivo])).toEqual([['Alumno 3', 'repetida'], ['Alumno 3', 'repetida']]);
    // Lo pegado sin nombres sigue por posición, y ahí el aviso ≠ es lo único que queda
    const sin = planDePegado(entenderPegado(leerPegado('7\n8')), donde)!;
    expect(sin.modo).toBe('posicion');
  });

  it('sin ningún nombre parecido a la clase (la hoja de otro grupo), vuelve a la posición y marca cada fila con ≠', () => {
    const plan = planDePegado(entenderPegado(leerPegado('Iván Costa\t3\nSara Mas\t7')), donde)!;
    expect(plan.modo).toBe('posicion');
    expect(plan.descuadradas).toBe(2);
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

/* ── Colocar por nombre (24-11-2026) ──
 * Probado contra una clase ya creada y hojas como las que tiene un docente: el listado oficial («Apellidos, Nombre» y por
 * apellido), su propia hoja con los nombres escritos de otra forma, con un alumno de más o de menos, solo el nombre de pila
 * o las iniciales, y la app con «12 Marta» como recomienda la privacidad. Con la colocación por posición, el listado por
 * apellido dejaba cinco de seis notas en el alumno equivocado.
 */
describe('colocar por nombre', () => {
  const clase = [
    'Ana Ruiz Mora', 'Carla Ferrer Ibáñez', 'Jorge Albert Vidal', 'Lucía Pérez Navarro', 'Marcos Gil Soler', 'Pau Martí Roig',
  ].map((name, k) => ({ id: `a${k}`, name }));
  const nota: Record<string, number> = { a0: 9, a1: 8.25, a2: 6, a3: 7.5, a4: 4, a5: 5 };
  const examen = [{ id: 'x', name: 'Examen' }];
  const pega = (filas: [string, number | string][], extra: Partial<{ cabecera: string; aMano: Record<number, string> }> = {}) => {
    const texto = [`${extra.cabecera ?? 'Alumno'}\tExamen`, ...filas.map(([n, v]) => `${n}\t${v}`)].join('\n');
    return planDePegado(entenderPegado(leerPegado(texto)), { alumnado: clase, actividades: examen, alumnoId: 'a0', actividadId: 'x', notas: {} }, extra.aMano)!;
  };
  const recibe = (plan: ReturnType<typeof pega>) => Object.fromEntries(plan.cambios.map(c => [c.studentId, c.value]));

  it('el listado oficial, «Apellidos, Nombre» y por apellido: cada nota a su alumno', () => {
    const plan = pega([['Albert Vidal, Jorge', 6], ['Ferrer Ibáñez, Carla', 8.25], ['Gil Soler, Marcos', 4], ['Martí Roig, Pau', 5], ['Pérez Navarro, Lucía', 7.5], ['Ruiz Mora, Ana', 9]]);
    expect(plan.modo).toBe('nombre');
    expect(recibe(plan)).toEqual(nota);
    expect(plan).toMatchObject({ aproximadas: 0, sinColocar: [], noEstan: [] });
    expect(plan.filas.every(f => f.parecido === 'seguro')).toBe(true);
  });

  it('en mayúsculas, sin tildes, sin el segundo apellido y con una errata: entra, y la errata se marca como aproximada', () => {
    const plan = pega([['RUIZ MORA, ANA', 9], ['FERER IBAÑEZ, CARLA', 8.25], ['albert vidal jorge', 6], ['Lucia Perez', 7.5], ['Marcos Gil', 4], ['MARTI ROIG PAU', 5]]);
    expect(recibe(plan)).toEqual(nota);
    expect(plan.filas.filter(f => f.parecido === 'aproximado').map(f => f.alumnoId)).toEqual(['a1']);
    expect(plan.aproximadas).toBe(1);
  });

  it('un alumno de más en la hoja no corre a nadie: se queda sin colocar', () => {
    const plan = pega([['Ana Ruiz', 9], ['Carla Ferrer', 8.25], ['Iván Costa', 3], ['Jorge Albert', 6], ['Lucía Pérez', 7.5], ['Marcos Gil', 4], ['Pau Martí', 5]]);
    expect(recibe(plan)).toEqual(nota);
    expect(plan.sinColocar).toEqual([{ fila: 2, etiqueta: 'Iván Costa', motivo: 'nadie', candidatos: [], textos: ['3'] }]);
    expect(plan.filasQueSobran).toBe(0);
  });

  it('a la hoja le falta un alumno: los demás van a su sitio y el que falta no se toca', () => {
    const plan = pega([['Ana Ruiz', 9], ['Jorge Albert', 6], ['Lucía Pérez', 7.5], ['Marcos Gil', 4], ['Pau Martí', 5]]);
    const { a1: _sinNota, ...resto } = nota;
    void _sinNota;
    expect(recibe(plan)).toEqual(resto);
    expect(plan.noEstan).toEqual([{ id: 'a1', nombre: 'Carla Ferrer Ibáñez' }]);
  });

  it('un mote no va a nadie; el docente lo coloca a mano y entonces entra', () => {
    const plan = pega([['Anita Ruiz', 9], ['Carla Ferrer', 8.25]]);
    expect(plan.sinColocar.map(f => [f.etiqueta, f.motivo])).toEqual([['Anita Ruiz', 'nadie']]);
    expect(recibe(plan)).toEqual({ a1: 8.25 });
    const aMano = pega([['Anita Ruiz', 9], ['Carla Ferrer', 8.25]], { aMano: { 0: 'a0' } });
    expect(recibe(aMano)).toEqual({ a0: 9, a1: 8.25 });
    expect(aMano.filas.find(f => f.alumnoId === 'a0')?.parecido).toBe('a mano');
    expect(aMano.sinColocar).toEqual([]);
  });

  it('solo el nombre de pila o con la inicial: entra si no hay otro igual, marcado como aproximado', () => {
    const plan = pega([['Ana', 9], ['Carla F.', 8.25], ['Jorge', 6], ['Lucía P.', 7.5], ['Marcos', 4], ['Pau M.', 5]]);
    expect(recibe(plan)).toEqual(nota);
    expect(plan.aproximadas).toBe(6);
  });

  it('dos alumnas que se llaman igual de nombre: «Ana» sola no va a ninguna; con el apellido, cada una a la suya', () => {
    const dos = [{ id: 'r', name: 'Ana Ruiz Mora' }, { id: 'l', name: 'Ana López Gil' }];
    expect(emparejarPorNombre(['Ana', 'Ana'], dos).map(e => (e.alumnoId === null ? e.motivo : e.alumnoId))).toEqual(['varios', 'varios']);
    expect(emparejarPorNombre(['López Gil, Ana', 'Ruiz, Ana'], dos).map(e => e.alumnoId)).toEqual(['l', 'r']);
    // Si la otra ya tiene su fila, «Ana» es la que queda, y se marca como aproximada
    expect(emparejarPorNombre(['Ana López', 'Ana'], dos)).toEqual([{ alumnoId: 'l', parecido: 'seguro' }, { alumnoId: 'r', parecido: 'aproximado' }]);
  });

  it('«Alumno 1» no es «Alumno 12», y las cifras del nombre deciden aunque la hoja esté desordenada', () => {
    const lista = [1, 2, 3, 10, 12].map(n => ({ id: `n${n}`, name: `Alumno ${n}` }));
    expect(emparejarPorNombre(['Alumno 12', 'Alumno 3', 'Alumno 1', 'Alumno 10', 'Alumno 2'], lista).map(e => e.alumnoId)).toEqual(['n12', 'n3', 'n1', 'n10', 'n2']);
    expect(parecidoDeNombres('Alumno 1', 'Alumno 12').puntos).toBe(0);
  });

  it('en la app con «12 Marta» y en la hoja el número de lista y el nombre completo: van por el número, marcadas con ≈', () => {
    const lista = [{ id: 'm', name: '12 Marta' }, { id: 'j', name: '3 Joan' }, { id: 'c', name: '7 Marc' }];
    const texto = ['Nº\tAlumno\tExamen', '3\tPuig Soler, Joan\t6', '7\tVidal Pons, Marc\t4', '12\tGarcía López, Marta\t8'].join('\n');
    const pegado = entenderPegado(leerPegado(texto));
    expect(pegado).toMatchObject({ numeroDeLista: true, numeros: ['3', '7', '12'] });
    const plan = planDePegado(pegado, { alumnado: lista, actividades: examen, alumnoId: 'm', actividadId: 'x', notas: {} })!;
    expect(Object.fromEntries(plan.cambios.map(c => [c.studentId, c.value]))).toEqual({ m: 8, j: 6, c: 4 });
    // Una lista se renumera tras una baja: lo que decide el número de la hoja hay que comprobarlo
    expect(plan.filas.every(f => f.parecido === 'aproximado')).toBe(true);
  });

  it('una palabra que solo se parece (una inicial, una errata) no basta para colocar a nadie', () => {
    expect(parecidoDeNombres('M.', 'Marta García').puntos).toBe(0);
    expect(parecidoDeNombres('Maria', 'Mario').puntos).toBe(0);
    expect(parecidoDeNombres('Marc', 'Marcos Gil').puntos).toBe(0);
    expect(parecidoDeNombres('María López', 'Mario López')).toMatchObject({ parecido: 'aproximado' });
  });

  it('con dos alumnos que encajan igual de bien, ninguno: se elige a mano', () => {
    const dos = [{ id: 'm', name: 'Ana Ruiz Mora' }, { id: 'g', name: 'Ana Ruiz Gil' }];
    expect(emparejarPorNombre(['Ana Ruiz'], dos)).toEqual([{ alumnoId: null, motivo: 'varios', candidatos: ['m', 'g'] }]);
  });

  it('da igual en qué celda se pegue: por nombre, cada fila va a su alumno', () => {
    const texto = 'Alumno\tExamen\nRuiz Mora, Ana\t9\nGil Soler, Marcos\t4';
    const plan = planDePegado(entenderPegado(leerPegado(texto)), { alumnado: clase, actividades: examen, alumnoId: 'a5', actividadId: 'x', notas: {} })!;
    expect(Object.fromEntries(plan.cambios.map(c => [c.studentId, c.value]))).toEqual({ a0: 9, a4: 4 });
  });
});
