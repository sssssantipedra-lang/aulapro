// @vitest-environment jsdom
/**
 * La pantalla unida al historial del navegador, con el historial de verdad de jsdom: cambiar de pantalla añade una
 * entrada, atrás y adelante cambian de pantalla, una ventana abierta se cierra en vez de cambiar, y el perfil manda
 * sobre lo que se puede abrir. Las direcciones y las decisiones, en `lib/ruta.test.ts`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { TipoDocente } from '../lib/tipoDocente';
import { requestAlumno, takeAlumno } from '../lib/apoyoNav';
import { olvidarRuta, useRuta } from './useRuta';

type Props = { profileId: string | null; tipo: TipoDocente | null };
const AULA: Props = { profileId: 'p1', tipo: 'aula' };
const APOYO: Props = { profileId: 'p1', tipo: 'apoyo' };

const montar = (props: Props) => renderHook((p: Props) => useRuta(p), { initialProps: props });
/** El docente toca la pantalla: lo que venga después es una visita suya, no un rebote. */
const tocar = () => act(() => { window.dispatchEvent(new Event('pointerdown')); });
const esperar = () => act(() => new Promise<void>(r => setTimeout(r, 30)));
const atras = async () => { window.history.back(); await esperar(); };
const adelante = async () => { window.history.forward(); await esperar(); };
const empezarEn = (hash: string) => { window.history.replaceState(null, '', `/${hash}`); };

beforeAll(() => {
  // La primera vez que se monta usa la dirección con la que se cargó la página; después, la del momento
  montar(AULA);
  cleanup();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  takeAlumno();
});

describe('la pantalla y el historial', () => {
  it('cambiar de pantalla añade una entrada con su dirección; atrás y adelante cambian de pantalla', async () => {
    empezarEn('');
    const { result } = montar(AULA);
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('');
    tocar();
    act(() => result.current.setSection('notebook'));
    expect(result.current.section).toBe('notebook');
    expect(window.location.hash).toBe('#/cuaderno');
    expect(window.history.state).toEqual({ ap: 1 });
    act(() => result.current.setSection('attendance'));
    expect(window.location.hash).toBe('#/asistencia');
    expect(window.history.state).toEqual({ ap: 2 });

    await atras();
    expect(result.current.section).toBe('notebook');
    await atras();
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('');
    await adelante();
    await adelante();
    expect(result.current.section).toBe('attendance');
    expect(window.location.hash).toBe('#/asistencia');
  });

  it('ir a la pantalla en la que ya se está no añade nada', () => {
    empezarEn('#/cuaderno');
    const { result } = montar(AULA);
    const antes = window.history.length;
    tocar();
    act(() => result.current.setSection('notebook'));
    expect(window.history.length).toBe(antes);
    expect(window.history.state).toEqual({ ap: 0 });
  });

  it('abrir la app con una dirección lleva a su pantalla, y el título de la pestaña la dice', () => {
    empezarEn('#/evaluar/rubricas');
    const { result, unmount } = montar(AULA);
    expect(result.current.section).toBe('rubrics');
    expect(document.title).toBe('Rúbricas · AulaPro');
    unmount();
    expect(document.title).toBe('AulaPro');
  });

  it('recargar: la entrada conserva su orden y la pantalla', () => {
    window.history.replaceState({ ap: 7 }, '', '/#/asistencia');
    const { result } = montar(AULA);
    expect(result.current.section).toBe('attendance');
    tocar();
    act(() => result.current.setSection('agenda'));
    expect(window.history.state).toEqual({ ap: 8 });
  });

  it('una dirección que no existe lleva al Inicio y se corrige', () => {
    empezarEn('#/no-existe');
    const { result } = montar(AULA);
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
  });

  it('una dirección escrita a mano con la app abierta cambia de pantalla', async () => {
    empezarEn('#/cuaderno');
    const { result } = montar(AULA);
    window.location.hash = '#/agenda';
    await esperar();
    expect(result.current.section).toBe('agenda');
    expect(window.history.state).toEqual({ ap: 1 });
    window.location.hash = '#/apoyo/registro';
    await esperar();
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
  });
});

