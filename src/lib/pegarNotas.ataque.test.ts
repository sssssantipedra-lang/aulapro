/**
 * Pegar notas por nombre: los casos que encontró el ataque del 24-11-2026 (cinco familias de hojas reales: nombres
 * compuestos, catalanes y valencianos, listados oficiales, nombres parecidos e iniciales y números de lista). Cada
 * caso dejaba una nota en el alumno equivocado sin nada que confirmar, o no colocaba lo evidente. La regla que se
 * comprueba aquí: **una nota nunca va al alumno equivocado como «seguro»**; lo dudoso se marca con ≈ o no se coloca.
 * Estas pruebas llevan nombres inventados a propósito: comprueban cómo se emparejan nombres reales.
 */
import { describe, it, expect } from 'vitest';
import { entenderPegado, leerPegado, planDePegado } from './pegarNotas';
import { ordenarAlumnado } from './alumnado';

/** Pega la hoja como la pantalla y dice qué recibe cada alumno (por nombre), con qué seguridad, y lo que no se coloca. */
function pega(nombres: string[], hoja: string) {
  const alumnado = ordenarAlumnado(nombres.map((name, k) => ({ id: `a${k}`, name })));
  const pegado = entenderPegado(leerPegado(hoja));
  const plan = planDePegado(pegado, { alumnado, actividades: [{ id: 'x', name: 'Examen' }, { id: 'y', name: 'Trabajo' }], alumnoId: alumnado[0].id, actividadId: 'x', notas: {} })!;
  const nombre = (id: string) => alumnado.find(a => a.id === id)!.name;
  const recibe: Record<string, { nota: number | null; parecido?: string }> = {};
  for (const f of plan.filas) recibe[f.nombre] = { nota: f.celdas[0]?.valor ?? null, parecido: f.parecido };
  const notaDe = (n: string) => plan.cambios.find(c => c.itemId === 'x' && nombre(c.studentId) === n)?.value ?? null;
  return { plan, pegado, recibe, notaDe, sinColocar: plan.sinColocar.map(f => f.etiqueta) };
}

describe('nombres compuestos', () => {
  it('«Ma José» no lleva la nota a su hermano José: va a María José, marcada con ≈', () => {
    const r = pega(['María José Sanz Gil', 'José Sanz Gil', 'Ana Ruiz'], 'Sanz Gil, Ma José\t4\nRuiz, Ana\t7');
    expect(r.notaDe('José Sanz Gil')).toBeNull();
    expect(r.recibe['María José Sanz Gil']).toEqual({ nota: 4, parecido: 'aproximado' });
    // Sin el hermano en la clase, va a María José, marcada con ≈
    expect(pega(['María José Sanz Gil', 'Ana Ruiz'], 'Sanz Gil, Ma José\t4\nRuiz, Ana\t7').recibe['María José Sanz Gil']).toEqual({ nota: 4, parecido: 'aproximado' });
    expect(r.recibe['Ana Ruiz'].parecido).toBe('seguro');
  });

  it('«Fco. Javier» es Francisco Javier, no Javier López', () => {
    const r = pega(['Francisco Javier López García', 'Javier López', 'Ana Ruiz Gil', 'Pablo Martín Sanz'], 'López García, Fco. Javier\t4\nRuiz Gil, Ana\t7\nMartín Sanz, Pablo\t8');
    expect(r.notaDe('Javier López')).toBeNull();
    expect(r.recibe['Francisco Javier López García']).toEqual({ nota: 4, parecido: 'seguro' });
  });

  it('«José María» y «María José» no son el mismo nombre: manda el orden', () => {
    const r = pega(['José María García López', 'María José García', 'Ana Ruiz Gil'], 'García, José María\t5\nRuiz Gil, Ana\t6');
    expect(r.notaDe('María José García')).toBeNull();
    expect(r.notaDe('José María García López')).toBe(5);
    const hermanos = pega(['José María Pérez Gil', 'María José Pérez Gil', 'Ana Ruiz Gil'], 'Pérez Gil, José María\t5\nPérez Gil, María José\t3\nRuiz Gil, Ana\t6');
    expect(hermanos.recibe['José María Pérez Gil']).toEqual({ nota: 5, parecido: 'seguro' });
    expect(hermanos.recibe['María José Pérez Gil']).toEqual({ nota: 3, parecido: 'seguro' });
    const una = pega(['María José Pérez', 'José María Pérez'], 'Pérez, María José\t9');
    expect(una.plan.modo).toBe('nombre');
    expect(una.notaDe('María José Pérez')).toBe(9);
    expect(una.notaDe('José María Pérez')).toBeNull();
  });

  it('una alumna nueva, «Ana Belén», no se lleva la nota como segura de quien solo se llama «Ana»', () => {
    const r = pega(['Ana Ruiz Gil', 'Luis Sanz'], 'Ruiz Gil, Ana Belén\t3\nSanz, Luis\t5');
    expect(r.recibe['Ana Ruiz Gil']?.parecido).not.toBe('seguro');
  });

  it('un apellido escrito junto («Sanjuán», «Delafuente») es el mismo que separado', () => {
    expect(pega(['Pablo San Juan Gil', 'Ana Ruiz'], 'Sanjuán Gil, Pablo\t4\nRuiz, Ana\t7').notaDe('Pablo San Juan Gil')).toBe(4);
    expect(pega(['Pablo de la Fuente Gil', 'Ana Ruiz'], 'Delafuente Gil, Pablo\t4\nRuiz, Ana\t7').notaDe('Pablo de la Fuente Gil')).toBe(4);
  });
});

