/**
 * Batería adversarial de nombres (auditoría del 5-11-2026): lo que un docente escribe deprisa, lo que trae un PDF y lo
 * que trae una lista de clase. Todos los nombres son inventados. Cada caso dice qué no puede quedar en el texto.
 */
import { describe, it, expect } from 'vitest';
import { buildPseudonymizer, textoNormal } from './privacy';

const roster = [
  { id: '1', name: 'Lucía Pérez Navarro' }, { id: '2', name: 'Marco Rodríguez Gil' }, { id: '3', name: 'Rosa Martín' },
  { id: '4', name: 'Ana López' }, { id: '5', name: 'Ana Ruiz' }, { id: '6', name: 'Núria Puig i Ferrer' }, { id: '7', name: 'Lluís Roig Soler' },
  { id: '8', name: 'John Smith-Jones' }, { id: '9', name: 'María José García de la Torre' }, { id: '10', name: 'Iván Núñez Castaño' },
  { id: '11', name: "Siobhan O'Neil" }, { id: '12', name: 'Alumno 1' }, { id: '13', name: 'Mohamed El Amrani' }, { id: '14', name: 'Pau Mas Vidal' },
  { id: '15', name: 'Carla Pérez Soto' },
];
const p = buildPseudonymizer(roster);

/** `[texto, lo que no puede quedar, lo que sí tiene que quedar]`. */
const casos: [string, string, string[], string[]?][] = [
  ['sin tildes y en mayúsculas', 'lucia perez navarro falta; LUCÍA PÉREZ también; Lucia Perez', ['Lucia', 'Perez', 'LUCÍA']],
  ['sin eñe', 'Ivan Nunez Castano y IVAN NUNEZ', ['Nunez', 'Ivan']],
  ['nombre de pila en mayúsculas', 'LUCÍA y MARCO discuten; NÚRIA no.', ['LUCÍA', 'MARCO', 'NÚRIA']],
  ['partido en dos líneas', 'Informe de Lucía\nPérez Navarro.', ['Lucía', 'Pérez']],
  ['guion de fin de línea dentro de la palabra (PDF a dos columnas)', 'La alumna Lu-\ncía Pérez Navarro', ['Lu-', 'cía', 'Pérez']],
  ['nombre con el segundo apellido, nombre compuesto, apellidos con partícula', 'Lucía Navarro ha venido; María José García; García de la Torre', ['Navarro', 'García', 'Torre']],
  ['apellidos solos', 'Pérez Navarro ha faltado. Rodríguez Gil también.', ['Pérez', 'Navarro', 'Rodríguez']],
  ['lista con el orden invertido', 'PÉREZ NAVARRO, LUCÍA\nRodríguez Gil, Marco\nMartín, Rosa', ['PÉREZ', 'Rodríguez', 'Martín', 'LUCÍA']],
  ['un solo apellido con mayúscula', 'Martín ha faltado. Núñez también.', ['Martín', 'Núñez']],
  ['catalán sin acentos', 'Nuria Puig; Lluis Roig; Lluís', ['Nuria', 'Lluis', 'Lluís']],
  ['apellido inglés con guion, con y sin él', 'John Smith Jones; Smith-Jones', ['Smith', 'John']],
  ['apóstrofo recto y tipográfico', "Siobhan O'Neil y Siobhan O’Neil", ['Siobhan', 'Neil']],
  ['partícula árabe', 'Mohamed El Amrani; Mohamed; El Amrani', ['Mohamed', 'Amrani']],
  ['nombre de pila en minúscula', 'lucía va mal; núria bien', ['lucía', 'núria']],
  ['acento como carácter combinado (NFD)', 'Lucía Pérez Navarro', ['Luci', 'rez']],
  ['guion blando y espacio de anchura cero', 'Lu­cía Pé­rez y Mar​co Rodríguez', ['cía', 'rez', 'Mar​co']],
  ['espacio duro', 'Lucía Pérez Navarro', ['Lucía', 'Pérez']],
  ['posesivo inglés', "Lucía's work and Marco's", ['Lucía', 'Marco']],
  ['en el nombre de un archivo', 'Informe_Lucia_Perez.pdf y marco-rodriguez.docx', ['Lucia', 'Perez', 'marco']],
];

describe('buildPseudonymizer, batería adversarial', () => {
  for (const [nombre, entrada, prohibidas] of casos) {
    it(nombre, () => {
      const salida = p.mask(entrada);
      for (const x of prohibidas) expect(salida, salida).not.toContain(x);
      expect(salida).toMatch(/\[ALU-\d+\]/);
    });
  }

  it('la vuelta devuelve el nombre completo, también desde un apellido suelto o una lista invertida', () => {
    expect(p.unmask(p.mask('Pérez Navarro, Lucía'))).toBe('Lucía Pérez Navarro');
    expect(p.unmask(p.mask('Navarro ha faltado'))).toBe('Lucía Pérez Navarro ha faltado');
    expect(p.unmask(p.mask('lucía va mal'))).toBe('Lucía Pérez Navarro va mal');
  });

  it('un apellido que comparten dos alumnos («Pérez») se tapa con un código propio, que vuelve como «Pérez»', () => {
    const t = p.mask('Pérez ha faltado');
    expect(t).not.toContain('Pérez');
    expect(p.unmask(t)).toBe('Pérez ha faltado');
  });

  it('no tapa lo que es una palabra o un lugar: «rosa», «marco», «pau» en minúscula; «Vidal», «Mas», «Gil», «Soto» solos son demasiado cortos o palabras', () => {
    expect(p.mask('una falda rosa con un marco; volem pau')).toBe('una falda rosa con un marco; volem pau');
    expect(p.mask('Vamos a Soria. Vive en el Mas de arriba.')).toBe('Vamos a Soria. Vive en el Mas de arriba.');
    expect(p.mask('Rosalía llegó tarde a Navarra.')).toBe('Rosalía llegó tarde a Navarra.');
  });

  it('lo que no se puede tapar (y se dice en la privacidad): un apodo o diminutivo, y un nombre pegado a otra cosa', () => {
    expect(p.mask('Lu y Marquitos y Rosi')).toBe('Lu y Marquitos y Rosi');
    expect(p.mask('LuciaPerezNavarro Lucía2')).toBe('LuciaPerezNavarro Lucía2');
  });

  it('textoNormal quita los caracteres invisibles y compone las tildes', () => {
    expect(textoNormal('Lu­cía​ Pérez')).toBe('Lucía Pérez');
  });

  it('con muchos alumnos sigue siendo rápido (sesenta alumnos, un informe de veinte mil letras)', () => {
    const muchos = buildPseudonymizer(Array.from({ length: 60 }, (_, i) => ({ id: String(i), name: `Nombre${i} Apellido${i} Segundo${i}` })));
    const texto = 'Nombre3 Apellido3 hizo la tarea. Segundo7 no. '.repeat(400);
    const t0 = performance.now();
    const salida = muchos.mask(texto);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(salida).not.toContain('Apellido3');
    expect(salida).not.toContain('Segundo7');
  });
});
