// @vitest-environment jsdom
/**
 * La clase activa en una pantalla: se abre con la regla (`lib/claseActiva.ts`), el selector marca la
 * clase de ahora y lo que el docente elige queda para la siguiente pantalla.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n';
import { ClaseActiva } from '../components/ClaseActiva';
import { ClassChips } from '../components/ui/ClassChips';
import { useClaseActiva, useFijarClase } from './useClaseActiva';
import { atenderClasePedida, recordarClase, ultimaClase } from '../lib/claseActiva';
import type { Class, ScheduleBlock } from '../types';

const clase = (id: string, name: string) => ({ id, name, subject: '', subjects: [], room: '', color: '#000', etapa: 'eso' }) as unknown as Class;
const bloque = (class_id: string, day: number, time_start: string, time_end: string): ScheduleBlock =>
  ({ id: `${class_id}${day}${time_start}`, class_id, day, time_start, time_end, subject: '', room: '', color: '' });
const clases = [clase('a', '1º A'), clase('b', '2º B'), clase('c', '3º C')];
// Martes 13-10-2026: «2º B» de 8:30 a 9:25 y «3º C» de 11:00 a 11:55
const horario = [bloque('b', 2, '08:30', '09:25'), bloque('c', 2, '11:00', '11:55')];

/** Una pantalla cualquiera con selector de clase. */
function Pantalla({ pedida, lista = clases }: { pedida?: string; lista?: Class[] }) {
  const [id, setId] = useClaseActiva(lista, pedida);
  return <ClassChips classes={lista} value={id} onChange={setId} />;
}
/** Una tarjeta que lleva a otra pantalla con su clase puesta. */
function Tarjeta({ id }: { id: string }) {
  const fijar = useFijarClase();
  return <button type="button" onClick={() => fijar(id)}>ir</button>;
}
let perfil = 0;
const montar = (hijos: React.ReactNode, p = `p${perfil}`) => render(
  <I18nProvider><ClaseActiva perfil={p} classes={clases} blocks={horario}>{hijos}</ClaseActiva></I18nProvider>,
);
const elegida = () => screen.getAllByRole('button', { pressed: true }).map(b => b.textContent);
const aLas = (h: number, m: number) => vi.setSystemTime(new Date(2026, 9, 13, h, m));

