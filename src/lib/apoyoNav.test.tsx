// @vitest-environment jsdom
/**
 * Los saltos entre pantallas de PT y AL: la pantalla recibe lo pedido aunque
 * React la dibuje dos veces (modo estricto, o un dibujo descartado y repetido)
 * y lo olvida en cuanto se monta, para que la siguiente vez abra normal.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { requestAlumno, takeAlumno, useAlumnoPedido } from './apoyoNav';

afterEach(cleanup);

function Pantalla() {
  const pedido = useAlumnoPedido();
  return <p>{pedido ? `${pedido.alumnoId} · ${pedido.pestana}` : 'sin pedido'}</p>;
}

describe('pedidos entre pantallas', () => {
  it('llegan aunque la pantalla se dibuje dos veces, y se olvidan al montarse', () => {
    requestAlumno('a1', 'programa');
    render(<StrictMode><Pantalla /></StrictMode>);
    expect(screen.getByText('a1 · programa')).toBeTruthy();
    expect(takeAlumno()).toBeNull();
    cleanup();
    render(<StrictMode><Pantalla /></StrictMode>);
    expect(screen.getByText('sin pedido')).toBeTruthy();
  });
});
