/**
 * El manual del asistente de ayuda es texto suelto: nada obliga a tocarlo al
 * mover una pantalla, y una ayuda que describe botones que ya no existen manda
 * al docente a dar vueltas —que es justo lo que este asistente debe evitar—.
 *
 * La otra mitad de la protección está en el tipo: `HELP_TARGETS` es un
 * `Record<Section, …>`, así que añadir una sección sin documentarla no compila.
 * Aquí se comprueba lo que el tipo no ve: que el cuerpo del manual la explique
 * de verdad, y que los saltos de pantalla que propone la IA se limpien siempre.
 */
import { describe, it, expect } from 'vitest';
import { HELP_TARGETS, MANUAL, splitJump, targetLabel } from './appHelp';

/** Los `[identificador]` que encabezan cada apartado del manual. */
const enElManual = new Set(
  [...MANUAL.matchAll(/\[([a-z-]+)\]/g)].map(m => m[1]),
);

describe('el manual cubre la aplicación', () => {
  it('explica todas las pantallas que sabe nombrar', () => {
    const sinExplicar = Object.keys(HELP_TARGETS).filter(id => !enElManual.has(id));
    expect(sinExplicar, 'pantallas en HELP_TARGETS que el manual no documenta').toEqual([]);
  });

  it('no menciona pantallas que no existen', () => {
    const inventadas = [...enElManual].filter(id => !(id in HELP_TARGETS));
    expect(inventadas, 'apartados del manual sin sección real').toEqual([]);
  });

  it('manda a la pestaña de datos a quien pregunte por sus alumnos', () => {
    // Sin esta frase, el asistente de ayuda se pondría a improvisar notas.
    expect(MANUAL).toContain('Consulta IA');
  });
});

describe('splitJump', () => {
  it('saca el destino y quita la marca del texto', () => {
    const r = splitJump('Ve a Mis Clases y crea una.\n\n[IR:classes]');
    expect(r.target).toBe('classes');
    expect(r.text).toBe('Ve a Mis Clases y crea una.');
  });

  it('limpia la marca aunque el identificador no exista', () => {
    // Lo importante: que al docente no le llegue nunca un «[IR:algo]» a la vista.
    const r = splitJump('Texto cualquiera. [IR:pantallaInventada]');
    expect(r.target).toBeUndefined();
    expect(r.text).toBe('Texto cualquiera.');
  });

  it('se queda con el primer destino válido si la IA pone varios', () => {
    const r = splitJump('Uno. [IR:noExiste] Dos. [IR:records] Tres. [IR:agenda]');
    expect(r.target).toBe('records');
    expect(r.text).toBe('Uno.  Dos.  Tres.');
  });

  it('deja intacta una respuesta sin marca', () => {
    const r = splitJump('Una respuesta normal, sin salto.');
    expect(r.target).toBeUndefined();
    expect(r.text).toBe('Una respuesta normal, sin salto.');
  });

  it('acepta la marca en minúsculas o mayúsculas', () => {
    expect(splitJump('x [ir:notebook]').target).toBe('notebook');
  });
});

describe('targetLabel', () => {
  it('traduce el nombre de la pantalla', () => {
    expect(targetLabel('records', 'es')).toBe('Actas');
    expect(targetLabel('records', 'en')).toBe('Grade Sheets');
  });

  it('devuelve el identificador tal cual si no es una pantalla', () => {
    expect(targetLabel('welcome', 'es')).toBe('welcome');
  });
});