beforeEach(() => {
  perfil += 1; // cada prueba, un perfil: el recuerdo también vive en memoria
  localStorage.clear();
  atenderClasePedida();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('una pantalla con selector de clase', () => {
  it('se abre en la clase que está en marcha y el selector la marca', () => {
    aLas(9, 0);
    montar(<Pantalla />);
    expect(elegida()).toEqual([expect.stringContaining('2º B')]);
    expect(screen.getByRole('button', { name: /2º B.*Ahora, según tu horario/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: '1º A' })).toBeTruthy(); // las demás, sin marca
  });

  it('con la clase a punto de empezar, también; y lo dice', () => {
    aLas(10, 55);
    montar(<Pantalla />);
    expect(elegida()).toEqual([expect.stringContaining('3º C')]);
    expect(screen.getByRole('button', { name: /3º C.*Empieza a las 11:00, según tu horario/ })).toBeTruthy();
  });

  it('sin clase en marcha, la última que se eligió en cualquier pantalla', async () => {
    const user = userEvent.setup();
    aLas(10, 0);
    const primera = montar(<Pantalla />);
    expect(elegida()).toEqual(['3º C']); // sin recuerdo: la siguiente de hoy
    await user.click(screen.getByRole('button', { name: '1º A' }));
    expect(ultimaClase(`p${perfil}`)).toBe('a');
    primera.unmount();
    // Otra pantalla, después
    montar(<Pantalla />);
    expect(elegida()).toEqual(['1º A']);
  });

  it('la clase que se abre por descarte no pisa la última elegida', () => {
    aLas(13, 0);
    recordarClase(`p${perfil}`, 'c');
    // Esta pantalla no ofrece «3º C»: abre la primera de las suyas, y el recuerdo sigue siendo «3º C»
    montar(<Pantalla lista={clases.slice(0, 2)} />);
    expect(elegida()).toEqual(['1º A']);
    expect(ultimaClase(`p${perfil}`)).toBe('c');
  });

  it('la clase de ahora queda como la última: tras el timbre se sigue con ella', () => {
    aLas(9, 0);
    const enClase = montar(<Pantalla />);
    enClase.unmount();
    aLas(9, 40); // ya ha terminado y la siguiente queda lejos
    montar(<Pantalla />);
    expect(elegida()).toEqual(['2º B']);
  });

  it('una tarjeta que fija su clase manda sobre el horario, una sola vez', async () => {
    const user = userEvent.setup();
    aLas(9, 0);
    const inicio = montar(<Tarjeta id="a" />);
    await user.click(screen.getByRole('button', { name: 'ir' }));
    inicio.unmount();
    const cuaderno = montar(<Pantalla />);
    expect(elegida()).toEqual(['1º A']);
    cuaderno.unmount();
    // La siguiente pantalla vuelve a la regla: hay clase en marcha
    montar(<Pantalla />);
    expect(elegida()).toEqual([expect.stringContaining('2º B')]);
  });

  it('un enlace de una pantalla a otra lleva la clase que se estaba viendo', async () => {
    const user = userEvent.setup();
    function ConEnlace() {
      const [id, setId, llevarClase] = useClaseActiva(clases);
      return <><ClassChips classes={clases} value={id} onChange={setId} /><button type="button" onClick={llevarClase}>Ir al Cuaderno</button></>;
    }
    aLas(9, 0);
    const actitud = montar(<ConEnlace />);
    await user.click(screen.getByRole('button', { name: '3º C' }));
    await user.click(screen.getByRole('button', { name: 'Ir al Cuaderno' }));
    actitud.unmount();
    montar(<Pantalla />);
    expect(elegida()).toEqual(['3º C']); // y no «2º B», que es la que está en marcha
  });

  it('la clase que pide la propia pantalla manda sobre el horario', () => {
    aLas(9, 0);
    montar(<Pantalla pedida="c" />);
    expect(elegida()).toEqual(['3º C']);
  });

  it('cada perfil recuerda su clase', async () => {
    const user = userEvent.setup();
    aLas(13, 0);
    const uno = montar(<Pantalla />, 'perfil-uno');
    await user.click(screen.getByRole('button', { name: '2º B' }));
    uno.unmount();
    montar(<Pantalla />, 'perfil-dos');
    expect(elegida()).toEqual(['1º A']);
  });

  it('sin el proveedor (una pantalla suelta) abre la primera clase y deja elegir', async () => {
    const user = userEvent.setup();
    aLas(9, 0);
    render(<I18nProvider><Pantalla /></I18nProvider>);
    expect(elegida()).toEqual(['1º A']);
    await user.click(screen.getByRole('button', { name: '3º C' }));
    expect(elegida()).toEqual(['3º C']);
  });
});

describe('el selector con muchas clases (desplegable)', () => {
  const muchas = [...clases, ...[4, 5, 6, 7].map(n => clase(`x${n}`, `${n}º X`))];
  function Muchas() {
    const [id, setId] = useClaseActiva(muchas);
    return <ClassChips classes={muchas} value={id} onChange={setId} />;
  }
  const montarMuchas = () => render(
    <I18nProvider><ClaseActiva perfil={`p${perfil}`} classes={muchas} blocks={horario}><Muchas /></ClaseActiva></I18nProvider>,
  );

  it('marca la clase de ahora y, si se mira otra, ofrece volver a ella con un toque', async () => {
    const user = userEvent.setup();
    aLas(9, 0);
    montarMuchas();
    const sel = screen.getByRole('combobox') as HTMLSelectElement;
    expect(sel.value).toBe('b');
    expect([...sel.options].find(o => o.value === 'b')?.textContent).toBe('2º B'); // elegida, la marca va al lado
    expect(screen.queryByRole('button', { name: /Ir a la clase de ahora/ })).toBeNull();
    expect(screen.getByText('Ahora, según tu horario')).toBeTruthy();
    await user.selectOptions(sel, 'a');
    expect(sel.value).toBe('a');
    expect([...sel.options].find(o => o.value === 'b')?.textContent).toBe('● 2º B'); // en la lista, con su punto
    await user.click(screen.getByRole('button', { name: /Ir a la clase de ahora:.*2º B/ }));
    expect(sel.value).toBe('b');
  });

  it('fuera de horario no marca ninguna', () => {
    aLas(13, 0);
    montarMuchas();
    expect(screen.queryByText('Ahora')).toBeNull();
    expect(screen.queryByRole('button', { name: /Ir a la clase de ahora/ })).toBeNull();
  });
});
