import { describe, it, expect } from 'vitest';
import {
  MODELOS_ESCALA, MODELOS_RUBRICA, cambiaConLaEtapa, enOrden, escalaDeModelo, etapaDePartida, resumenDeEscala,
  resumenDeRubrica, rubricaDeModelo, type Lengua,
} from './modelosInstrumentos';
import { LOMLOE_COMPETENCES } from './utils';
import { defaultLevels } from '../types';

const LENGUAS: Lengua[] = ['es', 'ca', 'en'];
const ETAPAS = ['primaria', 'eso'] as const;
const CLAVES = new Set<string>(LOMLOE_COMPETENCES.map(c => c.key));

/** Todos los textos de un modelo de rúbrica en una lengua y una etapa. */
function textosDe(id: string, etapa: 'primaria' | 'eso', lengua: Lengua): string[] {
  const m = MODELOS_RUBRICA.find(x => x.id === id)!;
  const r = rubricaDeModelo(m, etapa, lengua);
  const resumen = resumenDeRubrica(m, lengua);
  return [r.name, resumen.uso, ...r.criteria.flatMap(c => [c.name, ...Object.values(c.descriptors)])];
}

describe('rúbricas modelo', () => {
  it('están las diez que se piden, dos de ellas de Educación Física', () => {
    expect(MODELOS_RUBRICA.map(m => m.id)).toEqual([
      'exposicion-oral', 'expresion-escrita', 'resolucion-problemas', 'trabajo-en-equipo', 'cuaderno',
      'lectura-voz-alta', 'proyecto', 'practica-laboratorio', 'ef-juego-colectivo', 'ef-expresion-corporal',
    ]);
    expect(MODELOS_RUBRICA.filter(m => m.ambito === 'ef').map(m => m.id)).toEqual(['ef-juego-colectivo', 'ef-expresion-corporal']);
  });

  it('cada una tiene cuatro criterios con un descriptor para cada uno de los cuatro niveles de partida, en las tres lenguas', () => {
    for (const m of MODELOS_RUBRICA) {
      for (const lengua of LENGUAS) {
        const niveles = defaultLevels(lengua).map(l => l.value);
        for (const etapa of ETAPAS) {
          const r = rubricaDeModelo(m, etapa, lengua);
          expect(r.name.trim(), m.id).not.toBe('');
          expect(r.criteria, m.id).toHaveLength(4);
          for (const c of r.criteria) {
            expect(c.name.trim(), `${m.id} ${lengua}`).not.toBe('');
            expect(Object.keys(c.descriptors).map(Number), `${m.id} · ${c.name}`).toEqual(niveles);
            for (const d of Object.values(c.descriptors)) expect(d.trim().length, `${m.id} · ${c.name} · ${lengua}`).toBeGreaterThan(15);
          }
        }
      }
    }
  });

  it('las tres lenguas están escritas de verdad: ningún texto se repite de una a otra', () => {
    for (const m of MODELOS_RUBRICA) {
      for (const etapa of ETAPAS) {
        const [es, ca, en] = LENGUAS.map(l => textosDe(m.id, etapa, l));
        es.forEach((t, i) => {
          // Un nombre de una sola palabra puede coincidir («Exactitud», «Informe»); una frase, no
          if (!t.includes(' ')) return;
          expect(ca[i], `${m.id}: «${t}» sin traducir al catalán`).not.toBe(t);
          expect(en[i], `${m.id}: «${t}» sin traducir al inglés`).not.toBe(t);
          expect(en[i], `${m.id}: el inglés repite el catalán`).not.toBe(ca[i]);
        });
      }
    }
  });

  it('los niveles de un criterio suben de verdad: ningún descriptor se repite dentro de un criterio ni entre criterios', () => {
    for (const m of MODELOS_RUBRICA) {
      for (const etapa of ETAPAS) {
        for (const lengua of LENGUAS) {
          const todos = rubricaDeModelo(m, etapa, lengua).criteria.flatMap(c => Object.values(c.descriptors));
          expect(new Set(todos).size, `${m.id} ${etapa} ${lengua}`).toBe(todos.length);
        }
      }
    }
  });

  it('donde hay variante, Primaria y ESO no dicen lo mismo; donde no, la etapa da igual', () => {
    const conVariante = MODELOS_RUBRICA.filter(cambiaConLaEtapa).map(m => m.id);
    expect(conVariante).toEqual(['exposicion-oral', 'expresion-escrita', 'resolucion-problemas', 'proyecto', 'practica-laboratorio', 'ef-juego-colectivo']);
    for (const m of MODELOS_RUBRICA) {
      const p = JSON.stringify(rubricaDeModelo(m, 'primaria', 'es'));
      const e = JSON.stringify(rubricaDeModelo(m, 'eso', 'es'));
      if (cambiaConLaEtapa(m)) expect(p, m.id).not.toBe(e);
      else expect(p, m.id).toBe(e);
    }
  });

  it('cada criterio lleva de una a tres competencias clave de la LOMLOE', () => {
    for (const m of MODELOS_RUBRICA) {
      for (const c of rubricaDeModelo(m, 'eso', 'es').criteria) {
        expect(c.competencies.length, `${m.id} · ${c.name}`).toBeGreaterThanOrEqual(1);
        expect(c.competencies.length, `${m.id} · ${c.name}`).toBeLessThanOrEqual(3);
        for (const k of c.competencies) expect(CLAVES.has(k), `${m.id}: ${k}`).toBe(true);
      }
    }
  });

  it('devuelve una copia: tocar lo devuelto no cambia el modelo', () => {
    const m = MODELOS_RUBRICA[0];
    const r = rubricaDeModelo(m, 'eso', 'es');
    r.criteria[0].competencies.push('CD');
    r.criteria[0].descriptors[1] = 'otra cosa';
    const otra = rubricaDeModelo(m, 'eso', 'es');
    expect(otra.criteria[0].competencies).not.toContain('CD');
    expect(otra.criteria[0].descriptors[1]).not.toBe('otra cosa');
  });
});

