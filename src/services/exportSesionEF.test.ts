import { describe, it, expect } from 'vitest';
import { buildSesionHtml } from './exportSesionEF';
import type { SesionEF } from '../types/ef';

const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
const sesion = (p: Partial<SesionEF> = {}): SesionEF => ({
  id: 's1', titulo: 'Voleibol', objetivo: 'Tocar de dedos', calentamiento: '', principal: 'Parejas', calma: '', material: '', inclusion: '', planB: '', ...p,
});

describe('la sesión en PDF', () => {
  it('sin imágenes no hay apartado de imágenes', () => {
    expect(buildSesionHtml(sesion(), { criterios: [] }, 'es')).not.toContain('class="imagenes"');
  });

  it('las imágenes salen con su pie, en el orden en que están', () => {
    const html = buildSesionHtml(sesion({ imagenes: [
      { id: 'a', src: JPG, ancho: 10, alto: 10, pie: 'Colocación' },
      { id: 'b', src: JPG, ancho: 10, alto: 10 },
    ] }), { criterios: [] }, 'es');
    expect(html).toContain('<h2>Imágenes</h2>');
    expect(html.match(/<figure>/g)).toHaveLength(2);
    expect(html.indexOf('Colocación')).toBeLessThan(html.indexOf('</figure>', html.indexOf('<figure>', html.indexOf('</figure>'))));
    expect(html.match(/<figcaption>/g)).toHaveLength(1);
    expect(html).toContain('class="rejilla"');
  });

  it('con una sola imagen, ocupa todo el ancho', () => {
    expect(buildSesionHtml(sesion({ imagenes: [{ id: 'a', src: JPG, ancho: 1, alto: 1 }] }), { criterios: [] }, 'es')).toContain('class="rejilla una"');
  });

  it('el pie se escapa y una dirección que no es una imagen guardada no entra', () => {
    const html = buildSesionHtml(sesion({ imagenes: [
      { id: 'a', src: JPG, ancho: 1, alto: 1, pie: '<script>alert(1)</script> "x"' },
      { id: 'b', src: 'https://ejemplo.com/a.png', ancho: 1, alto: 1 },
      { id: 'c', src: 'javascript:alert(1)', ancho: 1, alto: 1 },
    ] }), { criterios: [] }, 'es');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('ejemplo.com');
    expect(html).not.toContain('javascript:');
    expect(html.match(/<figure>/g)).toHaveLength(1);
  });

  it('el apartado va después del plan B y se traduce', () => {
    const s = sesion({ planB: 'En el porche', imagenes: [{ id: 'a', src: JPG, ancho: 1, alto: 1 }] });
    const es = buildSesionHtml(s, { criterios: [] }, 'es');
    expect(es.indexOf('En el porche')).toBeLessThan(es.indexOf('class="imagenes"'));
    expect(buildSesionHtml(s, { criterios: [] }, 'en')).toContain('<h2>Images</h2>');
  });
});