describe('nombres catalanes y valencianos', () => {
  it('«Marcel·la» es «Marcella», no su hermano Marcel', () => {
    const r = pega(['Marcel Ballester Puig', 'Marcella Ballester Puig', 'Núria Soler'], 'Ballester Puig, Marcel·la\t9\nSoler, Núria\t6');
    expect(r.notaDe('Marcel Ballester Puig')).toBeNull();
    expect(r.recibe['Marcella Ballester Puig']).toEqual({ nota: 9, parecido: 'seguro' });
    expect(pega(['Gilla Ferrer', 'Pau Vidal'], 'Ferrer, Gil·la\t8\nVidal, Pau\t5').recibe['Gilla Ferrer']).toEqual({ nota: 8, parecido: 'seguro' });
  });

  it('un nombre compuesto que contiene otro («Joan Pau» y «Pau») no se da por seguro', () => {
    const r = pega(['Joan Pau Ferrer', 'Núria Martí', 'Jordi Puig'], 'Ferrer, Pau\t3\nMartí, Núria\t7\nPuig, Jordi\t8');
    expect(r.recibe['Joan Pau Ferrer']?.parecido).not.toBe('seguro');
  });

  it('la «i» entre apellidos no es la inicial de nadie', () => {
    const r = pega(['Irene Puig Soler', 'Núria Martí'], 'Puig i Soler, Jordi\t4\nMartí, Núria\t7');
    expect(r.notaDe('Irene Puig Soler')).toBeNull();
    expect(r.sinColocar).toEqual(['Puig i Soler, Jordi']);
  });

  it('«L\'Hereu» es «Lhereu», y la L del apóstrofo no es la inicial de Laia', () => {
    const r = pega(['Marc Lhereu', 'Laia Martí', 'Laura Damico'], "D'Amico, Laura\t4\nL'Hereu, Marc\t9\nMartí, Laia\t7");
    expect(r.notaDe('Marc Lhereu')).toBe(9);
    expect(r.notaDe('Laura Damico')).toBe(4);
    expect(r.notaDe('Laia Martí')).toBe(7);
  });
});

