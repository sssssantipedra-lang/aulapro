import { describe, expect, it } from 'vitest';
import { cuantasNegritas, equilibrarNegritas, negritaDelVerbo, negritasHtml, partirNegritas, quitarNegritas } from './negritas';

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
