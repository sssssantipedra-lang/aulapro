import { describe, it, expect } from 'vitest';
import {
  MAX_COLUMNAS_TABLA, MAX_FILAS_TABLA, MAX_VINETAS, bloqueVacio, cambiarTipo, conColumnaDeTabla, conFilaDeTabla, conVineta,
  dificultadDelSiguiente, duplicarEjercicio, ejercicioSinEscribir, ejercicioVacio, enumerar, fichaEnBlanco, lineasDe, loQuePierde, PIERDE, sinColumnaDeTabla, sinFilaDeTabla, sinVineta,
} from './fichaEnBlanco';
import { TIPOS, prepareExercise, type FichaExercise } from '../services/resources';
import { buildFichaHtml } from '../services/exportFicha';
import { HILOS } from './hilos';
import { fichaTheme } from './fichaThemes';
import type { Ficha } from '../types';
import { CA, EN } from '../i18n/tanda/fichasSinIA';

const comoFicha = (content: Ficha['content']): Ficha => ({
  id: 'f1', at: '2026-11-20T10:00:00.000Z', date: '2026-11-20', title: 'Prueba',
  request: { tema: '', area: '', nivel: '', numEjercicios: 0, niveles: false, contextoClase: '' }, content,
});

describe('ficha en blanco', () => {
  it('una ficha de ejercicios nace con los tres bloques de la escalera, de menos a más y sin ejercicios', () => {
    const c = fichaEnBlanco('ficha');
    expect(c.estilo).toBe('cuaderno');
    expect(c.formato).toBe('ficha');
    expect(c.actividades.map(a => a.dificultad)).toEqual([1, 2, 3]);
    expect(c.actividades.every(a => a.ejercicios.length === 0)).toBe(true);
    expect(c.hilo).toBeUndefined();
  });

  it('respeta el título, el aspecto elegido y el hilo (solo en «Cuaderno»)', () => {
    expect(fichaEnBlanco('ficha', { titulo: '  Las plantas ', hilo: 'granja' })).toMatchObject({ titulo: 'Las plantas', hilo: 'granja' });
    const clasica = fichaEnBlanco('ficha', { estilo: 'clasico', hilo: 'granja' });
    expect(clasica.estilo).toBe('clasico');
    expect(clasica.hilo).toBeUndefined();
    expect(fichaEnBlanco('ficha', { estilo: 'auto' }).estilo).toBe('cuaderno');
  });

  it('un aspecto con historia trae su historia por escribir', () => {
    const conHistoria = fichaEnBlanco('ficha', { estilo: 'espacio' });
    expect(fichaTheme(conHistoria.estilo).historia).toBe(true);
    expect(conHistoria.historia).toMatchObject({ personaje: '', mision: '', cierre: '', insignia: '' });
    expect(conHistoria.historia?.emoji).toBeTruthy();
  });

  it('un escape room son tres salas con candado y un mundo con historia, aunque el aspecto elegido no la tenga', () => {
    const c = fichaEnBlanco('escape', { estilo: 'cuaderno' });
    expect(c.formato).toBe('escape');
    expect(fichaTheme(c.estilo).historia).toBe(true);
    expect(c.historia).toBeDefined();
    expect(c.actividades).toHaveLength(3);
    expect(c.actividades.every(a => a.candado && a.candado.codigo === '')).toBe(true);
  });

  it('la comprensión lectora trae un texto con un párrafo por escribir', () => {
    const c = fichaEnBlanco('lectura', { generoLectura: 'poema' });
    expect(c.lectura).toEqual({ genero: 'poema', parrafos: [''], dibujos: [] });
    expect(fichaEnBlanco('lectura', { generoLectura: 'auto' }).lectura?.genero).toBe('cuento');
    expect(c.actividades).toHaveLength(3);
  });

  it('las tarjetas son un mazo con una tarjeta por rellenar, recortable o interactiva', () => {
    const r = fichaEnBlanco('tarjetas');
    expect(r).toMatchObject({ formato: 'tarjetas', tarjetas: [{ pregunta: '', respuesta: '' }], actividades: [] });
    expect(r.interactivas).toBeUndefined();
    const i = fichaEnBlanco('interactivas');
    expect(i.interactivas).toBe(true);
    expect(i.tarjetasInteractivas).toHaveLength(1);
  });

  it('el bloque que se añade al final sigue la escalera', () => {
    expect(dificultadDelSiguiente([])).toBe(1);
    expect(dificultadDelSiguiente([{ dificultad: 1 }])).toBe(2);
    expect(dificultadDelSiguiente([{ dificultad: 2 }, { dificultad: 3 }])).toBe(3);
    expect(dificultadDelSiguiente([{}])).toBeUndefined();
    expect(bloqueVacio(2)).toEqual({ titulo: '', dificultad: 2, ejercicios: [] });
    expect(bloqueVacio()).toEqual({ titulo: '', ejercicios: [] });
  });
});