describe('formatos de los listados', () => {
  it('la columna del tutor no cuenta para el nombre', () => {
    const r = pega(['Lucía Pérez Navarro', 'Lucía Pérez Gil', 'Hugo Sanz Mora'], 'Alumno\tTutor/a\tExamen\nPérez Navarro, Lucía\tJuan Gil\t7\nSanz Mora, Hugo\tJuan Gil\t4');
    expect(r.notaDe('Lucía Pérez Navarro')).toBe(7);
    expect(r.notaDe('Lucía Pérez Gil')).toBeNull();
  });

  it('la columna del grupo («3ºA») tampoco, aunque no tenga título', () => {
    const conTitulo = pega(['Lucía Pérez Navarro', 'Hugo Sanz Mora', 'Ana Ruiz Gil'], 'Apellido 1\tNombre\tGrupo\tExamen\nPérez\tLucía\t3ºA\t7\nSanz\tHugo\t3ºA\t4\nRuiz\tAna\t3ºA\t9');
    expect(conTitulo.plan.modo).toBe('nombre');
    expect([conTitulo.notaDe('Lucía Pérez Navarro'), conTitulo.notaDe('Hugo Sanz Mora'), conTitulo.notaDe('Ana Ruiz Gil')]).toEqual([7, 4, 9]);
    const sinTitulo = pega(['Lucía Pérez Navarro', 'Hugo Sanz Mora', 'Ana Ruiz Gil'], 'Pérez\tLucía\t3ºA\t7\nSanz\tHugo\t3ºA\t4\nRuiz\tAna\t3ºA\t9');
    expect([sinTitulo.notaDe('Lucía Pérez Navarro'), sinTitulo.notaDe('Hugo Sanz Mora'), sinTitulo.notaDe('Ana Ruiz Gil')]).toEqual([7, 4, 9]);
  });

  it('«Lucía» sola con dos Lucías en la clase no va a ninguna', () => {
    const r = pega(['Lucía Álvarez', 'Lucía Pérez', 'Marcos Gil'], 'Nombre\tGrupo\tExamen\nLucía\t3ºA\t7\nMarcos\t3ºA\t5');
    expect(r.notaDe('Lucía Álvarez')).toBeNull();
    expect(r.notaDe('Lucía Pérez')).toBeNull();
    expect(r.sinColocar).toEqual(['Lucía']);
  });

  it('la hoja de otro grupo, con algún nombre que coincide: se avisa y hay que confirmarlo', () => {
    const r = pega(['Lucía Pérez', 'Daniel García', 'Ana Ruiz', 'Marc Puig'], 'Pérez Gil, Lucía\t2\nGarcía Sanz, Daniel\t3\nMartín Ruiz, Pablo\t9\nSoler Vidal, Irene\t8');
    expect(r.plan.pareceOtroGrupo).toBe(true);
  });

  it('una columna de notas antes de los nombres no se toma por el número de lista', () => {
    const r = pega(['Alumno 1', 'Alumno 2', 'Alumno 3'], 'Examen\tNombre\tTrabajo\n7\tAlumno 3\t2\n5\tAlumno 1\t3\n9\tAlumno 2\t4');
    expect(r.pegado.numeroDeLista).toBe(false);
    // No se reconocen los nombres (no van delante): se coloca por posición y la pantalla pide confirmar el orden
    expect(r.plan.modo).toBe('posicion');
  });
});

describe('nombres parecidos', () => {
  it('«Martín» con todo lo suyo le gana a «Martina» con una letra de más', () => {
    const r = pega(['Martín Gil', 'Martina Gil Sanz', 'Pau Roca'], 'Gil Sanz, Martín\t7\nRoca Puig, Pau\t5');
    expect(r.notaDe('Martina Gil Sanz')).toBeNull();
    expect(r.recibe['Martín Gil']).toEqual({ nota: 7, parecido: 'seguro' });
  });

  it('mellizos Daniel y Daniela: cada uno a su sitio', () => {
    const r = pega(['Daniel Ruiz Sanz', 'Daniela Ruiz', 'Eva Mora'], 'Ruiz Sanz, Daniel\t4\nRuiz Sanz, Daniela\t9\nMora Gil, Eva\t6');
    expect(r.notaDe('Daniel Ruiz Sanz')).toBe(4);
    expect(r.notaDe('Daniela Ruiz')).toBe(9);
    expect(r.sinColocar).toEqual([]);
  });

  it('«María José Pérez» y «José María Pérez» en la misma hoja: cada una a la suya', () => {
    const r = pega(['José María Pérez', 'María José Pérez', 'Eva Mora'], 'Pérez, María José\t9\nPérez, José María\t4\nMora Gil, Eva\t6');
    expect([r.notaDe('María José Pérez'), r.notaDe('José María Pérez'), r.notaDe('Eva Mora')]).toEqual([9, 4, 6]);
  });
});

