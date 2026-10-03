/**
 * El registro de comunidades alimenta lo que el docente ve citado como «el
 * decreto de tu comunidad»: un fallo aquí no rompe nada a la vista, pero
 * acabaría citando una norma equivocada. Se comprueba que la lista es la
 * esperada y que cada cita es coherente.
 */
import { describe, it, expect } from 'vitest';
import {
  COMUNIDADES, NORMAS_ESTATALES, comunidadDePerfil, comunidadesOrdenadas, comunidadPorId,
  citarNormas, esComunidadId, idiomaDelTexto, nombreComunidad, normasDe, textoNorma,
} from './comunidades';
import { CARGADORES } from './cargar';

describe('lista de comunidades', () => {
  it('son las 17 comunidades, Ceuta, Melilla y la salida «Fuera de España»', () => {
    expect(COMUNIDADES).toHaveLength(20);
    expect(new Set(COMUNIDADES.map(c => c.id)).size).toBe(20);
  });

  it('todas tienen nombre en los tres idiomas de la app', () => {
    for (const c of COMUNIDADES) {
      for (const idioma of ['es', 'ca', 'en'] as const) {
        expect(c.nombre[idioma].trim(), `${c.id} sin nombre en ${idioma}`).not.toBe('');
      }
    }
  });

  it('se ordenan por el nombre en el idioma de la app y «Fuera de España» va la última', () => {
    for (const idioma of ['es', 'ca', 'en'] as const) {
      const lista = comunidadesOrdenadas(idioma);
      expect(lista).toHaveLength(20);
      expect(lista[lista.length - 1].id).toBe('fuera');
      const nombres = lista.slice(0, -1).map(c => c.nombre[idioma]);
      expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, idioma)));
    }
  });

  it('ordenar no altera el registro', () => {
    const antes = COMUNIDADES.map(c => c.id).join();
    comunidadesOrdenadas('en');
    expect(COMUNIDADES.map(c => c.id).join()).toBe(antes);
  });

  it('nombreComunidad usa el idioma pedido', () => {
    expect(nombreComunidad('cataluna', 'es')).toBe('Cataluña');
    expect(nombreComunidad('cataluna', 'ca')).toBe('Catalunya');
    expect(nombreComunidad('cataluna', 'en')).toBe('Catalonia');
  });
});

describe('comunidad guardada en el perfil', () => {
  it('reconoce un identificador válido', () => {
    expect(esComunidadId('madrid')).toBe(true);
    expect(comunidadDePerfil('comunitat-valenciana')).toBe('comunitat-valenciana');
  });

  it('un valor ausente o inventado se trata como «sin comunidad», no rompe', () => {
    expect(comunidadDePerfil(undefined)).toBeNull();
    expect(comunidadDePerfil('')).toBeNull();
    expect(comunidadDePerfil('atlantida')).toBeNull();
    expect(comunidadDePerfil(42)).toBeNull();
    // Un archivo de copia editado a mano no debe colar propiedades del objeto
    expect(comunidadDePerfil('constructor')).toBeNull();
  });
});

describe('decretos registrados', () => {
  it('la Comunitat Valenciana tiene en cada etapa el decreto matriz y su modificación, en ese orden', () => {
    const primaria = normasDe('comunitat-valenciana', 'primaria')!;
    expect(primaria.map(n => n.tipo)).toEqual(['matriz', 'modificacion']);
    expect(primaria[0].corto.es).toBe('Decreto 106/2022, de 5 de agosto');
    expect(primaria[1].corto.es).toBe('Decreto 96/2026, de 19 de junio');

    const eso = normasDe('comunitat-valenciana', 'eso')!;
    expect(eso.map(n => n.tipo)).toEqual(['matriz', 'modificacion']);
    expect(eso[0].corto.es).toBe('Decreto 107/2022, de 5 de agosto');
    expect(eso[1].corto.es).toBe('Decreto 66/2024, de 21 de junio');
  });

  it('Cataluña regula Primaria y ESO con un único decreto', () => {
    const primaria = normasDe('cataluna', 'primaria')!;
    const eso = normasDe('cataluna', 'eso')!;
    expect(primaria).toHaveLength(1);
    expect(primaria[0]).toBe(eso[0]);
    expect(primaria[0].corto.ca).toBe('Decret 175/2022, de 27 de setembre');
  });

  it('Madrid tiene un decreto por etapa', () => {
    expect(normasDe('madrid', 'primaria')![0].corto.es).toBe('Decreto 61/2022, de 13 de julio');
    expect(normasDe('madrid', 'eso')![0].corto.es).toBe('Decreto 65/2022, de 20 de julio');
  });

  it('una comunidad sin decreto registrado devuelve null, no una lista vacía', () => {
    expect(normasDe('andalucia', 'primaria')).toBeNull();
    expect(normasDe('fuera', 'eso')).toBeNull();
  });

  it('toda norma tiene título, cita corta y boletín, y la cita y el boletín cubren los idiomas del título', () => {
    const todas = [
      ...Object.values(NORMAS_ESTATALES).flat(),
      ...COMUNIDADES.flatMap(c => Object.values(c.normas).flat()),
    ];
    for (const n of todas) {
      for (const campo of ['titulo', 'corto', 'boletin'] as const) {
        expect(Object.keys(n[campo]).length, `${n.corto.es ?? n.corto.ca} sin ${campo}`).toBeGreaterThan(0);
      }
      // El título puede faltar en un idioma (se completa al comprobarlo contra
      // el boletín), pero la cita corta y el boletín no: son lo que se enseña.
      for (const idioma of Object.keys(n.titulo) as ('es' | 'ca')[]) {
        expect(n.corto[idioma], `${n.corto.es ?? n.corto.ca}: cita corta sin «${idioma}»`).toBeTruthy();
        expect(n.boletin[idioma], `${n.corto.es ?? n.corto.ca}: boletín sin «${idioma}»`).toBeTruthy();
      }
    }
  });

  it('los idiomas de la comunidad son los de sus títulos', () => {
    for (const c of COMUNIDADES) {
      const normas = Object.values(c.normas).flat();
      if (normas.length === 0) { expect(c.idiomas).toEqual([]); continue; }
      const usados = new Set(normas.flatMap(n => Object.keys(n.titulo)));
      for (const i of usados) expect(c.idiomas, `${c.id} no declara ${i}`).toContain(i);
    }
  });

  it('una comunidad con currículo propio nunca cita una norma sin verificar', () => {
    for (const [id, porEtapa] of Object.entries(CARGADORES)) {
      for (const etapa of Object.keys(porEtapa) as ('primaria' | 'eso')[]) {
        const normas = normasDe(id as never, etapa);
        expect(normas, `${id}/${etapa} tiene currículo pero ninguna norma registrada`).not.toBeNull();
        for (const n of normas!) {
          expect(n.verificada, `${id}/${etapa}: «${n.corto.es ?? n.corto.ca}» sin verificar`).toBe(true);
        }
      }
    }
  });
});

