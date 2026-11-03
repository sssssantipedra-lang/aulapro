import { describe, expect, it } from 'vitest';
import { quitarDatosDeSalud as q, textoLibreParaIA, quitarIdentificadores } from './documentoParaIA';
import { alumnoParaIA } from '../services/apoyoIA';
import type { AlumnoApoyo } from '../types/apoyo';

// Revisión del abogado del dueño (3-11-2026): ningún dato de salud del alumnado va a la IA
describe('sin datos de salud a la IA', () => {
  it('quita diagnósticos, trastornos, discapacidades, síndromes y medicación', () => {
    expect(q('Dislexia y TDAH')).toBe('[dato de salud]');
    expect(q('TEA; hemiparesia leve en el lado derecho')).toBe('[dato de salud] en el lado derecho');
    expect(q('Trastorno del espectro del autismo (TEA). Necesita anticipación y apoyo visual.')).toBe('[dato de salud]. Necesita anticipación y apoyo visual.');
    expect(q('Discapacidad intelectual leve, necesita instrucciones cortas')).toBe('[dato de salud], necesita instrucciones cortas');
    expect(q('Tiene diagnóstico de dislexia desde 2.º: le ayudan las letras grandes')).toBe('Tiene [dato de salud] desde 2.º: le ayudan las letras grandes');
    expect(q('Toma Concerta por la mañana; trabaja mejor a primera hora')).toBe('Toma [dato de salud] por la mañana; trabaja mejor a primera hora');
    expect(q('Síndrome de Down. Le gusta la música')).toBe('[dato de salud]. Le gusta la música');
    expect(q('CI 68, nivel de 2.º de Primaria')).toBe('[dato de salud], nivel de 2.º de Primaria');
    expect(q('Usa audífonos; hablarle de frente')).toBe('Usa [dato de salud]; hablarle de frente');
  });

  it('en catalán y en inglés', () => {
    expect(q('Té dislèxia i TDAH; li costa la lectura')).not.toMatch(/dislèxia|TDAH/);
    expect(q('Trastorn de l’espectre autista. Necessita suport visual')).toBe('[dato de salud]. Necessita suport visual');
    expect(q('Diagnosed with ADHD; needs short instructions')).not.toMatch(/ADHD|Diagnos/i);
    expect(q('Autism spectrum disorder, needs visual support')).not.toMatch(/autism|disorder/i);
  });

  it('deja lo que el alumno necesita en el aula', () => {
    for (const s of [
      'Necesita más tiempo en los exámenes y sentarse cerca de la pizarra',
      'Le cuesta la comprensión lectora; le ayudan los apoyos visuales',
      'Li costa la lectura. Té un toc de humor',
      'Trabaja mejor en pareja y con tareas cortas',
    ]) expect(q(s)).toBe(s);
  });

  it('se aplica a los textos libres y a los documentos del alumnado', () => {
    expect(textoLibreParaIA('TDAH. Teléfono de la madre 612 345 678')).not.toMatch(/TDAH|612/);
    expect(quitarIdentificadores('Valoración: presenta dislexia. Necesita letra grande.')).not.toMatch(/dislexia/);
  });

  it('la ficha de PT y AL no envía las categorías NEAE ni el diagnóstico', () => {
    const a = {
      id: 'a', nombre: 'Alumno 1', categorias: ['Trastorno del espectro del autismo (TEA)'], diagnostico: 'TEA grado 1',
      necesidades: 'TEA. Necesita anticipación con agenda visual', notas: 'Toma metilfenidato', programas: [],
    } as unknown as AlumnoApoyo;
    const texto = alumnoParaIA(a, () => '');
    expect(texto).not.toMatch(/TEA|autismo|metilfenidato|grado 1/);
    expect(texto).toContain('Necesita anticipación con agenda visual');
  });
});