describe('iniciales y números', () => {
  it('iniciales en otro orden no se cruzan', () => {
    const r = pega(['M.P.G.', 'P.M.G.'], 'P.M.G.\t5\nM.P.G.\t7');
    expect(r.plan.modo).toBe('nombre');
    expect([r.notaDe('M.P.G.'), r.notaDe('P.M.G.')]).toEqual([7, 5]);
    const tres = pega(['M.P.G.', 'M.G.P.', 'A.R.L.'], 'M.P.G.\t7\nM.G.P.\t5\nA.R.L.\t6');
    expect([tres.notaDe('M.P.G.'), tres.notaDe('M.G.P.'), tres.notaDe('A.R.L.')]).toEqual([7, 5, 6]);
  });

  it('«MPG» sin puntos es «M.P.G.»', () => {
    const r = pega(['M.P.G.', 'A.R.L.', 'J.S.T.'], 'MPG\t7\nARL\t5\nJST\t6');
    expect([r.notaDe('M.P.G.'), r.notaDe('A.R.L.'), r.notaDe('J.S.T.')]).toEqual([7, 5, 6]);
  });

  it('el número de lista de una hoja renumerada no da nada por seguro', () => {
    const r = pega(['12 Marta', '13 Marta', 'Pedro'], 'Nº\tNombre\tNota\n11\tMarta García\t5\n12\tMarta López\t9\n13\tPedro Ruiz\t6');
    expect(r.plan.filas.filter(f => f.alumnoId !== undefined && f.nombre.includes('Marta')).every(f => f.parecido !== 'seguro')).toBe(true);
  });

  it('solo números de lista, con la clase guardada con su número: va por el número y se marca', () => {
    const r = pega(['Alumno 1', 'Alumno 2', 'Alumno 3', 'Alumno 5', 'Alumno 6', 'Alumno 7'], 'Nº\tNota\n1\t7\n2\t5\n3\t8\n4\t6\n5\t9\n6\t4');
    expect(r.plan.modo).toBe('nombre');
    expect([r.notaDe('Alumno 1'), r.notaDe('Alumno 5'), r.notaDe('Alumno 6'), r.notaDe('Alumno 7')]).toEqual([7, 9, 4, null]);
    expect(r.sinColocar).toEqual(['Nº 4']);
  });

  it('con «Nº» en la cabecera, aunque no empiece en 1, es el número de lista y no una nota', () => {
    const r = pega(['Ana', 'Luis', 'Pau'], 'Nº\tNota\n3\t7\n5\t5\n6\t8');
    expect(r.pegado.numeroDeLista).toBe(true);
    expect(r.pegado.celdas).toEqual([['7'], ['5'], ['8']]);
  });

  it('el alumnado guardado solo con su número: «Alumno 3» es el 3', () => {
    const r = pega(['1', '2', '3'], 'Alumno 3\t7\nAlumno 1\t5\nAlumno 2\t6');
    expect([r.notaDe('1'), r.notaDe('2'), r.notaDe('3')]).toEqual([5, 6, 7]);
  });
});

