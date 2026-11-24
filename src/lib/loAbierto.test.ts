// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cerrarLoAbierto, loAbierto } from './loAbierto';

afterEach(() => { document.body.innerHTML = ''; });

function poner(html: string) {
  document.body.innerHTML = html;
}

describe('lo que hay abierto por encima de la pantalla', () => {
  it('sin nada abierto, nada', () => {
    poner('<main><p>Cuaderno</p></main>');
    expect(loAbierto(document)).toBeNull();
    expect(cerrarLoAbierto(document)).toBeNull();
  });

  it('una ventana cerrada sigue montada y no cuenta, ni su diálogo', () => {
    poner('<div class="modal-overlay"><div class="modal" role="dialog" aria-modal="true"></div></div>');
    expect(loAbierto(document)).toBeNull();
  });

  it('una ventana abierta se cierra tocando su fondo', () => {
    poner('<div class="modal-overlay open" id="v"><div class="modal" role="dialog" aria-modal="true"></div></div>');
    const fondo = document.getElementById('v')!;
    const toque = vi.fn();
    fondo.addEventListener('click', e => { if (e.target === e.currentTarget) toque(); });
    expect(cerrarLoAbierto(document)).toBe(fondo);
    expect(toque).toHaveBeenCalledTimes(1);
  });

  it('con dos ventanas abiertas se cierra la de arriba (la última)', () => {
    poner('<div class="modal-overlay open" id="a"></div><div class="modal-overlay" id="b"></div><div class="modal-overlay open" id="c"></div>');
    expect(loAbierto(document)?.id).toBe('c');
  });

  it('el buscador y el menú abierto por encima se cierran tocando su fondo', () => {
    poner('<div class="bq-fondo" id="b"><div class="bq" role="dialog" aria-modal="true"></div></div>');
    const toque = vi.fn();
    document.getElementById('b')!.addEventListener('click', toque);
    expect(cerrarLoAbierto(document)?.id).toBe('b');
    expect(toque).toHaveBeenCalledTimes(1);

    poner('<nav class="sidebar overlay"></nav><div class="sb-backdrop" id="m"></div><main></main>');
    const otro = vi.fn();
    document.getElementById('m')!.addEventListener('click', otro);
    expect(cerrarLoAbierto(document)?.id).toBe('m');
    expect(otro).toHaveBeenCalledTimes(1);
  });

  it('un diálogo a pantalla completa se cierra con Escape, que llega hasta la ventana', () => {
    poner('<main><div class="tip-overlay" role="dialog" aria-modal="true" id="t"></div></main>');
    const tecla = vi.fn();
    const oir = (e: KeyboardEvent) => { if (e.key === 'Escape') tecla(); };
    window.addEventListener('keydown', oir);
    expect(cerrarLoAbierto(document)?.id).toBe('t');
    window.removeEventListener('keydown', oir);
    expect(tecla).toHaveBeenCalledTimes(1);
  });

  it('un diálogo que no atiende a Escape (el Memory, la agenda visual que se enseña) se cierra con su botón de cerrar', () => {
    poner(`<main><div class="ag-show" role="dialog" aria-modal="true" id="a">
      <button type="button">Volver a empezar</button>
      <button type="button" id="c"><svg></svg>Cerrar</button>
      <button type="button" id="otro" aria-label="Cerrar">x</button>
    </div></main>`);
    const cerrar = vi.fn();
    const otro = vi.fn();
    const tecla = vi.fn();
    document.getElementById('c')!.addEventListener('click', cerrar);
    document.getElementById('otro')!.addEventListener('click', otro);
    window.addEventListener('keydown', tecla);
    expect(cerrarLoAbierto(document, null, ['Cerrar', 'Salir'])?.id).toBe('a');
    window.removeEventListener('keydown', tecla);
    // Solo el primero, y sin mandar además Escape: se cerraría dos veces
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(otro).not.toHaveBeenCalled();
    expect(tecla).not.toHaveBeenCalled();
  });

  it('el botón de cerrar se reconoce también por su nombre accesible, y en el idioma de la app', () => {
    poner('<div class="mem-overlay" role="dialog" aria-modal="true"><button aria-label="Barajar de nuevo"></button><button id="s" aria-label="Sortir"></button></div>');
    const salir = vi.fn();
    document.getElementById('s')!.addEventListener('click', salir);
    cerrarLoAbierto(document, null, ['Tancar', 'Sortir']);
    expect(salir).toHaveBeenCalledTimes(1);
  });

  it('sin botón de cerrar (o con él desactivado), Escape', () => {
    poner('<div class="tip-overlay" role="dialog" aria-modal="true" id="t"><button disabled aria-label="Cerrar"></button><button>Siguiente</button></div>');
    const tecla = vi.fn();
    const oir = (e: KeyboardEvent) => { if (e.key === 'Escape') tecla(); };
    window.addEventListener('keydown', oir);
    expect(cerrarLoAbierto(document, null, ['Cerrar', 'Salir'])?.id).toBe('t');
    window.removeEventListener('keydown', oir);
    expect(tecla).toHaveBeenCalledTimes(1);
  });

  it('una ventana de siempre se sigue cerrando por su fondo, aunque dentro tenga un botón «Cerrar»', () => {
    poner('<div class="modal-overlay open" id="v"><div class="modal" role="dialog" aria-modal="true"><button id="x" aria-label="Cerrar"></button></div></div>');
    const fondo = vi.fn();
    const boton = vi.fn();
    document.getElementById('v')!.addEventListener('click', e => { if (e.target === e.currentTarget) fondo(); });
    document.getElementById('x')!.addEventListener('click', boton);
    expect(cerrarLoAbierto(document, null, ['Cerrar', 'Salir'])?.id).toBe('v');
    expect(fondo).toHaveBeenCalledTimes(1);
    expect(boton).not.toHaveBeenCalled();
  });

  it('una vista previa abierta desde una ventana: primero la vista previa, y la ventana se queda', () => {
    poner(`
      <div class="modal-overlay open" id="v"><div class="modal" role="dialog" aria-modal="true"></div></div>
      <div class="previa"><div role="dialog" aria-modal="true" id="p"></div></div>`);
    const toque = vi.fn();
    document.getElementById('v')!.addEventListener('click', toque);
    expect(cerrarLoAbierto(document)?.id).toBe('p');
    expect(toque).not.toHaveBeenCalled();
  });

  it('lo que no se dejó cerrar a la primera no se vuelve a intentar: «atrás» no se queda sin hacer nada', () => {
    poner('<div class="modal-overlay open" id="v"></div>');
    const fondo = document.getElementById('v')!;
    const primero = cerrarLoAbierto(document);
    expect(primero).toBe(fondo);
    // Sigue abierta (estaba a medio guardar): la segunda vez se deja pasar
    expect(cerrarLoAbierto(document, primero)).toBeNull();
    // Pero otra ventana distinta sí se cierra
    fondo.insertAdjacentHTML('afterend', '<div class="modal-overlay open" id="w"></div>');
    expect(cerrarLoAbierto(document, primero)?.id).toBe('w');
  });
});