describe('ejercicio vacío', () => {
  const hilo = HILOS.find(h => h.id === 'granja') ?? HILOS[0];

  it('cada tipo nace con su tipo, con enunciado y solución de texto, y sobrevive a prepareExercise', () => {
    for (const tipo of TIPOS) {
      const ex = prepareExercise(ejercicioVacio(tipo, { hilo }));
      expect(ex.tipo, tipo).toBe(tipo);
      expect(typeof ex.enunciado, tipo).toBe('string');
      expect(typeof ex.solucion, tipo).toBe('string');
    }
  });

  it('cada tipo vacío se pinta en la hoja «Cuaderno» y en la clásica sin romperse ni dejar «undefined»', () => {
    for (const estilo of ['cuaderno', 'clasico'] as const) {
      for (const tipo of TIPOS) {
        const c = fichaEnBlanco('ficha', { estilo, hilo: hilo.id });
        c.actividades[0].ejercicios = [prepareExercise(ejercicioVacio(tipo, { hilo }))];
        const html = buildFichaHtml(comoFicha(c), 'es', { preview: true });
        expect(html, `${estilo}/${tipo}`).toContain('data-ex="0-0"');
        expect(html, `${estilo}/${tipo}`).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it('la tabla nace con filas y columnas, y el cómic con tres bocadillos vacíos', () => {
    const tabla = ejercicioVacio('tabla_rellenar');
    expect(tabla.columnas).toHaveLength(3);
    expect(tabla.filas).toHaveLength(3);
    expect(tabla.filas!.every(f => f.length === 3)).toBe(true);
    const comic = ejercicioVacio('comic');
    expect(comic.vinetas).toHaveLength(3);
    expect(comic.vinetas!.every(v => v.texto === '' && v.personaje)).toBe(true);
  });

  it('las fracciones nacen con sus pizzas y su solución calculada', () => {
    const ex = ejercicioVacio('fracciones', { lang: 'es' });
    expect(ex.fracciones!.length).toBeGreaterThanOrEqual(3);
    expect(ex.solucion).toMatch(/A: \d+\/\d+/);
    expect(ex.enunciado).not.toBe('');
  });

  it('con hilo, «contar» y «etiquetar» nacen con dibujos del hilo; sin hilo, vacíos', () => {
    const contar = ejercicioVacio('contar', { hilo });
    expect(contar.dibujos?.length).toBeGreaterThanOrEqual(2);
    expect(contar.solucion).not.toBe('');
    expect(ejercicioVacio('contar').dibujos).toBeUndefined();
    expect(ejercicioVacio('clasificar').categorias).toHaveLength(2);
  });
});

describe('cambiar de tipo', () => {
  const vf: FichaExercise = { tipo: 'verdadero_falso', enunciado: 'Marca V o F.', afirmaciones: ['El sol es una estrella', ' ', 'La luna es un planeta'], solucion: '1 V; 2 F', apoyo: 'Con ayuda' };

  it('conserva el enunciado, la solución y las variantes, y pasa las líneas al tipo nuevo', () => {
    const om = cambiarTipo(vf, 'opcion_multiple');
    expect(om).toMatchObject({ tipo: 'opcion_multiple', enunciado: 'Marca V o F.', solucion: '1 V; 2 F', apoyo: 'Con ayuda' });
    expect(om.opciones).toEqual(['El sol es una estrella', 'La luna es un planeta']);
    expect(om.afirmaciones).toBeUndefined();
  });

  it('al mismo tipo devuelve el mismo ejercicio', () => {
    expect(cambiarTipo(vf, 'verdadero_falso')).toBe(vf);
  });

  it('a «ordenar» deja las líneas como orden correcto y, tras prepararlo, salen barajadas', () => {
    const ord = prepareExercise(cambiarTipo(vf, 'ordenar'));
    expect(ord.ordenCorrecto).toEqual(['El sol es una estrella', 'La luna es un planeta']);
    expect([...ord.elementos!].sort()).toEqual([...ord.ordenCorrecto!].sort());
    expect(ord.elementos).not.toEqual(ord.ordenCorrecto);
  });

  it('de una lista de palabras sale una sopa con su rejilla, y de la sopa un crucigrama con las mismas palabras', () => {
    const lista: FichaExercise = { tipo: 'opcion_multiple', enunciado: 'Elige.', opciones: ['raíz', 'tallo', 'hoja', 'flor'], solucion: '' };
    const sopa = prepareExercise(cambiarTipo(lista, 'sopa_letras'));
    expect(sopa.palabras).toEqual(['RAÍZ', 'TALLO', 'HOJA', 'FLOR']);
    expect(sopa.rejilla!.length).toBeGreaterThanOrEqual(10);
    const cruci = cambiarTipo(sopa, 'crucigrama');
    expect(cruci.pistas).toEqual(['RAÍZ', 'TALLO', 'HOJA', 'FLOR'].map(palabra => ({ palabra, pista: '' })));
    expect(cruci.rejilla).toBeUndefined();
    expect(cruci.posiciones).toBeUndefined();
  });

  it('«ordenar» pasa su orden correcto, no el barajado', () => {
    const ord: FichaExercise = { tipo: 'ordenar', enunciado: '', elementos: ['c', 'a', 'b'], ordenCorrecto: ['a', 'b', 'c'], solucion: '' };
    expect(lineasDe(ord)).toEqual(['a', 'b', 'c']);
    expect(cambiarTipo(ord, 'contestar').preguntas).toEqual(['a', 'b', 'c']);
  });

  it('a un tipo sin lista (problema, abierta) se queda con el enunciado y la solución', () => {
    const p = cambiarTipo(vf, 'problema');
    expect(p).toEqual({ tipo: 'problema', enunciado: 'Marca V o F.', solucion: '1 V; 2 F', apoyo: 'Con ayuda' });
  });

  it('a «fracciones» manda el enunciado y la solución calculados', () => {
    const fr = cambiarTipo(vf, 'fracciones', { lang: 'es' });
    expect(fr.enunciado).toMatch(/pizza/);
    expect(fr.solucion).toMatch(/A: /);
    expect(fr.fracciones!.length).toBeGreaterThanOrEqual(3);
  });

  it('la figura, los pictogramas, el dibujo suelto y la pizza del enunciado acompañan al ejercicio al tipo nuevo', () => {
    const problema: FichaExercise = {
      tipo: 'problema', enunciado: 'Calcula el área.', solucion: '12 cm²',
      figura: { forma: 'rectangulo', medidas: [{ etiqueta: 'base', valor: '4 cm' }, { etiqueta: 'altura', valor: '3 cm' }] },
      imagenes: [{ picto: 'apple', cantidad: 3 }], dibujos: [{ ilustracion: 'vaca', cantidad: 1 }],
      fracciones: [{ partes: 4, tomadas: 1 }], cogidos: 'bn',
    };
    const abierta = cambiarTipo(problema, 'abierta');
    expect(abierta.figura).toBe(problema.figura);
    expect(abierta.imagenes).toBe(problema.imagenes);
    expect(abierta.dibujos).toBe(problema.dibujos);
    expect(abierta.fracciones).toBe(problema.fracciones);
    expect(abierta.cogidos).toBe('bn');
    expect(loQuePierde(problema, abierta)).toEqual([]);
    // A un verdadero o falso la pizza no pasa (no tiene dónde pintarse) y se avisa; la figura y el dibujo, sí
    const vof = cambiarTipo(problema, 'verdadero_falso');
    expect(vof.figura).toBe(problema.figura);
    expect(vof.dibujos).toBe(problema.dibujos);
    expect(vof.fracciones).toBeUndefined();
    expect(loQuePierde(problema, vof)).toEqual([PIERDE.pizzas]);
    // A una tabla, los dibujos irían uno por fila: no valen y se avisa
    expect(loQuePierde(problema, cambiarTipo(problema, 'tabla_rellenar'))).toEqual([PIERDE.pizzas, PIERDE.dibujos]);
  });

  it('entre tipos de lista no se pierde nada, y a un tipo sin lista se avisa de las líneas', () => {
    expect(loQuePierde(vf, prepareExercise(cambiarTipo(vf, 'opcion_multiple')))).toEqual([]);
    expect(loQuePierde(vf, prepareExercise(cambiarTipo(vf, 'ordenar')))).toEqual([]);
    expect(loQuePierde(vf, prepareExercise(cambiarTipo(vf, 'crucigrama')))).toEqual([]);
    expect(loQuePierde(vf, vf)).toEqual([]);
    // Con las flechas del teclado, de «Verdadero o falso» a «Cómic» se pasa sin querer: antes se llevaba las frases sin avisar
    for (const tipo of ['comic', 'tabla_rellenar', 'abierta', 'problema', 'completar'] as const) {
      expect(loQuePierde(vf, prepareExercise(cambiarTipo(vf, tipo)))).toEqual([PIERDE.lineas]);
    }
    expect(loQuePierde({ ...vf, afirmaciones: [] }, cambiarTipo({ ...vf, afirmaciones: [] }, 'comic'))).toEqual([]);
  });

  it('una frase que no cabe en la sopa de letras se pierde y se avisa; las mayúsculas de la sopa no cuentan', () => {
    const cortas: FichaExercise = { tipo: 'opcion_multiple', enunciado: '', opciones: ['raíz', 'tallo', 'hoja'], solucion: '' };
    expect(loQuePierde(cortas, prepareExercise(cambiarTipo(cortas, 'sopa_letras')))).toEqual([]);
    const largas: FichaExercise = { tipo: 'verdadero_falso', enunciado: '', afirmaciones: ['sol', 'luna', 'Los planetas giran alrededor de una estrella'], solucion: '' };
    const sopa = prepareExercise(cambiarTipo(largas, 'sopa_letras'));
    expect(sopa.palabras).toEqual(['SOL', 'LUNA']);
    expect(loQuePierde(largas, sopa)).toEqual([PIERDE.lineas]);
  });

  it('las pizzas y los dibujos del hilo sustituyen al enunciado y a la solución escritos, y se avisa', () => {
    const escrito: FichaExercise = { tipo: 'abierta', enunciado: 'Explica con tus palabras qué es una fracción.', solucion: 'Una parte de un todo.' };
    const fr = cambiarTipo(escrito, 'fracciones', { lang: 'es' });
    expect(fr.enunciado).not.toBe(escrito.enunciado);
    expect(loQuePierde(escrito, fr)).toEqual([PIERDE.enunciado, PIERDE.solucion]);
    // Sin nada escrito no hay nada que avisar
    expect(loQuePierde(ejercicioVacio('abierta'), cambiarTipo(ejercicioVacio('abierta'), 'fracciones', { lang: 'es' }))).toEqual([]);
  });

  it('avisa de lo propio de cada tipo: la tabla, los bocadillos, la columna derecha, las pistas, la leyenda, las pizzas, los dibujos y el recuadro', () => {
    const pierde = (ex: FichaExercise, tipo: FichaExercise['tipo'] = 'abierta') => loQuePierde(ex, prepareExercise(cambiarTipo(ex, tipo)));
    expect(pierde(ejercicioVacio('tabla_rellenar'))).toEqual([]);
    expect(pierde({ ...ejercicioVacio('tabla_rellenar'), columnas: ['Base', '', ''] })).toEqual([PIERDE.tabla]);
    expect(pierde(ejercicioVacio('comic'))).toEqual([]);
    expect(pierde({ tipo: 'comic', enunciado: '', solucion: '', vinetas: [{ personaje: '🙂', texto: 'Hola' }] })).toEqual([PIERDE.bocadillos]);
    expect(pierde({ tipo: 'relacionar', enunciado: '', solucion: '', izquierda: ['a'], derecha: ['1'] }, 'verdadero_falso')).toEqual([PIERDE.derecha]);
    expect(pierde({ tipo: 'crucigrama', enunciado: '', solucion: '', pistas: [{ palabra: 'sol', pista: 'estrella' }] }, 'sopa_letras')).toEqual([PIERDE.pistas]);
    expect(pierde({ tipo: 'colorear', enunciado: '', solucion: '', leyenda: [{ color: 'rojo', criterio: 'par' }], itemsColorear: ['2 + 2'] }, 'calculos')).toEqual([PIERDE.leyenda]);
    expect(pierde(ejercicioVacio('fracciones'))).toEqual([PIERDE.pizzas]);
    expect(pierde({ tipo: 'contar', enunciado: '', solucion: '', dibujos: [{ ilustracion: 'vaca', cantidad: 3 }] })).toEqual([PIERDE.dibujos]);
    expect(pierde({ tipo: 'clasificar', enunciado: '', solucion: '', categorias: [{ nombre: 'Aves', dibujos: [] }, { nombre: '', dibujos: [] }] })).toEqual([PIERDE.dibujos]);
    expect(pierde({ tipo: 'completar', enunciado: 'La __ da leche.', solucion: '', bancoPalabras: ['vaca', 'oveja'] })).toEqual([PIERDE.recuadro]);
  });

  it('cada cosa que se puede perder tiene su nombre en inglés y en catalán', () => {
    for (const k of Object.values(PIERDE)) {
      expect(EN[k], k).toBeTruthy();
      expect(CA[k], k).toBeTruthy();
    }
    expect(enumerar([], 'y')).toBe('');
    expect(enumerar(['la tabla'], 'y')).toBe('la tabla');
    expect(enumerar(['la tabla', 'las pistas'], 'y')).toBe('la tabla y las pistas');
    expect(enumerar(['el enunciado', 'la tabla', 'las pistas'], 'y')).toBe('el enunciado, la tabla y las pistas');
  });
});

describe('duplicar, tablas y cómics', () => {
  it('la copia es igual y no comparte nada con el original', () => {
    const ex = prepareExercise({ tipo: 'sopa_letras', enunciado: 'Busca.', palabras: ['sol', 'luna', 'mar'], solucion: '' });
    const copia = duplicarEjercicio(ex);
    expect(copia).toEqual(ex);
    copia.rejilla![0][0] = '#';
    copia.palabras!.push('X');
    expect(ex.rejilla![0][0]).not.toBe('#');
    expect(ex.palabras).toHaveLength(3);
  });

  it('se añaden y se quitan filas y columnas sin descuadrar la tabla, con topes', () => {
    let t = ejercicioVacio('tabla_rellenar');
    t = conFilaDeTabla(conColumnaDeTabla(t));
    expect(t.columnas).toHaveLength(4);
    expect(t.filas).toHaveLength(4);
    expect(t.filas!.every(f => f.length === 4)).toBe(true);
    t = sinFilaDeTabla(sinColumnaDeTabla(t));
    expect(t.columnas).toHaveLength(3);
    expect(t.filas!.every(f => f.length === 3)).toBe(true);
    for (let i = 0; i < 30; i++) t = conFilaDeTabla(conColumnaDeTabla(t));
    expect(t.filas).toHaveLength(MAX_FILAS_TABLA);
    expect(t.columnas).toHaveLength(MAX_COLUMNAS_TABLA);
    for (let i = 0; i < 30; i++) t = sinFilaDeTabla(sinColumnaDeTabla(t));
    expect(t.filas).toHaveLength(1);
    expect(t.columnas).toHaveLength(2);
  });

  it('al quitar una fila se va también su dibujo', () => {
    const t: FichaExercise = { ...ejercicioVacio('tabla_rellenar'), dibujos: [{ ilustracion: 'a' }, { ilustracion: 'b' }, { ilustracion: 'c' }] };
    expect(sinFilaDeTabla(t).dibujos).toHaveLength(2);
  });

  it('un cómic tiene entre dos y cuatro viñetas', () => {
    let c = ejercicioVacio('comic');
    c = conVineta(conVineta(conVineta(c)));
    expect(c.vinetas).toHaveLength(MAX_VINETAS);
    c = sinVineta(sinVineta(sinVineta(sinVineta(c, 0), 0), 0), 0);
    expect(c.vinetas).toHaveLength(2);
  });
});

describe('ejercicios sin escribir', () => {
  it('un ejercicio recién añadido sin enunciado ni contenido está sin escribir; con algo propio, no', () => {
    for (const tipo of ['abierta', 'problema', 'completar', 'opcion_multiple', 'relacionar', 'colorear', 'sopa_letras', 'verdadero_falso', 'ordenar', 'crucigrama', 'calculos', 'clasificar', 'contestar', 'en_texto', 'dibujar'] as const) {
      expect(ejercicioSinEscribir(ejercicioVacio(tipo)), tipo).toBe(true);
    }
    // La cuadrícula de una tabla, los bocadillos de un cómic y las pizzas ya son el ejercicio
    for (const tipo of ['tabla_rellenar', 'comic', 'fracciones'] as const) expect(ejercicioSinEscribir(ejercicioVacio(tipo)), tipo).toBe(false);
    expect(ejercicioSinEscribir({ ...ejercicioVacio('abierta'), enunciado: ' ¿Qué come la vaca? ' })).toBe(false);
    expect(ejercicioSinEscribir({ ...ejercicioVacio('calculos'), lineas: ['2 + 2'] })).toBe(false);
    expect(ejercicioSinEscribir({ ...ejercicioVacio('relacionar'), derecha: ['a'] })).toBe(false);
    expect(ejercicioSinEscribir({ ...ejercicioVacio('contar'), dibujos: [{ ilustracion: 'gra-vaca', cantidad: 3 }] })).toBe(false);
  });

  it('en la hoja no se pinta ni gasta número: el siguiente es el 1, y con uno solo escrito no hay numeración', () => {
    const c = fichaEnBlanco('ficha');
    c.actividades[0].ejercicios = [ejercicioVacio('abierta'), { ...ejercicioVacio('abierta'), enunciado: 'Escribe tu nombre.' }];
    const html = buildFichaHtml(comoFicha(c), 'es', { preview: true });
    expect(html).toMatch(/<li data-ex="0-0" class="vacio">/);
    expect(html).toMatch(/<li data-ex="0-1">/);
    expect(html).toContain('ficha-ejercicios sin');
    expect(html).toContain('li.vacio { display: none; }');
  });

  it('el solucionario salta los que están sin escribir y numera como la hoja', () => {
    const c = fichaEnBlanco('ficha');
    c.solucionario = true;
    c.actividades[0].ejercicios = [
      ejercicioVacio('abierta'),
      { ...ejercicioVacio('abierta'), enunciado: '¿Cuánto es 2 + 2?', solucion: 'Cuatro' },
      { ...ejercicioVacio('abierta'), enunciado: '¿Y 3 + 3?', solucion: 'Seis' },
    ];
    const html = buildFichaHtml(comoFicha(c), 'es');
    const sol = html.slice(html.indexOf('<section class="ficha-solucionario"'));
    expect(sol).toContain('<b class="sol-n">1.</b><div class="sol-cuerpo"><div class="sol-txt">Cuatro</div>');
    expect(sol).toContain('<b class="sol-n">2.</b><div class="sol-cuerpo"><div class="sol-txt">Seis</div>');
    expect(sol).not.toContain('sol-n">3.');
    // Sin pedirlo, o para medir la hoja del alumnado, no sale
    expect(buildFichaHtml(comoFicha(c), 'es', { solucionario: false })).not.toContain('<section class="ficha-solucionario"');
    expect(buildFichaHtml(comoFicha({ ...c, solucionario: undefined }), 'es')).not.toContain('ficha-solucionario');
  });

  it('el solucionario pinta la sopa con sus palabras marcadas y el crucigrama resuelto', () => {
    const c = fichaEnBlanco('ficha');
    c.solucionario = true;
    c.actividades[0].ejercicios = [
      prepareExercise({ tipo: 'sopa_letras', enunciado: 'Busca.', palabras: ['sol', 'luna'], solucion: '' }),
      prepareExercise({ tipo: 'crucigrama', enunciado: 'Completa.', pistas: [{ palabra: 'sol', pista: 'Estrella' }, { palabra: 'luna', pista: 'Satélite' }], solucion: '' }),
    ];
    const html = buildFichaHtml(comoFicha(c), 'es');
    const sol = html.slice(html.indexOf('<section class="ficha-solucionario"'));
    // Siete casillas, o seis si las dos palabras se cruzan en la L
    const marcadas = (sol.match(/<span class="on">/g) ?? []).length;
    expect(marcadas === 7 || marcadas === 6).toBe(true);
    expect(sol).toContain('sol-cruci');
    expect((sol.match(/<span class="cw-cell">/g) ?? []).length).toBe(6);
  });
});