/* ── Segunda vuelta del ataque (24-11-2026), sobre el emparejado ya endurecido ── */
describe('segunda vuelta: hojas sin coma y nombres que también son apellidos', () => {
  it('«De Miguel Ruiz | Lucía» es Lucía, no su compañero Miguel', () => {
    const r = pega(['Lucía de Miguel Ruiz', 'Miguel Ruiz', 'Ana López Gil'], 'Apellidos\tNombre\tExamen\nDe Miguel Ruiz\tLucía\t9\nLópez Gil\tAna\t6\nRuiz Sanz\tMiguel\t4');
    expect([r.notaDe('Lucía de Miguel Ruiz'), r.notaDe('Miguel Ruiz'), r.notaDe('Ana López Gil')]).toEqual([9, 4, 6]);
    const una = pega(['Lucía de Andrés Martín', 'Andrés Martín', 'Ana López Gil'], 'Apellidos\tNombre\tExamen\nDe Andrés Martín\tLucía\t9');
    expect(una.notaDe('Andrés Martín')).toBeNull();
  });

  it('«Martín», «Lorenzo» o «Vicente» de nombre y de apellido: manda la columna de cada cosa', () => {
    const r = pega(['Martín Ruiz', 'Pablo Martín', 'Ana López', 'Hugo Sanz'], 'Apellidos\tNombre\tExamen\nLópez Gil\tAna\t6\nMartín Ruiz\tPablo\t9\nRuiz Gómez\tMartín\t4\nSanz Mora\tHugo\t7');
    expect([r.notaDe('Pablo Martín'), r.notaDe('Martín Ruiz')]).toEqual([9, 4]);
    expect(pega(['Lorenzo Sanz', 'Marta Lorenzo', 'Ana López'], 'Apellidos\tNombre\tExamen\nLorenzo Sanz\tMarta\t9').notaDe('Marta Lorenzo')).toBe(9);
    expect(pega(['Ramón Vicente', 'Vicente Ramón', 'Ana Ruiz'], 'Apellidos\tNombre\tNota\nRamón\tVicente\t4\nRuiz\tAna\t6').notaDe('Vicente Ramón')).toBe(4);
    expect(pega(['Lucía Martín', 'Martín López', 'Hugo Sanz', 'Ana Ruiz'], 'Apellidos\tNombre\tExamen\nMartín López\tLucía\t4\nLópez García\tMartín\t9\nSanz Mora\tHugo\t6\nRuiz Gil\tAna\t7').notaDe('Lucía Martín')).toBe(4);
  });

  it('sin títulos ni coma, la fila que se puede leer de dos maneras no se da por segura a nadie', () => {
    const r = pega(['Martín Ruiz', 'Pablo Martín', 'Ana López', 'Hugo Sanz'], 'LÓPEZ GIL ANA\t6\nMARTÍN RUIZ PABLO\t9\nRUIZ GÓMEZ MARTÍN\t4\nSANZ MORA HUGO\t7');
    expect(r.recibe['Martín Ruiz']).toEqual({ nota: 4, parecido: 'seguro' });
    expect(r.recibe['Pablo Martín']?.parecido).not.toBe('seguro');
    const dos = pega(['Lucía Martín', 'Martín López', 'Hugo Sanz', 'Ana Ruiz'], 'MARTÍN LÓPEZ LUCÍA\t4\nLÓPEZ GARCÍA MARTÍN\t9\nSANZ MORA HUGO\t6\nRUIZ GIL ANA\t7');
    expect(dos.notaDe('Martín López')).not.toBe(4);
    const tres = pega(['Lucía M.', 'Martín López', 'Ana Gil'], 'Lucía Martín López\t4\nAna Gil\t6');
    expect(tres.recibe['Martín López']?.parecido).not.toBe('seguro');
  });

  it('el alumnado guardado con los apellidos delante, con o sin coma', () => {
    const coma = pega(['Pérez Navarro, Lucía', 'Pérez Navarro, Pablo', 'Ruiz, Ana', 'Ruiz Mora, Ana'], 'Alumno\tNota\nPérez Navarro, Lucía\t4\nPérez Navarro, Pablo\t6\nRuiz, Ana\t8\nRuiz Mora, Ana\t5');
    expect(coma.plan.filas.map(f => [f.nombre, f.celdas[0].valor, f.parecido])).toEqual([
      ['Pérez Navarro, Lucía', 4, 'seguro'], ['Pérez Navarro, Pablo', 6, 'seguro'], ['Ruiz Mora, Ana', 5, 'seguro'], ['Ruiz, Ana', 8, 'seguro'],
    ]);
    const sin = pega(['Ruiz Ana', 'Ruiz Gil Ana', 'Sanz Pablo'], 'Ruiz Gil, Ana\t4\nRuiz, Ana\t6\nSanz, Pablo\t8');
    expect([sin.notaDe('Ruiz Gil Ana'), sin.notaDe('Ruiz Ana'), sin.notaDe('Sanz Pablo')]).toEqual([4, 6, 8]);
    // Con la app así y un nombre que también es apellido, nada sale seguro para quien no es
    const dudosa = pega(['Ruiz Gil Martín', 'Martín Ruiz Lucía', 'Sanz Pablo'], 'Martín Ruiz\t4\nPablo Sanz\t6');
    expect(dudosa.recibe['Martín Ruiz Lucía']?.parecido).not.toBe('seguro');
  });
});

