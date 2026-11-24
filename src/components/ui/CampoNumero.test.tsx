// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CampoNumero } from './CampoNumero';

afterEach(cleanup);

function Caja({ inicial = 4, min = 1, max = 8 }: { inicial?: number; min?: number; max?: number }) {
  const [n, setN] = useState(inicial);
  return (
    <>
      <CampoNumero aria-label="Alumnos por mesa" value={n} onChange={setN} min={min} max={max} />
      <output data-testid="valor">{n}</output>
    </>
  );
}
const campo = () => screen.getByRole('textbox', { name: 'Alumnos por mesa' }) as HTMLInputElement;
const valor = () => screen.getByTestId('valor').textContent;

describe('CampoNumero', () => {
  it('al borrar la cifra el cuadro se queda en blanco, sin poner un 1, y se puede escribir otro número', () => {
    render(<Caja />);
    fireEvent.change(campo(), { target: { value: '' } });
    expect(campo().value).toBe('');
    expect(valor()).toBe('4');
    fireEvent.change(campo(), { target: { value: '6' } });
    expect(campo().value).toBe('6');
    expect(valor()).toBe('6');
  });

  it('dejarlo vacío y salir devuelve el último número bueno', () => {
    render(<Caja />);
    fireEvent.change(campo(), { target: { value: '' } });
    fireEvent.blur(campo());
    expect(campo().value).toBe('4');
    expect(valor()).toBe('4');
  });

  it('se puede pasar por un número por debajo del mínimo mientras se escribe (45 con mínimo 20)', () => {
    render(<Caja inicial={55} min={20} max={120} />);
    fireEvent.change(campo(), { target: { value: '4' } });
    expect(campo().value).toBe('4');
    expect(valor()).toBe('55');
    fireEvent.change(campo(), { target: { value: '45' } });
    expect(valor()).toBe('45');
  });

  it('fuera del margen se corrige al salir o con Intro', () => {
    render(<Caja />);
    fireEvent.change(campo(), { target: { value: '50' } });
    expect(valor()).toBe('4');
    fireEvent.keyDown(campo(), { key: 'Enter' });
    expect(campo().value).toBe('8');
    expect(valor()).toBe('8');
  });

  it('las flechas suben y bajan sin salirse del margen', () => {
    render(<Caja inicial={7} />);
    fireEvent.keyDown(campo(), { key: 'ArrowUp' });
    expect(valor()).toBe('8');
    fireEvent.keyDown(campo(), { key: 'ArrowUp' });
    expect(valor()).toBe('8');
    fireEvent.keyDown(campo(), { key: 'ArrowDown' });
    expect(valor()).toBe('7');
  });
});

describe('CampoNumero con un dato que puede quedarse sin poner', () => {
  function Horas() {
    const [h, setH] = useState<number | undefined>(3);
    return (
      <>
        <CampoNumero aria-label="Horas" value={h} onChange={setH} onVaciar={() => setH(undefined)} min={0} />
        <output data-testid="valor">{h === undefined ? 'sin poner' : h}</output>
      </>
    );
  }
  it('borrar lo deja sin poner, también al salir, y se puede volver a escribir', () => {
    render(<Horas />);
    const c = screen.getByRole('textbox', { name: 'Horas' }) as HTMLInputElement;
    fireEvent.change(c, { target: { value: '' } });
    expect(valor()).toBe('sin poner');
    fireEvent.blur(c);
    expect(c.value).toBe('');
    fireEvent.change(c, { target: { value: '12' } });
    expect(valor()).toBe('12');
  });
});

describe('CampoNumero con alSalir', () => {
  it('mientras se escribe no avisa (10 pasa por el 1); al salir, sí', () => {
    const cambios: number[] = [];
    function Mesas() {
      const [n, setN] = useState(5);
      return <CampoNumero aria-label="Nº de mesas" value={n} onChange={x => { cambios.push(x); setN(x); }} min={1} max={12} alSalir />;
    }
    render(<Mesas />);
    const c = screen.getByRole('textbox', { name: 'Nº de mesas' }) as HTMLInputElement;
    fireEvent.change(c, { target: { value: '' } });
    fireEvent.change(c, { target: { value: '1' } });
    fireEvent.change(c, { target: { value: '10' } });
    expect(cambios).toEqual([]);
    fireEvent.blur(c);
    expect(cambios).toEqual([10]);
    expect(c.value).toBe('10');
  });
});
