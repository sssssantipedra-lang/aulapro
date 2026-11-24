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
  it('«Ma José» no lleva la nota a su hermano José: con los dos posibles, se elige a mano', () => {
    const r = pega(['María José Sanz Gil', 'José Sanz Gil', 'Ana Ruiz'], 'Sanz Gil, Ma José\t4\nRuiz, Ana\t7');
    expect(r.notaDe('José Sanz Gil')).toBeNull();
    expect(r.plan.sinColocar.map(f => [f.etiqueta, f.motivo])).toEqual([['Sanz Gil, Ma José', 'varios']]);
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