describe('el perfil', () => {
  it('una pantalla que su menú no tiene lleva al Inicio, cuando ya se sabe de qué tipo es', () => {
    empezarEn('#/apoyo/registro');
    const { result, rerender } = montar({ profileId: 'p1', tipo: null });
    // Mientras carga no se decide
    expect(result.current.section).toBe('apoyo-registro');
    rerender(AULA);
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
  });

  it('y si la tiene, se queda', () => {
    empezarEn('#/apoyo/registro');
    const { result, rerender } = montar({ profileId: 'p1', tipo: null });
    rerender(APOYO);
    expect(result.current.section).toBe('apoyo-registro');
    expect(window.location.hash).toBe('#/apoyo/registro');
  });

  it('cambiar de perfil vuelve al Inicio, sin añadir una entrada', () => {
    empezarEn('#/cuaderno');
    const { result, rerender } = montar(AULA);
    expect(result.current.section).toBe('notebook');
    const antes = window.history.length;
    rerender({ profileId: null, tipo: null });
    expect(result.current.section).toBe('dashboard');
    rerender({ profileId: 'p2', tipo: 'aula' });
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
    expect(window.history.length).toBe(antes);
  });

  it('el primer perfil que se abre en la visita respeta la dirección con la que se llegó', () => {
    empezarEn('#/asistencia');
    const { result, rerender } = montar({ profileId: null, tipo: null });
    rerender({ profileId: 'p1', tipo: null });
    rerender(AULA);
    expect(result.current.section).toBe('attendance');
    // El siguiente ya no
    rerender({ profileId: null, tipo: null });
    rerender({ profileId: 'p2', tipo: 'aula' });
    expect(result.current.section).toBe('dashboard');
  });

  it('salir de la cuenta quita la pantalla de la dirección', () => {
    empezarEn('?a=1#/cuaderno');
    olvidarRuta();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?a=1');
  });
});

describe('una ventana abierta', () => {
  function abrirVentana() {
    const fondo = document.createElement('div');
    fondo.className = 'modal-overlay open';
    fondo.addEventListener('click', () => fondo.classList.remove('open'));
    document.body.appendChild(fondo);
    return fondo;
  }

  it('atrás la cierra y la pantalla se queda; el siguiente atrás ya cambia de pantalla', async () => {
    empezarEn('');
    const { result } = montar(AULA);
    tocar();
    act(() => result.current.setSection('notebook'));
    act(() => result.current.setSection('attendance'));
    const ventana = abrirVentana();

    await atras();
    expect(ventana.classList.contains('open')).toBe(false);
    expect(result.current.section).toBe('attendance');
    expect(window.location.hash).toBe('#/asistencia');
    expect(window.history.state).toEqual({ ap: 2 });

    await atras();
    expect(result.current.section).toBe('notebook');
    expect(window.location.hash).toBe('#/cuaderno');
  });

  it('una que no se deja cerrar no deja «atrás» sin hacer nada: a la segunda, cambia de pantalla', async () => {
    empezarEn('');
    const { result } = montar(AULA);
    tocar();
    act(() => result.current.setSection('notebook'));
    act(() => result.current.setSection('attendance'));
    const terca = document.createElement('div');
    terca.className = 'modal-overlay open';
    document.body.appendChild(terca);

    await atras();
    expect(result.current.section).toBe('attendance');
    await atras();
    expect(result.current.section).toBe('notebook');
  });

  it('si el navegador avisa dos veces seguidas del mismo salto, la pantalla no cambia ni un momento', async () => {
    empezarEn('');
    const vistas: string[] = [];
    const { result } = renderHook((p: Props) => { const r = useRuta(p); vistas.push(r.section); return r; }, { initialProps: AULA });
    tocar();
    act(() => result.current.setSection('notebook'));
    act(() => result.current.setSection('attendance'));
    abrirVentana();
    // Como los navegadores que mandan «hashchange» pegado a «popstate», antes de que el salto se haya deshecho
    const repetir = () => window.dispatchEvent(new Event('hashchange'));
    window.addEventListener('popstate', repetir);
    vistas.length = 0;
    await atras();
    window.removeEventListener('popstate', repetir);
    expect(result.current.section).toBe('attendance');
    expect(vistas).not.toContain('notebook');
    // Y después de cambiar de pantalla se puede volver a la misma entrada de antes
    act(() => result.current.setSection('agenda'));
    await atras();
    expect(result.current.section).toBe('attendance');
    await atras();
    expect(result.current.section).toBe('notebook');
  });

  it('un diálogo a pantalla completa que no atiende a Escape se cierra con su botón de «Cerrar»', async () => {
    empezarEn('');
    const { result } = montar(AULA);
    tocar();
    act(() => result.current.setSection('notebook'));
    act(() => result.current.setSection('resources'));
    document.body.innerHTML = '<div class="mem-overlay" role="dialog" aria-modal="true"><button aria-label="Barajar de nuevo"></button><button id="salir" aria-label="Salir"></button></div>';
    const dialogo = document.querySelector('.mem-overlay')!;
    document.getElementById('salir')!.addEventListener('click', () => dialogo.remove());

    await atras();
    expect(document.querySelector('.mem-overlay')).toBeNull();
    expect(result.current.section).toBe('resources');
    expect(window.location.hash).toBe('#/documentos/recursos');
    await atras();
    expect(result.current.section).toBe('notebook');
  });

  it('las ventanas cerradas, que siguen montadas, no cuentan', async () => {
    empezarEn('');
    const { result } = montar(AULA);
    tocar();
    act(() => result.current.setSection('notebook'));
    document.body.innerHTML = '<div class="modal-overlay"><div role="dialog" aria-modal="true"></div></div>';
    await atras();
    expect(result.current.section).toBe('dashboard');
  });
});

