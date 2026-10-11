import { describe, it, expect } from 'vitest';
import { translate, LANGS, TRANSLATED_KEYS, EN_DICT } from './index';
import { CA } from './ca';

/**
 * El diccionario usa el texto en castellano como clave. Así, lo que no esté
 * traducido se lee en castellano en vez de dejar un hueco o mostrar una clave
 * rota, que es lo que pasa con los sistemas de claves tipo `nav.home`.
 */

describe('idiomas disponibles', () => {
  it('ofrece castellano, inglés y catalán, con el castellano primero', () => {
    expect(LANGS.map(l => l.id)).toEqual(['es', 'en', 'ca']);
  });

  it('cada idioma tiene etiqueta y bandera', () => {
    for (const l of LANGS) {
      expect(l.label.trim()).not.toBe('');
      expect(l.flag.trim()).not.toBe('');
    }
  });
});

describe('translate', () => {
  it('en castellano devuelve el texto tal cual', () => {
    expect(translate('es', 'Mis Clases')).toBe('Mis Clases');
  });

  it('en inglés usa terminología internacional, no una traducción literal', () => {
    // «Diana Competencial» traducido palabra por palabra no significa nada
    // fuera de España; en un centro internacional esto es Learner Profile.
    expect(translate('en', 'Diana Competencial')).toBe('Learner Profile Tracking');
    expect(translate('en', 'Cuaderno de Notas')).toBe('Gradebook');
    expect(translate('en', 'Agenda')).toBe('Planner');
  });

  it('lo que no está traducido se ve en castellano, nunca una clave rota', () => {
    const inventado = 'Un texto que nadie ha traducido todavía';
    expect(translate('en', inventado)).toBe(inventado);
    expect(translate('es', inventado)).toBe(inventado);
  });

  it('sustituye las variables', () => {
    expect(translate('es', 'y {n} alumnos más', { n: 7 })).toBe('y 7 alumnos más');
    expect(translate('en', 'y {n} alumnos más', { n: 7 })).toBe('and 7 more students');
  });

  it('una palabra con contexto lleva su propia traducción y en castellano se ve sin el contexto', () => {
    expect(translate('en', 'Sesiones')).toBe('Lessons');
    expect(translate('en', 'Sesiones@@apoyo')).toBe('Sessions');
    expect(translate('ca', 'Sesiones@@apoyo')).toBe('Sessions');
    expect(translate('es', 'Sesiones@@apoyo')).toBe('Sesiones');
    expect(translate('en', 'Algo sin traducir@@donde sea')).toBe('Algo sin traducir');
  });

  it('una variable repetida se sustituye en todas sus apariciones', () => {
    expect(translate('es', '{x} y {x}', { x: 'A' })).toBe('A y A');
  });

  it('aguanta un idioma desconocido sin romperse', () => {
    // Puede llegar de un localStorage manipulado
    expect(translate('fr' as never, 'Mis Clases')).toBe('Mis Clases');
  });
});

describe('diccionario', () => {
  it('tiene un número razonable de textos', () => {
    expect(TRANSLATED_KEYS).toBeGreaterThan(80);
  });

  it('ninguna traducción está vacía', () => {
    // Una cadena vacía dejaría un hueco en blanco en la interfaz, que es peor
    // que verlo sin traducir.
    const claves = [
      'Inicio', 'Mis Clases', 'Agenda', 'Cuaderno de Notas', 'Asistencia',
      'Rúbricas', 'Informes', 'Actas', 'Historial', 'Configuración',
      'Cerrar sesión', 'Guardar', 'Cancelar', 'Eliminar',
    ];
    for (const c of claves) {
      const en = translate('en', c);
      expect(en.trim(), `«${c}» sin traducir o vacío`).not.toBe('');
      expect(en, `«${c}» debería estar traducido al inglés`).not.toBe(c);
    }
  });
});

describe('català', () => {
  const vars = (s: string) => (s.match(/\{[a-z_]+\}/gi) ?? []).sort().join(',');

  it('tradueix el menú i els textos de sempre', () => {
    expect(translate('ca', 'Mis Clases')).toBe('Les meves classes');
    expect(translate('ca', 'Configuración')).toBe('Configuració');
    expect(translate('ca', 'y {n} alumnos más', { n: 7 })).toBe('i 7 alumnes més');
  });

  it('té tots els textos que té l’anglès, amb les mateixes variables', () => {
    const missing = Object.keys(EN_DICT).filter(k => !(k in CA));
    expect(missing).toEqual([]);
    const badVars = Object.entries(CA).filter(([k, v]) => vars(k) !== vars(v)).map(([k]) => k);
    expect(badVars).toEqual([]);
  });
});
