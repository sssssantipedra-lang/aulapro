import { describe, expect, it } from 'vitest';
import { cuantasNegritas, equilibrarNegritas, negritaDelVerbo, negritasHtml, partirNegritas, quitarNegritas, sinNegritasQueNoSePintan } from './negritas';

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

describe('las negritas de la lectura fácil', () => {
  it('quitarNegritas deja solo el texto', () => {
    expect(quitarNegritas('El **dragón** vive en una **cueva**.')).toBe('El dragón vive en una cueva.');
    expect(quitarNegritas('')).toBe('');
  });

  it('equilibrarNegritas respeta lo bien cerrado y arregla lo roto', () => {
    expect(equilibrarNegritas('Un **dragón** y su **cueva**')).toBe('Un **dragón** y su **cueva**');
    // Sin cerrar: la marca suelta se va
    expect(equilibrarNegritas('Un **dragón y su cueva')).toBe('Un dragón y su cueva');
    expect(equilibrarNegritas('Un dragón** y su cueva')).toBe('Un dragón y su cueva');
    // Parejas vacías y tres asteriscos
    expect(equilibrarNegritas('Hola **** mundo')).toBe('Hola  mundo');
    // Tres asteriscos (negrita y cursiva de Markdown) valen como una negrita
    expect(equilibrarNegritas('***dragón***')).toBe('**dragón**');
    expect(equilibrarNegritas('**a** y **b')).toBe('**a** y b');
  });

  it('cuantasNegritas cuenta las parejas cerradas', () => {
    expect(cuantasNegritas('**a** b **c**')).toBe(2);
    expect(cuantasNegritas('sin negritas')).toBe(0);
    expect(cuantasNegritas('**abierta')).toBe(0);
  });

  it('negritasHtml escapa primero y pinta después: nada de lo que escribe la IA se cuela como HTML', () => {
    expect(negritasHtml('Un **dragón** <b>grande</b>', esc)).toBe('Un <b>dragón</b> &lt;b&gt;grande&lt;/b&gt;');
    expect(negritasHtml('**<script>**', esc)).toBe('<b>&lt;script&gt;</b>');
    expect(negritasHtml('roto **así', esc)).toBe('roto así');
  });

  it('partirNegritas da los trozos para el Word', () => {
    expect(partirNegritas('El **dragón** vive aquí')).toEqual([
      { texto: 'El ', negrita: false }, { texto: 'dragón', negrita: true }, { texto: ' vive aquí', negrita: false },
    ]);
    expect(partirNegritas('**todo**')).toEqual([{ texto: 'todo', negrita: true }]);
    expect(partirNegritas('')).toEqual([]);
  });

  describe('el verbo de la consigna', () => {
    it.each([
      ['Rodea en el texto las palabras.', '**Rodea** en el texto las palabras.'],
      ['Subraya el nombre del personaje.', '**Subraya** el nombre del personaje.'],
      ['Contesta.', '**Contesta**.'],
      ['Numera según el orden.', '**Numera** según el orden.'],
      ['Señala la correcta.', '**Señala** la correcta.'],
      ['Envolta les paraules.', '**Envolta** les paraules.'],
      ['Circle the words.', '**Circle** the words.'],
    ])('%s', (entrada, salida) => {
      expect(negritaDelVerbo(entrada)).toBe(salida);
    });

    it('no toca lo que no empieza por un verbo conocido, ni lo que ya lleva negritas', () => {
      expect(negritaDelVerbo('El dragón ______ en una cueva.')).toBe('El dragón ______ en una cueva.');
      expect(negritaDelVerbo('Rodea el **dragón**.')).toBe('Rodea el **dragón**.');
      expect(negritaDelVerbo('')).toBe('');
    });
  });
});

describe('sinNegritasQueNoSePintan', () => {
  const ficha = {
    titulo: 'Las **fracciones**',
    explicacion: 'Una **fracción** es parte de un todo.',
    instrucciones: '**Lee** y contesta.',
    historia: { mision: 'Salva la **nave**', cierre: 'Fin', insignia: '**Piloto**' },
    actividades: [{
      titulo: 'Bloque **uno**',
      narrativa: 'Despega la **nave**',
      recuadro: { tipo: 'recuerda', texto: 'No olvides **esto**', lista: ['**Primero**', 'Después'] },
      ejercicios: [{
        enunciado: '**Rodea** la **fracción**',
        opciones: ['**a**', 'b'],
        columnas: ['**A**', 'B'], filas: [['**1**', '2']],
        lineas: ['**1 + 1**'],
        leyenda: [{ color: 'rojo', criterio: '**pares**' }],
        solucion: 'Es la **primera**',
      }],
    }],
    tarjetas: [{ pregunta: '¿**Qué**?', respuesta: '**Eso**' }],
    lectura: { parrafos: ['El **dragón** vive.'], pista: 'Mira **bien**', destrezas: ['**Vocabulario**'] },
  };

  it('quita los asteriscos de lo que la hoja no pinta con negritas', () => {
    const l = sinNegritasQueNoSePintan(ficha);
    expect(l.titulo).toBe('Las fracciones');
    expect(l.historia).toEqual({ mision: 'Salva la nave', cierre: 'Fin', insignia: 'Piloto' });
    const a = l.actividades[0];
    expect(a.titulo).toBe('Bloque uno');
    expect(a.narrativa).toBe('Despega la nave');
    expect(a.recuadro).toEqual({ tipo: 'recuerda', texto: 'No olvides esto', lista: ['Primero', 'Después'] });
    const e = a.ejercicios[0];
    expect(e.columnas).toEqual(['A', 'B']);
    expect(e.filas).toEqual([['1', '2']]);
    expect(e.lineas).toEqual(['1 + 1']);
    expect(e.leyenda[0].criterio).toBe('pares');
    expect(e.solucion).toBe('Es la primera');
    expect(l.tarjetas[0]).toEqual({ pregunta: '¿Qué?', respuesta: 'Eso' });
    expect(l.lectura.pista).toBe('Mira bien');
    expect(l.lectura.destrezas).toEqual(['Vocabulario']);
  });

  it('deja las negritas de lo que sí se pinta, bien cerradas', () => {
    const l = sinNegritasQueNoSePintan(ficha);
    expect(l.explicacion).toBe('Una **fracción** es parte de un todo.');
    expect(l.instrucciones).toBe('**Lee** y contesta.');
    expect(l.actividades[0].ejercicios[0].enunciado).toBe('**Rodea** la **fracción**');
    expect(l.actividades[0].ejercicios[0].opciones).toEqual(['**a**', 'b']);
    expect(l.lectura.parrafos).toEqual(['El **dragón** vive.']);
    // Una negrita sin cerrar en un campo que se pinta no deja un asterisco
    expect(sinNegritasQueNoSePintan({ enunciado: 'Una **mal cerrada' }).enunciado).toBe('Una mal cerrada');
  });

  it('no toca el original ni lo que no es texto', () => {
    const antes = JSON.stringify(ficha);
    sinNegritasQueNoSePintan(ficha);
    expect(JSON.stringify(ficha)).toBe(antes);
    expect(sinNegritasQueNoSePintan({ n: 3, ok: true, nada: null, lista: [1, 2] })).toEqual({ n: 3, ok: true, nada: null, lista: [1, 2] });
  });
});

