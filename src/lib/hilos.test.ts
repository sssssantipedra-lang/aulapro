import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { HILOS, detectarHilos, dibujosDeHilo, dibujosSinHilo, esContable, hiloDeFicha, hiloPorId, hilosDeDibujo, listaDibujosParaIA } from './hilos';
import { ILUSTRACIONES } from './ilustraciones';

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

describe('hilos conductores: la clasificación', () => {
  it('cada hilo tiene identificador único, nombre en los tres idiomas y dibujos que existen', () => {
    const ids = HILOS.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
    const catalogo = new Set(ILUSTRACIONES.map(i => i.id));
    for (const h of HILOS) {
      for (const lang of ['es', 'ca', 'en'] as const) expect(h.nombre[lang].trim(), `${h.id} sin nombre en ${lang}`).not.toBe('');
      expect(h.dibujos.length, `${h.id}: muy pocos dibujos`).toBeGreaterThanOrEqual(5);
      expect(new Set(h.dibujos).size, `${h.id}: dibujos repetidos`).toBe(h.dibujos.length);
      for (const d of h.dibujos) expect(catalogo.has(d), `${h.id}: «${d}» no está en el catálogo`).toBe(true);
      expect(h.temas.length, `${h.id} sin palabras`).toBeGreaterThan(0);
      expect(h.areas.length, `${h.id} sin áreas`).toBeGreaterThan(0);
    }
  });

  it('las palabras de cada hilo van en minúscula y sin tildes', () => {
    for (const h of HILOS) for (const t of h.temas) expect(t, `${h.id}: «${t}»`).toBe(plano(t));
  });

  it('todos los dibujos del catálogo están en algún hilo', () => {
    expect(dibujosSinHilo()).toEqual([]);
  });

  it('un dibujo puede estar en varios hilos, y se encuentran desde el dibujo', () => {
    expect(hilosDeDibujo('mat-pizza').map(h => h.id)).toEqual(expect.arrayContaining(['fracciones-reparto']));
    expect(hilosDeDibujo('ani-vaca').map(h => h.id)).toEqual(expect.arrayContaining(['granja', 'animales']));
    expect(dibujosDeHilo(hiloPorId('granja')!).map(i => i.id)[0]).toBe('ani-vaca');
  });

  it('solo se repiten para contar los objetos sueltos', () => {
    for (const id of ['ani-vaca', 'com-manzana', 'jue-pelota', 'mat-dados', 'mat-monedas', 'nat-flor']) expect(esContable(id), id).toBe(true);
    for (const id of ['cue-corazon', 'lug-granja', 'pro-medico', 'his-castillo', 'com-agua', 'mat-grafico-barras', 'val-familia']) expect(esContable(id), id).toBe(false);
  });

  it('la lista para la IA marca los dibujos que no se pueden repetir', () => {
    const lista = listaDibujosParaIA(hiloPorId('granja')!, 'es');
    expect(lista).toContain('ani-vaca (');
    expect(lista).toContain('lug-granja [solo 1] (');
    expect(listaDibujosParaIA(hiloPorId('granja')!, 'en')).toContain('(');
  });
});