describe('segunda vuelta: iniciales del segundo apellido o del nombre', () => {
  it('la inicial del segundo apellido es una inicial, no una partícula', () => {
    const r = pega(['Pablo García D.', 'Pablo García R.', 'Ana López Gil'], 'García Ruiz, Pablo\t8\nLópez Gil, Ana\t5');
    expect(r.notaDe('Pablo García D.')).toBeNull();
    expect(r.recibe['Pablo García R.']).toEqual({ nota: 8, parecido: 'aproximado' });
    const l = pega(['Pablo García L.', 'Pablo García M.', 'Ana López Gil'], 'García Martín, Pablo\t8\nLópez Gil, Ana\t5');
    expect(l.notaDe('Pablo García L.')).toBeNull();
    expect(l.notaDe('Pablo García M.')).toBe(8);
  });

  it('«García D.» va a García Díaz y «García L.» a García López', () => {
    const r = pega(['Pablo García Díaz', 'Pablo García López', 'Ana Ruiz Gil'], 'García D., Pablo\t9\nGarcía L., Pablo\t5\nRuiz G., Ana\t7');
    expect([r.notaDe('Pablo García Díaz'), r.notaDe('Pablo García López'), r.notaDe('Ana Ruiz Gil')]).toEqual([9, 5, 7]);
    const corto = pega(['Pablo García', 'Pablo García Díaz', 'Ana Ruiz Gil'], 'García L., Pablo\t5\nGarcía D., Pablo\t9\nRuiz Gil, Ana\t7');
    expect(corto.notaDe('Pablo García Díaz')).toBe(9);
  });

  it('el homónimo guardado con la inicial que pide la app no pierde su nota', () => {
    const r = pega(['Daniel Ruiz', 'Daniel Ruiz S.', 'Ana Gil'], 'Ruiz Sanz, Daniel\t9\nGil, Ana\t6');
    expect(r.recibe['Daniel Ruiz']?.parecido).not.toBe('seguro');
    const lucia = pega(['Lucía Pérez', 'Lucía Pérez N.', 'Hugo Sanz Mora', 'Ana Ruiz Gil'], 'Pérez Navarro, Lucía\t6\nSanz Mora, Hugo\t5');
    expect(lucia.recibe['Lucía Pérez']?.parecido).not.toBe('seguro');
    const errata = pega(['Lucía Pérez', 'Lucía Pérez Navarro', 'Hugo Sanz Mora'], 'Pérez Navaro, Lucía\t6\nSanz Mora, Hugo\t5');
    expect(errata.recibe['Lucía Pérez']?.parecido).not.toBe('seguro');
  });

  it('una inicial del nombre («L.», «I.», «E.») no se descarta', () => {
    expect(pega(['Lucía Martín Gil', 'Martín Gil Sanz', 'Hugo Sanz Mora'], 'Martín Gil, L.\t4\nSanz Mora, H.\t6').notaDe('Martín Gil Sanz')).toBeNull();
    const isabel = pega(['Ana Gil Ruiz', 'Ana Isabel Gil Martín', 'Pablo Sanz'], 'Ana I. Gil\t4\nPablo Sanz\t6');
    expect(isabel.notaDe('Ana Gil Ruiz')).toBeNull();
    expect(isabel.notaDe('Ana Isabel Gil Martín')).toBe(4);
    expect(pega(['José García Pérez', 'José Luis García Martín', 'Ana Ruiz'], 'García, José L.\t3\nRuiz, Ana\t7').notaDe('José García Pérez')).toBeNull();
  });

  it('«Lucía P.» y «Lucía G.»: la inicial guardada es la del primer apellido', () => {
    const r = pega(['Lucía P.', 'Lucía G.', 'Hugo S.'], 'Pérez García, Lucía\t4\nGarcía Pérez, Lucía\t8\nSanz Mora, Hugo\t6');
    expect([r.notaDe('Lucía P.'), r.notaDe('Lucía G.'), r.notaDe('Hugo S.')]).toEqual([4, 8, 6]);
  });

  it('«Álex» es Alejandro, y lo que va entre paréntesis no es el nombre', () => {
    const alex = pega(['Alejandro García Ruiz', 'Ana Gil'], 'García Ruiz, Álex\t4\nGil, Ana\t6');
    expect(alex.recibe['Alejandro García Ruiz']).toEqual({ nota: 4, parecido: 'aproximado' });
    expect(alex.plan.pareceOtroGrupo).toBe(false);
    const notas = pega(['Lucía Pérez Navarro', 'Hugo Sanz Mora', 'Ana Ruiz Gil'], 'Lucía Pérez (rep.)\t7\nHugo Sanz\t4\nAna Ruiz (ACIS)\t9');
    expect([notas.notaDe('Lucía Pérez Navarro'), notas.notaDe('Hugo Sanz Mora'), notas.notaDe('Ana Ruiz Gil')]).toEqual([7, 4, 9]);
    expect(notas.plan.pareceOtroGrupo).toBe(false);
  });
});

