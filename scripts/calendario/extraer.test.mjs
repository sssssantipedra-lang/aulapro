/**
 * El lector de calendarios escolares con los textos oficiales de varios
 * cursos: lo que saca tiene que ser lo que se comprobó a mano y está en
 * web/sitio/calendario-escolar.json, y si cambia la redacción, decirlo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extraerCV, extraerMadrid, normaCV, normaMadrid, cursoSiguiente, cursoActual } from './extraer.mjs';

const texto = n => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');
const publicado = JSON.parse(readFileSync(new URL('../../web/sitio/calendario-escolar.json', import.meta.url), 'utf8'));
const delArchivo = (comunidad, curso) => {
  const c = publicado.calendarios.find(x => x.comunidad === comunidad && x.curso === curso);
  return { curso, clases: c.clases, vacaciones: c.vacaciones, noLectivos: c.noLectivos };
};

describe('Comunitat Valenciana', () => {
  it('2026-2027: lo mismo que el calendario comprobado a mano (redacción «del 22 de diciembre… al 6 de enero»)', () => {
    const { calendario, fallos } = extraerCV(texto('cv-2026-2027.txt'), '2026-2027');
    expect(fallos).toEqual([]);
    expect(calendario).toEqual(delArchivo('comunitat-valenciana', '2026-2027'));
  });

  it('2025-2026: redacción «desde el 2 al 13 de abril» y un festivo más', () => {
    const { calendario } = extraerCV(texto('cv-2025-2026.txt'), '2025-2026');
    expect(calendario.clases).toEqual({ primaria: { inicio: '2025-09-08', fin: '2026-06-19' }, eso: { inicio: '2025-09-08', fin: '2026-06-19' } });
    expect(calendario.vacaciones).toEqual([
      { nombre: 'Vacaciones de Navidad', desde: '2025-12-23', hasta: '2026-01-06' },
      { nombre: 'Vacaciones de Pascua', desde: '2026-04-02', hasta: '2026-04-13' },
    ]);
    expect(calendario.noLectivos.map(d => `${d.fecha} ${d.nombre}`)).toEqual([
      '2025-10-09 Día de la Comunitat Valenciana', '2025-12-08 Inmaculada Concepción',
      '2026-03-19 San José', '2026-05-01 Día Internacional de los Trabajadores',
    ]);
  });

  it('la cita, en castellano y en valenciano', () => {
    expect(normaCV({
      tituloEs: 'RESOLUCIÓN de 15 de junio de 2026, de la Dirección General de Centros Docentes, por la que se fija el calendario escolar del curso académico 2026-2027 en la Comunitat Valenciana.',
      tituloCa: 'RESOLUCIÓ de 15 de juny de 2026, de la Direcció General de Centres Docents, per la qual es fixa el calendari escolar del curs acadèmic 2026-2027 a la Comunitat Valenciana.',
      numeroDogv: 10387, fechaPublicacion: '18/06/2026',
    })).toEqual(publicado.calendarios.find(c => c.comunidad === 'comunitat-valenciana').norma);
  });

  it('si no encuentra algo, no propone un calendario a medias', () => {
    const { calendario, fallos } = extraerCV(texto('cv-2026-2027.txt').replace(/Vacaciones de Pascua/, 'Vacaciones de primavera'), '2026-2027');
    expect(calendario).toBeNull();
    expect(fallos).toEqual(['no se encuentran las vacaciones de Semana Santa o Pascua']);
  });
});

describe('Comunidad de Madrid', () => {
  it('2026-2027: lo mismo que el calendario comprobado a mano, con «7 y 8 de diciembre» y los días no lectivos', () => {
    const { calendario, fallos } = extraerMadrid(texto('madrid-2026-2027.txt'), '2026-2027');
    expect(fallos).toEqual([]);
    expect(calendario).toEqual(delArchivo('madrid', '2026-2027'));
  });

  it('la cita, con el número y la fecha del boletín', () => {
    expect(normaMadrid({
      titulo: 'Calendario escolar – Orden 2034/2026, de 25 de mayo, de la Consejera de Educación, Ciencia y Universidades, por la que se establece el calendario escolar para el curso 2026/2027',
      numero: 131, fecha: '2026-06-04',
    })).toEqual(publicado.calendarios.find(c => c.comunidad === 'madrid').norma);
  });
});

describe('qué curso buscar', () => {
  it('de septiembre a agosto: en octubre de 2026 y en junio de 2027, el siguiente es el 2027-2028', () => {
    expect(cursoSiguiente(new Date('2026-10-11T12:00:00Z'))).toBe('2027-2028');
    expect(cursoSiguiente(new Date('2027-06-20T12:00:00Z'))).toBe('2027-2028');
    expect(cursoActual(new Date('2027-06-20T12:00:00Z'))).toBe('2026-2027');
  });
});