describe('escalas de registro modelo', () => {
  it('son seis, con entre cuatro y seis conceptos, en las tres lenguas', () => {
    expect(MODELOS_ESCALA).toHaveLength(6);
    for (const m of MODELOS_ESCALA) {
      const porLengua = LENGUAS.map(l => escalaDeModelo(m, l));
      for (const e of porLengua) {
        expect(e.name.trim(), m.id).not.toBe('');
        expect(e.items.length, m.id).toBeGreaterThanOrEqual(4);
        expect(e.items.length, m.id).toBeLessThanOrEqual(6);
        expect(new Set(e.items).size, m.id).toBe(e.items.length);
        for (const c of e.items) expect(c.trim().length, m.id).toBeGreaterThan(8);
      }
      const [es, ca, en] = porLengua;
      expect(ca.name).not.toBe(es.name);
      expect(en.name).not.toBe(es.name);
      es.items.forEach((c, i) => {
        expect(ca.items[i], `${m.id}: «${c}»`).not.toBe(c);
        expect(en.items[i], `${m.id}: «${c}»`).not.toBe(c);
      });
      for (const l of LENGUAS) expect(resumenDeEscala(m, l).uso.trim()).not.toBe('');
    }
  });
});

describe('textos de los modelos', () => {
  const todos: string[] = [
    ...MODELOS_RUBRICA.flatMap(m => ETAPAS.flatMap(e => LENGUAS.flatMap(l => textosDe(m.id, e, l)))),
    ...MODELOS_ESCALA.flatMap(m => LENGUAS.flatMap(l => { const r = resumenDeEscala(m, l); return [r.nombre, r.uso, ...r.partes]; })),
  ];

  it('no llevan rayas largas, ni «profes», ni espacios de más', () => {
    for (const t of todos) {
      expect(t, t).not.toMatch(/[—–]/);
      expect(t.toLowerCase(), t).not.toMatch(/\bprofes?\b/);
      expect(t, t).toBe(t.trim());
      expect(t, t).not.toMatch(/ {2}/);
    }
  });

  it('los descriptores de una rúbrica acaban en punto y los conceptos de una escala, no (son una etiqueta de la tabla)', () => {
    for (const m of MODELOS_RUBRICA) {
      for (const l of LENGUAS) {
        for (const c of rubricaDeModelo(m, 'primaria', l).criteria) {
          for (const d of Object.values(c.descriptors)) expect(d.endsWith('.'), d).toBe(true);
          expect(c.name.endsWith('.'), c.name).toBe(false);
        }
      }
    }
    for (const m of MODELOS_ESCALA) for (const l of LENGUAS) for (const c of escalaDeModelo(m, l).items) expect(c.endsWith('.'), c).toBe(false);
  });

  it('no nombran a nadie: sin nombres propios en mitad de un descriptor', () => {
    // Una mayúscula que no abre la frase ni sigue a dos puntos sería un nombre propio (de persona o de sitio).
    // «Matemáticas», «Educación Física» y su traducción son nombres de áreas y van en el nombre o el uso.
    const AREAS = /Matem[àá]ti(ca|que)s|Educaci[oó]n? F[ií]sica|Educació Física|PE\b/g;
    for (const m of MODELOS_RUBRICA) {
      for (const e of ETAPAS) {
        for (const l of LENGUAS) {
          for (const c of rubricaDeModelo(m, e, l).criteria) {
            for (const d of Object.values(c.descriptors)) expect(d.slice(1).replace(AREAS, ''), d).not.toMatch(/(?<![:.] )[A-ZÁÉÍÓÚÀÈÒÇÑ]/);
          }
        }
      }
    }
  });
});

describe('etapa de partida y orden', () => {
  it('manda la clase elegida y, sin ella, la mayoría de las clases; a igualdad, Primaria', () => {
    expect(etapaDePartida([], null)).toBe('primaria');
    expect(etapaDePartida([{ etapa: 'eso' }, { etapa: 'eso' }, { etapa: 'primaria' }])).toBe('eso');
    expect(etapaDePartida([{ etapa: 'eso' }, { etapa: 'primaria' }])).toBe('primaria');
    expect(etapaDePartida([{ etapa: 'eso' }, { etapa: 'eso' }], { etapa: 'primaria' })).toBe('primaria');
    expect(etapaDePartida([{ etapa: 'primaria' }], { etapa: 'eso' })).toBe('eso');
    // Una clase sin etapa no decide nada
    expect(etapaDePartida([{}, {}, { etapa: 'eso' }], {})).toBe('eso');
  });

  it('quien da Educación Física ve primero sus modelos; los demás, al final', () => {
    expect(enOrden(MODELOS_RUBRICA, true).slice(0, 2).map(m => m.ambito)).toEqual(['ef', 'ef']);
    expect(enOrden(MODELOS_RUBRICA, false).slice(-2).map(m => m.ambito)).toEqual(['ef', 'ef']);
    expect(enOrden(MODELOS_ESCALA, true)[0].id).toBe('ef-habitos-sesion');
    expect(enOrden(MODELOS_RUBRICA, true)).toHaveLength(MODELOS_RUBRICA.length);
  });
});