describe('segunda vuelta: columnas de datos junto al nombre', () => {
  const alumnoN = (...ns: number[]) => ns.map(n => `Alumno ${n}`);

  it('la fecha de nacimiento no hace de cifra del nombre', () => {
    const r = pega(alumnoN(1, 2, 3, 4, 5), 'Alumno\tF. Nac.\tNota\nAlumno 7\t03/11/2013\t9\nAlumno 5\t17/06/2013\t4');
    expect(r.notaDe('Alumno 3')).toBeNull();
    expect(r.notaDe('Alumno 5')).toBe(4);
    expect(r.sinColocar).toEqual(['Alumno 7']);
    // Una sola fila que no es de nadie: se colocaría por posición, marcada con ≠, y la pantalla pide confirmarlo
    const una = pega(alumnoN(1, 2, 3, 4, 5), 'Alumno 7\t03/11/2013\t9');
    expect(una.plan.modo).toBe('posicion');
    expect(una.plan.descuadradas).toBe(1);
  });

  it('ni la fecha en catalán, ni el teléfono, ni el grupo, ni la edad deciden entre «3 Marta» y «12 Marta»', () => {
    const fecha = pega(['3 Marta', '12 Marta', '5 Pedro'], 'Cognoms, Nom\tData naix.\tNota\nGarcía Ruiz, Marta\t03/11/2013\t7\nLópez Gil, Marta\t21/09/2013\t4\nSoler, Pedro\t14/02/2013\t6');
    expect([fecha.notaDe('3 Marta'), fecha.notaDe('12 Marta'), fecha.notaDe('5 Pedro')]).toEqual([null, null, 6]);
    const tel = pega(['3 Marta', '12 Marta', '5 Pedro'], 'Alumno\tTelèfon\tNota\nGarcía Ruiz, Marta\t600 12 34 03\t7\nLópez Gil, Marta\t611 22 33 12\t4');
    expect([tel.notaDe('3 Marta'), tel.notaDe('12 Marta')]).toEqual([null, null]);
    const grupo = pega(['3 Marta', '12 Marta', '5 Pau'], 'García Ruiz, Marta\t3ºA\t7\nGil, Pau\t3ºB\t6');
    expect([grupo.notaDe('3 Marta'), grupo.notaDe('12 Marta'), grupo.notaDe('5 Pau')]).toEqual([null, null, 6]);
    const edad = pega(['12 Marta', '13 Marta', '14 Pedro'], 'Marta García\t13\t7\nMarta López\t12\t4\nPedro Ruiz\t13\t6');
    expect([edad.notaDe('12 Marta'), edad.notaDe('13 Marta'), edad.notaDe('14 Pedro')]).toEqual([null, null, 6]);
  });

  it('con la edad al lado, cada «Alumno N» va a su sitio', () => {
    const r = pega(alumnoN(1, 2, 3, 4, 12, 13), 'Alumno 1\t12\t7\nAlumno 2\t13\t5\nAlumno 3\t12\t8\nAlumno 4\t12\t6\nAlumno 12\t13\t9\nAlumno 13\t12\t4');
    expect(alumnoN(1, 2, 3, 4, 12, 13).map(n => r.notaDe(n))).toEqual([7, 5, 8, 6, 9, 4]);
  });

  it('una fila de media o de total no es de nadie, aunque lleve una cifra', () => {
    const r = pega(['1', '2', '3', '4'], 'Alumno\tNota\nAlumno 1\t6\nAlumno 2\t7\nAlumno 3\t8\nAlumno 4\t5\nMedia 2ª ev.\t6,5');
    expect(['1', '2', '3', '4'].map(n => r.notaDe(n))).toEqual([6, 7, 8, 5]);
    expect(r.sinColocar).toEqual(['Media 2ª ev.']);
  });

  it('el correo de la familia no cuenta para el nombre', () => {
    const r = pega(['Jordi Puig Soler', 'Joan Puig Soler', 'Ana Ruiz'], 'Cognoms\tNom\tCorreu\tNota\nPuig Soler\tJordi\tjoan.puig@gmail.com\t7\nRuiz\tAna\tana.ruiz@xtec.cat\t5');
    expect(r.recibe['Jordi Puig Soler']).toEqual({ nota: 7, parecido: 'seguro' });
    expect(r.notaDe('Joan Puig Soler')).toBeNull();
  });
});