describe('citar las normas', () => {
  it('textoNorma muestra el idioma de la app si la norma se publicó en él', () => {
    const [matriz] = normasDe('comunitat-valenciana', 'primaria')!;
    expect(textoNorma(matriz.corto, 'es')).toBe('Decreto 106/2022, de 5 de agosto');
    expect(textoNorma(matriz.corto, 'ca')).toBe('Decret 106/2022, de 5 d\'agost');
    // El inglés no existe como idioma oficial: se usa el castellano
    expect(textoNorma(matriz.corto, 'en')).toBe('Decreto 106/2022, de 5 de agosto');
  });

  it('si no hay versión en el idioma de la app, muestra el idioma oficial, sin traducir', () => {
    const [ct] = normasDe('cataluna', 'eso')!;
    expect(textoNorma(ct.corto, 'es')).toBe('Decret 175/2022, de 27 de setembre');
    expect(textoNorma(ct.corto, 'en')).toBe('Decret 175/2022, de 27 de setembre');
    const [md] = normasDe('madrid', 'eso')!;
    expect(textoNorma(md.corto, 'ca')).toBe('Decreto 65/2022, de 20 de julio');
  });

  it('una cita con un solo decreto no lleva «modificado por»', () => {
    expect(citarNormas(normasDe('cataluna', 'primaria')!, 'ca'))
      .toBe('Decret 175/2022, de 27 de setembre (DOGC núm. 8762, de 29 de setembre de 2022)');
    expect(citarNormas(NORMAS_ESTATALES.eso, 'es'))
      .toBe('Real Decreto 217/2022, de 29 de marzo (BOE núm. 76, de 30 de marzo de 2022)');
  });

  it('con una modificación, cita la matriz y lo que la cambia', () => {
    const normas = normasDe('comunitat-valenciana', 'primaria')!;
    expect(citarNormas(normas, 'es')).toBe(
      'Decreto 106/2022, de 5 de agosto (DOGV núm. 9402, de 10 de agosto de 2022), ' +
      'modificado por Decreto 96/2026, de 19 de junio (DOGV núm. 10391, de 25 de junio de 2026)',
    );
    expect(citarNormas(normas, 'ca')).toBe(
      'Decret 106/2022, de 5 d\'agost (DOGV núm. 9402, de 10 d\'agost de 2022), ' +
      'modificat per Decret 96/2026, de 19 de juny (DOGV núm. 10391, de 25 de juny de 2026)',
    );
  });

  it('una lista vacía no cita nada', () => {
    expect(citarNormas([], 'es')).toBe('');
  });

  it('comunidadPorId devuelve el mismo registro que la lista', () => {
    expect(comunidadPorId('madrid')).toBe(COMUNIDADES.find(c => c.id === 'madrid'));
  });
});

describe('idioma del texto oficial', () => {
  it('la Comunitat Valenciana sigue el idioma de la app, y el inglés usa el castellano', () => {
    expect(idiomaDelTexto('comunitat-valenciana', 'ca')).toBe('ca');
    expect(idiomaDelTexto('comunitat-valenciana', 'es')).toBe('es');
    expect(idiomaDelTexto('comunitat-valenciana', 'en')).toBe('es');
  });

  it('Cataluña siempre en catalán y Madrid siempre en castellano, esté como esté la app', () => {
    for (const idioma of ['es', 'ca', 'en'] as const) {
      expect(idiomaDelTexto('cataluna', idioma)).toBe('ca');
      expect(idiomaDelTexto('madrid', idioma)).toBe('es');
    }
  });

  it('sin decreto registrado, castellano (es el idioma del estatal)', () => {
    expect(idiomaDelTexto('andalucia', 'ca')).toBe('es');
    expect(idiomaDelTexto('fuera', 'en')).toBe('es');
  });
});
