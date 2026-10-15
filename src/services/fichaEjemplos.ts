/**
 * Tres fichas de ejemplo, escritas a mano, que se enseñan a la IA como modelo de
 * lo que se espera (una por tramo de edad). Una IA con solo instrucciones tiende
 * a hacer fichas planas y con datos flojos; con una ficha bien hecha delante,
 * copia su forma: tres bloques que suben de nivel, la explicación con un ejemplo
 * resuelto, soluciones con las cuentas, datos reales y un último bloque que obliga
 * a pensar.
 *
 * Los temas son distintos de los que más se piden (animales, fracciones, cuerpo
 * humano…) para que la IA copie el estilo y no el contenido; el prompt se lo dice.
 * Las cuentas están comprobadas en `fichaEjemplos.test.ts`.
 */
import type { FichaContent } from './resources';
import type { PerfilCurso } from '../lib/escalera';

/** 2.º de Primaria · Matemáticas: sumas y restas hasta 100. */
const SUMAS: FichaContent = {
  titulo: 'Sumamos y restamos en la tienda',
  explicacion:
    'Sumar es juntar y restar es quitar. Si tengo 24 cromos y me regalan 10, ahora tengo 24 + 10 = 34. ' +
    'Si luego regalo 5, me quedan 34 − 5 = 29.',
  instrucciones: 'Lee cada ejercicio con calma y escribe la respuesta en su espacio. Empieza por el primero y ve subiendo.',
  actividades: [
    {
      titulo: 'Calculamos',
      dificultad: 1,
      recuadro: { tipo: 'recuerda', texto: '', lista: ['+ significa juntar', '− significa quitar', '= significa «es igual a»'] },
      ejercicios: [
        { tipo: 'calculos', enunciado: 'Calcula.', lineas: ['12 + 5', '20 + 7', '18 − 6', '30 − 10'], respuesta: 'caja', solucion: '17, 27, 12, 20' },
        {
          tipo: 'relacionar', enunciado: 'Une cada operación con su resultado.',
          izquierda: ['10 + 5', '15 − 5', '9 + 9', '20 + 30'], derecha: ['18', '15', '50', '10'],
          solucion: '10 + 5 con 15; 15 − 5 con 10; 9 + 9 con 18; 20 + 30 con 50',
        },
      ],
    },
    {
      titulo: 'Resolvemos en la tienda',
      dificultad: 2,
      ejercicios: [
        {
          tipo: 'completar',
          enunciado: 'En la tienda, un lápiz cuesta 3 euros y una goma cuesta 2 euros. Un lápiz y una goma cuestan ______ euros juntos. Dos gomas cuestan ______ euros.',
          solucion: '5; 4',
        },
        { tipo: 'problema', enunciado: 'Lucía tenía 45 cromos y le regala 20 a su prima. ¿Cuántos cromos le quedan?', solucion: '45 − 20 = 25. Le quedan 25 cromos.' },
      ],
    },
    {
      titulo: 'Pensamos un poco más',
      dificultad: 3,
      recuadro: { tipo: 'reto', texto: 'Sin hacer la cuenta: ¿18 + 5 es mayor o menor que 18 + 7? ¿Por qué?' },
      ejercicios: [
        {
          tipo: 'problema',
          enunciado: 'En el cole hay 36 lápices en una caja. Marcos coge 12 y Sara coge 8. ¿Cuántos lápices quedan en la caja?',
          solucion: '12 + 8 = 20 lápices cogidos; 36 − 20 = 16. Quedan 16 lápices.',
        },
        {
          tipo: 'abierta', enunciado: 'Inventa un problema de sumas con los números 15 y 10. Escríbelo y resuélvelo.',
          solucion: 'Respuesta libre. Ejemplo: «Tengo 15 canicas y me dan 10 más. ¿Cuántas tengo?» 15 + 10 = 25.',
        },
      ],
    },
  ],
};