describe('una pantalla que manda a otra sin que el docente toque nada', () => {
  it('sustituye la entrada en vez de añadir otra: atrás no vuelve a la que rebota', async () => {
    empezarEn('');
    const { result } = montar(APOYO);
    tocar();
    act(() => result.current.setSection('apoyo-alumnado'));
    act(() => { requestAlumno('a1'); result.current.setSection('apoyo-alumno'); });
    act(() => result.current.setSection('agenda'));
    expect(window.history.state).toEqual({ ap: 3 });

    // Se vuelve a la página del alumno, que ya no existe, y la página manda a la lista por su cuenta
    await atras();
    expect(result.current.section).toBe('apoyo-alumno');
    act(() => result.current.setSection('apoyo-alumnado'));
    expect(window.location.hash).toBe('#/apoyo/alumnado');
    expect(window.history.state).toEqual({ ap: 2 });

    await atras();
    expect(result.current.section).toBe('apoyo-alumnado');
    expect(window.history.state).toEqual({ ap: 1 });
    await atras();
    expect(result.current.section).toBe('dashboard');
  });

  it('con `sustituir` tampoco se añade, aunque el docente haya tocado', () => {
    empezarEn('#/cuaderno');
    const { result } = montar(AULA);
    tocar();
    const antes = window.history.length;
    act(() => result.current.setSection('dashboard', { sustituir: true }));
    expect(result.current.section).toBe('dashboard');
    expect(window.location.hash).toBe('#/inicio');
    expect(window.history.length).toBe(antes);
  });
});

describe('la página de un alumno de apoyo', () => {
  it('la entrada guarda qué alumno era, fuera de la dirección, y al volver se abre la suya', async () => {
    empezarEn('');
    const { result } = montar(APOYO);
    tocar();
    act(() => result.current.setSection('apoyo-alumnado'));
    act(() => { requestAlumno('alu-7', 'programa'); result.current.setSection('apoyo-alumno'); });
    expect(window.location.hash).toBe('#/apoyo/alumno');
    expect(window.location.href).not.toContain('alu-7');
    expect(window.history.state).toEqual({ ap: 2, alumno: { alumnoId: 'alu-7', pestana: 'programa' } });
    // El pedido sigue ahí para la página, que es quien lo gasta
    expect(takeAlumno()).toEqual({ alumnoId: 'alu-7', pestana: 'programa' });

    act(() => result.current.setSection('apoyo-registro'));
    await atras();
    expect(result.current.section).toBe('apoyo-alumno');
    expect(takeAlumno()).toEqual({ alumnoId: 'alu-7', pestana: 'programa' });
  });

  it('saltar de la página de un alumno a la de otro (dos entradas de una vez) avisa para montarla de nuevo', async () => {
    empezarEn('');
    const { result } = montar(APOYO);
    tocar();
    act(() => { requestAlumno('alu-1'); result.current.setSection('apoyo-alumno'); });
    takeAlumno();
    act(() => result.current.setSection('apoyo-registro'));
    act(() => { requestAlumno('alu-2', 'sesiones'); result.current.setSection('apoyo-alumno'); });
    takeAlumno();
    const antes = result.current.llegada;

    window.history.go(-2);
    await esperar();
    expect(result.current.section).toBe('apoyo-alumno');
    expect(window.history.state).toEqual({ ap: 1, alumno: { alumnoId: 'alu-1', pestana: 'resumen' } });
    // La pantalla es la misma: sin esto la página seguiría con el segundo alumno
    expect(result.current.llegada).not.toBe(antes);
    expect(takeAlumno()).toEqual({ alumnoId: 'alu-1', pestana: 'resumen' });

    // Volver de otra pantalla no lo necesita: la página se monta sola
    const despues = result.current.llegada;
    await adelante();
    expect(result.current.section).toBe('apoyo-registro');
    await atras();
    expect(result.current.section).toBe('apoyo-alumno');
    expect(result.current.llegada).toBe(despues);
  });

  it('recargar con ella abierta la vuelve a pedir; sin saber qué alumno, se abre la lista', () => {
    window.history.replaceState({ ap: 4, alumno: { alumnoId: 'alu-7', pestana: 'sesiones' } }, '', '/#/apoyo/alumno');
    const uno = montar(APOYO);
    expect(uno.result.current.section).toBe('apoyo-alumno');
    expect(takeAlumno()).toEqual({ alumnoId: 'alu-7', pestana: 'sesiones' });
    uno.unmount();

    empezarEn('#/apoyo/alumno');
    const otro = montar(APOYO);
    expect(otro.result.current.section).toBe('apoyo-alumnado');
    expect(window.location.hash).toBe('#/apoyo/alumnado');
    expect(takeAlumno()).toBeNull();
  });
});
