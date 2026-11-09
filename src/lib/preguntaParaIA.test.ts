import { describe, it, expect, afterEach } from 'vitest';
import { preguntaParaIA } from './preguntaParaIA';
import { setPrivacyRoster } from '../services/privacy';

afterEach(() => setPrivacyRoster([]));

describe('preguntaParaIA (lo que el docente escribe en un chat)', () => {
  it('quita siempre los datos de contacto', () => {
    expect(preguntaParaIA('llama a la madre al 612 345 678 o a lucia@gmail.com')).toBe('llama a la madre al [teléfono] o a [correo]');
  });

  it('quita los datos de salud solo si la pregunta nombra a un alumno de la lista', () => {
    setPrivacyRoster([{ id: '1', name: 'Lucía Pérez Navarro' }]);
    expect(preguntaParaIA('¿Qué hago con Lucía, que tiene TDAH?')).toBe('¿Qué hago con Lucía, que tiene [dato de salud]?');
    expect(preguntaParaIA('¿Cómo explico la diabetes en 5º?')).toBe('¿Cómo explico la diabetes en 5º?');
  });

  it('también con un apellido suelto o el nombre en minúscula', () => {
    setPrivacyRoster([{ id: '1', name: 'Lucía Pérez Navarro' }]);
    expect(preguntaParaIA('Navarro toma medicación')).toBe('Navarro toma [dato de salud]');
    expect(preguntaParaIA('lucía toma medicación')).toBe('lucía toma [dato de salud]');
  });
});