describe('hilos conductores: de qué trata una ficha', () => {
  const hilo = (tema: string, area: string, nivel = '3º Primaria') => hiloDeFicha({ tema, area, nivel }).id;

  it('reconoce el hilo por el tema', () => {
    expect(hilo('Las fracciones', 'Matemáticas')).toBe('fracciones-reparto');
    expect(hilo('El sistema solar', 'Ciencias Naturales')).toBe('espacio');
    expect(hilo('La Edad Media', 'Ciencias Sociales', '1º ESO')).toBe('edad-media');
    expect(hilo('Las emociones', 'Valores')).toBe('valores-emociones');
    expect(hilo('La higiene y la salud', 'Educación Física')).toBe('salud-higiene');
    expect(hilo('El ciclo del agua', 'Ciencias Naturales')).toBe('agua');
    expect(hilo('Los sentidos', 'Ciencias Naturales')).toBe('sentidos');
    expect(hilo('El reciclaje', 'Ciencias Naturales')).toBe('medio-ambiente');
    expect(hilo('La Revolución Industrial', 'Geografía e Historia', '4º ESO')).toBe('industria');
    expect(hilo('Unidades de medida de longitud', 'Matemáticas')).toBe('medida');
    expect(hilo('Perímetro de figuras planas', 'Matemáticas')).toBe('geometria');
  });

  it('el hilo concreto gana al general («los animales de la granja» es la granja)', () => {
    expect(hilo('Los animales de la granja', 'Ciencias Naturales', '2º Primaria')).toBe('granja');
    expect(hilo('Los animales vertebrados', 'Ciencias Naturales')).toBe('animales');
    expect(hilo('Los seres vivos', 'Ciencias Naturales')).toBe('seres-vivos');
    expect(hilo('Las partes de la planta', 'Ciencias Naturales')).toBe('plantas');
  });

  it('las palabras del hilo se buscan en el tema, no en el nombre del área', () => {
    // «Lengua» no es «la lengua» de los sentidos, y «Ciencias» no activa el laboratorio
    expect(hilo('Los verbos', 'Lengua Castellana')).toBe('lectura-escritura');
    expect(detectarHilos({ tema: 'Los verbos', area: 'Lengua Castellana' }).map(d => d.hilo.id)).not.toContain('sentidos');
    expect(detectarHilos({ tema: 'El cuerpo humano', area: 'Ciencias Naturales' })[0].hilo.id).toBe('cuerpo-humano');
  });

  it('sin pistas en el tema, el hilo del área; sin área, el cole', () => {
    expect(hilo('xyzzy', 'Matemáticas')).toBe('numeros-calculo');
    expect(hilo('xyzzy', 'Música')).toBe('musica');
    expect(hilo('xyzzy', 'Educación Física')).toBe('deporte');
    expect(hilo('Tema libre', '')).toBe('escuela');
  });

  it('devuelve los hilos de más a menos, con puntos', () => {
    const r = detectarHilos({ tema: 'Los animales de la granja', area: 'Ciencias Naturales' }, 3);
    expect(r.length).toBeGreaterThan(1);
    expect(r[0].puntos).toBeGreaterThanOrEqual(r[1].puntos);
    expect(r.every(d => d.puntos >= 3)).toBe(true);
  });
});

/** El índice de los hilos para el dueño: qué hilos hay, qué los activa y qué dibujos tiene cada uno. */
function indiceMarkdown(): string {
  const l: string[] = [
    '# Hilos conductores de las fichas',
    '',
    'Generado por `src/lib/hilos.test.ts` a partir de `src/lib/hilos.ts`: no se edita a mano. Para regenerarlo tras cambiar los hilos: `ACTUALIZAR_DOCS=1 npx vitest run src/lib/hilos.test.ts`.',
    '',
    'Un hilo es el «mundo» al que pertenece lo que se trabaja. La app lo reconoce por el tema, el área y el curso de la ficha (`detectarHilos`) y con él ilustra la hoja: cabecera, dibujo de cada bloque y dibujos de los ejercicios. Cómo funciona, en `docs/FICHAS.md`.',
    '',
    `${HILOS.length} hilos, ${ILUSTRACIONES.filter(i => i.fuente === 'img').length} dibujos (cada dibujo está en uno o más hilos).`,
    '',
  ];
  for (const h of HILOS) {
    l.push(`## ${h.nombre.es} (\`${h.id}\`)`, '');
    l.push(`- Català: ${h.nombre.ca}. English: ${h.nombre.en}.`);
    l.push(`- Áreas: ${h.areas.join(', ')}${h.amplio ? '. Hilo general: pierde frente a uno más concreto' : ''}.`);
    l.push(`- Palabras del tema que lo activan: ${h.temas.join(', ')}.`);
    l.push('- Dibujos (el 1.º, 2.º y 3.º forman la cabecera; × = se pueden repetir para contar):');
    for (const d of dibujosDeHilo(h)) l.push(`  - \`${d.id}\`${esContable(d.id) ? ' ×' : ''}: ${d.descripcion.es}`);
    l.push('');
  }
  return l.join('\n');
}

describe('el índice de los hilos', () => {
  it('docs/HILOS.md está al día', () => {
    const md = indiceMarkdown();
    if (process.env.ACTUALIZAR_DOCS) fs.writeFileSync('docs/HILOS.md', md);
    expect(fs.readFileSync('docs/HILOS.md', 'utf8')).toBe(md);
  });
});