/** 4.º de Primaria · Ciencias Naturales: el ciclo del agua. */
const AGUA: FichaContent = {
  titulo: 'El viaje del agua',
  explicacion:
    'El agua de la Tierra no se gasta: cambia de estado y vuelve a empezar. El Sol calienta el agua del mar y de los ríos y la evapora; ' +
    'el vapor sube, se enfría y forma las nubes (condensación); de las nubes cae lluvia o nieve (precipitación); el agua vuelve a ríos y mares y el ciclo continúa.',
  instrucciones: 'Lee con atención. Los ejercicios empiezan fáciles y cada bloque pide pensar un poco más.',
  actividades: [
    {
      titulo: 'Las palabras del ciclo',
      dificultad: 1,
      recuadro: { tipo: 'recuerda', texto: '', lista: ['Sólido = hielo', 'Líquido = agua', 'Gas = vapor de agua'] },
      ejercicios: [
        {
          tipo: 'relacionar', enunciado: 'Une cada fenómeno con lo que ocurre.',
          izquierda: ['Evaporación', 'Condensación', 'Precipitación', 'Infiltración'],
          derecha: ['El vapor se enfría y forma gotas', 'El agua cae de las nubes', 'El agua líquida pasa a vapor', 'El agua entra en el suelo'],
          solucion: 'Evaporación con «El agua líquida pasa a vapor»; Condensación con «El vapor se enfría y forma gotas»; Precipitación con «El agua cae de las nubes»; Infiltración con «El agua entra en el suelo».',
        },
        {
          tipo: 'verdadero_falso', enunciado: 'Marca V (verdadero) o F (falso).',
          afirmaciones: [
            'El Sol es el que calienta el agua y la evapora.',
            'Las nubes están formadas por gotitas de agua o cristales de hielo.',
            'El agua que se evapora desaparece para siempre.',
            'La nieve es una forma de precipitación.',
          ],
          solucion: '1 V; 2 V; 3 F (el vapor se enfría y vuelve a caer en forma de lluvia o nieve); 4 V.',
        },
      ],
    },
    {
      titulo: 'Ordenamos y completamos',
      dificultad: 2,
      ejercicios: [
        {
          tipo: 'ordenar', enunciado: 'Numera los pasos del ciclo del agua en el orden en que ocurren.',
          elementos: [
            'El Sol calienta el agua del mar', 'El agua se evapora y sube', 'El vapor se enfría y forma nubes',
            'Las nubes sueltan lluvia o nieve', 'El agua vuelve a ríos y mares',
          ],
          solucion: 'Ese mismo orden: 1, 2, 3, 4, 5.',
        },
        {
          tipo: 'tabla_rellenar', enunciado: 'Completa los cambios de estado del agua.',
          columnas: ['Cambio de estado', 'De…', 'A…'],
          filas: [['Evaporación', 'Líquido', 'Gas'], ['Condensación', 'Gas', ''], ['Solidificación', '', 'Sólido'], ['Fusión', 'Sólido', '']],
          solucion: 'Condensación: de gas a líquido; Solidificación: de líquido a sólido; Fusión: de sólido a líquido.',
        },
      ],
    },
    {
      titulo: 'Razonamos',
      dificultad: 3,
      recuadro: { tipo: 'reto', texto: '¿Por qué la ropa tendida se seca antes en un día de verano que en uno de invierno? Relaciónalo con la evaporación.' },
      ejercicios: [
        {
          tipo: 'problema',
          enunciado: 'En un depósito hay 120 litros de agua. Con el calor del verano se evaporan 15 litros cada semana. a) ¿Cuántos litros quedan al cabo de 4 semanas? b) Si después llueve y entran 40 litros, ¿cuántos hay entonces?',
          solucion: 'a) 15 × 4 = 60 litros se evaporan; 120 − 60 = 60 litros. b) 60 + 40 = 100 litros.',
        },
        {
          tipo: 'abierta',
          enunciado: 'Mario dice: «Algún día el agua del mar se acabará». ¿Estás de acuerdo? Explica por qué usando las palabras evaporación y precipitación.',
          solucion: 'No: el agua no se gasta, cambia de estado. El agua del mar se evapora, forma nubes y vuelve a caer como precipitación, así que el ciclo continúa.',
        },
      ],
    },
  ],
};

/** 6.º de Primaria · Matemáticas: decimales y porcentajes (nivel alto del ciclo). */
const REBAJAS: FichaContent = {
  titulo: 'Rebajas y porcentajes',
  explicacion:
    'Un porcentaje es una fracción de denominador 100: el 25 % es 25/100 = 1/4. Para calcular el 25 % de una cantidad la dividimos entre 4; ' +
    'para el 10 %, entre 10; para el 50 %, entre 2. Ejemplo: el 10 % de 36,50 € es 3,65 €.',
  instrucciones: 'Resuelve en orden: cada bloque es más difícil que el anterior. Escribe las operaciones que hagas.',
  actividades: [
    {
      titulo: 'Calculamos con decimales y porcentajes',
      dificultad: 1,
      recuadro: { tipo: 'recuerda', texto: '', lista: ['10 % = dividir entre 10', '25 % = dividir entre 4', '50 % = dividir entre 2'] },
      ejercicios: [
        {
          tipo: 'calculos', enunciado: 'Calcula el porcentaje de cada cantidad.',
          lineas: ['10 % de 250', '25 % de 80', '50 % de 36,60', '10 % de 4,5'], respuesta: 'caja', solucion: '25; 20; 18,30; 0,45',
        },
        {
          tipo: 'tabla_rellenar', enunciado: 'Completa la tabla de equivalencias.',
          columnas: ['Porcentaje', 'Fracción', 'Decimal'],
          filas: [['50 %', '1/2', ''], ['25 %', '', '0,25'], ['', '1/10', '0,1'], ['75 %', '3/4', '']],
          solucion: '50 %: 0,5; 25 %: 1/4; 10 %; 75 %: 0,75.',
        },
      ],
    },
    {
      titulo: 'Interpretamos las rebajas',
      dificultad: 2,
      ejercicios: [
        {
          tipo: 'tabla_rellenar', enunciado: 'Una tienda rebaja un 25 % todos sus artículos. Completa el descuento y el precio final de cada uno.',
          columnas: ['Artículo', 'Precio', 'Descuento (25 %)', 'Precio final'],
          filas: [['Mochila', '48 €', '', ''], ['Zapatillas', '64 €', '', ''], ['Gorra', '18 €', '', '']],
          solucion: 'Mochila: 12 € y 36 €; Zapatillas: 16 € y 48 €; Gorra: 4,50 € y 13,50 €.',
        },
        {
          tipo: 'problema',
          enunciado: 'Ana compra la mochila y las zapatillas de la tabla con la rebaja del 25 %. Paga con un billete de 100 €. ¿Cuánto dinero le devuelven?',
          solucion: 'Mochila 36 € + zapatillas 48 € = 84 €. Cambio: 100 − 84 = 16 €.',
        },
      ],
    },
    {
      titulo: 'Retos con razonamiento',
      dificultad: 3,
      recuadro: { tipo: 'reto', texto: '¿Es lo mismo rebajar un 20 % y luego subir un 20 % que dejar el precio como estaba? Pruébalo con 100 €.' },
      ejercicios: [
        {
          tipo: 'problema',
          enunciado: 'Unos auriculares cuestan 80 € y se rebajan un 10 %. Una semana después se vuelven a rebajar un 10 % sobre el nuevo precio. Luis dice que el descuento total es del 20 % y que el precio final es 64 €. ¿Tiene razón? Calcula el precio final y explica tu respuesta.',
          solucion: 'No. Primera rebaja: 10 % de 80 = 8, queda 72 €. Segunda: 10 % de 72 = 7,20, queda 64,80 €. El segundo 10 % se calcula sobre 72 €, no sobre 80 €; el descuento total es 15,20 €, un 19 %.',
        },
        {
          tipo: 'abierta', enunciado: 'Inventa un problema de rebajas en el que el precio final sea 30 €. Escribe el enunciado y resuélvelo.',
          solucion: 'Respuesta libre. Ejemplo: «Un jersey de 40 € se rebaja un 25 %. ¿Cuánto cuesta ahora?» 25 % de 40 = 10; 40 − 10 = 30 €.',
        },
      ],
    },
  ],
};

/** Los ejemplos tal cual, para las pruebas. */
export const EJEMPLOS_FICHA = { sumas: SUMAS, agua: AGUA, rebajas: REBAJAS } as const;

/** Qué ejemplo corresponde a cada tramo: 1.º a 3.º, 4.º, y 5.º en adelante (también el resto de etapas y los cursos sin identificar). */
export function ejemploParaCurso(perfil: PerfilCurso): FichaContent {
  if (perfil.banda === 'ciclo1' || (perfil.banda === 'ciclo2' && perfil.curso === 3)) return SUMAS;
  if (perfil.banda === 'ciclo2') return AGUA;
  return REBAJAS;
}

/**
 * El ejemplo como lo ve la IA: JSON compacto con el mismo esquema que ella debe
 * devolver, así que sin los recuadros si el diseño no los lleva.
 */
export function ejemploParaPrompt(perfil: PerfilCurso, opts: { cuaderno: boolean }): string {
  const e = ejemploParaCurso(perfil);
  return JSON.stringify({
    titulo: e.titulo,
    explicacion: e.explicacion,
    instrucciones: e.instrucciones,
    // `undefined` no sale en el JSON
    actividades: opts.cuaderno ? e.actividades : e.actividades.map(a => ({ ...a, recuadro: undefined })),
  });
}
