// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImagenesSesion, AvisoDeSoltar } from './ImagenesSesion';
import { useEntradaDeImagenes } from '../../hooks/useEntradaDeImagenes';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../ui/Toast';
import type { ImagenSesion } from '../../types/ef';

// Reducir una imagen necesita un lienzo, que jsdom no tiene: aquí se da por hecho
vi.mock('../../lib/imagenesSesion', async importOriginal => {
  const real = await importOriginal<typeof import('../../lib/imagenesSesion')>();
  let n = 0;
  return {
    ...real,
    prepararNuevas: async (blobs: Blob[], sitio: number) => {
      const caben = blobs.slice(0, Math.max(0, sitio));
      return {
        nuevas: caben.map(() => ({ id: `n${++n}`, src: 'data:image/jpeg;base64,/9j/4AAQ', ancho: 100, alto: 80 })),
        porElTope: blobs.length - caben.length, ilegibles: 0,
      };
    },
  };
});
afterEach(cleanup);

let actuales: ImagenSesion[] = [];
function Editor({ activo, inicial }: { activo: boolean; inicial: ImagenSesion[] }) {
  const [imagenes, setImagenes] = useState<ImagenSesion[]>(inicial);
  useEffect(() => { actuales = imagenes; });
  const entrada = useEntradaDeImagenes(imagenes, f => setImagenes(f), activo);
  return (
    <div data-testid="editor" {...entrada.arrastre}>
      <AvisoDeSoltar visible={entrada.arrastrando} />
      <textarea aria-label="texto" />
      <ImagenesSesion entrada={entrada} />
    </div>
  );
}
// El hook va dentro de los proveedores, como en la pantalla de Sesiones
function Harness({ activo = true, inicial = [] as ImagenSesion[] }) {
  return <I18nProvider><ToastProvider><Editor activo={activo} inicial={inicial} /></ToastProvider></I18nProvider>;
}

const png = (n = 'a.png') => new File(['x'], n, { type: 'image/png' });
const una = (id: string, pie?: string): ImagenSesion => ({ id, src: 'data:image/jpeg;base64,/9j/4AAQ', ancho: 10, alto: 10, pie });

/** Un pegado como el del navegador: un evento con su portapapeles. */
function pegar(objetivo: EventTarget, datos: { files?: File[]; texto?: string; html?: string }) {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: {
      files: datos.files ?? [], items: [], types: [],
      getData: (t: string) => (t === 'text/plain' ? datos.texto ?? '' : t === 'text/html' ? datos.html ?? '' : ''),
    },
  });
  objetivo.dispatchEvent(e);
  return e;
}

describe('imágenes de una sesión', () => {
  it('pegar una imagen (Ctrl+V) la añade, sin tener que enfocar nada', async () => {
    render(<Harness />);
    const e = pegar(document.body, { files: [png()] });
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(actuales).toHaveLength(1));
    expect(screen.getByRole('img', { name: 'Imagen 1 de la sesión' })).toBeTruthy();
  });

  it('pegar una imagen dentro de un cuadro de texto también vale, si no trae texto', async () => {
    render(<Harness />);
    pegar(screen.getByLabelText('texto'), { files: [png()] });
    await waitFor(() => expect(actuales).toHaveLength(1));
  });

  it('pegar celdas de Excel (texto más una imagen de ellas) pega el texto y no añade la imagen', async () => {
    render(<Harness />);
    const e = pegar(screen.getByLabelText('texto'), { files: [png()], texto: 'a\tb\n1\t2' });
    expect(e.defaultPrevented).toBe(false);
    await new Promise(r => setTimeout(r, 30));
    expect(actuales).toHaveLength(0);
  });

  it('pegar solo texto no se toca', () => {
    render(<Harness />);
    expect(pegar(document.body, { texto: 'hola' }).defaultPrevented).toBe(false);
  });

  it('con otra ventana encima (activo = false) no atiende el pegado', async () => {
    render(<Harness activo={false} />);
    expect(pegar(document.body, { files: [png()] }).defaultPrevented).toBe(false);
  });

  it('arrastrar un archivo sobre el editor avisa y, al soltarlo, lo añade', async () => {
    render(<Harness />);
    const editor = screen.getByTestId('editor');
    fireEvent.dragOver(editor, { dataTransfer: { types: ['Files'], files: [png()], items: [], getData: () => '' } });
    expect(screen.getByText('Suelta la imagen para añadirla')).toBeTruthy();
    fireEvent.drop(editor, { dataTransfer: { types: ['Files'], files: [png()], items: [], getData: () => '' } });
    await waitFor(() => expect(actuales).toHaveLength(1));
    expect(screen.queryByText('Suelta la imagen para añadirla')).toBeNull();
  });

  it('arrastrar un texto no lo toma por una imagen', () => {
    render(<Harness />);
    fireEvent.dragOver(screen.getByTestId('editor'), { dataTransfer: { types: ['text/plain'], files: [], items: [], getData: () => 'hola' } });
    expect(screen.queryByText('Suelta la imagen para añadirla')).toBeNull();
  });

  it('elegir archivos con el botón añade varias a la vez', async () => {
    render(<Harness />);
    await userEvent.upload(screen.getByTestId('imagenes-sesion').querySelector('input[type=file]') as HTMLInputElement, [png('1.png'), png('2.png')]);
    await waitFor(() => expect(actuales).toHaveLength(2));
  });

  it('no caben más de 12: las que sobran se avisan', async () => {
    const llenas = Array.from({ length: 11 }, (_, i) => una(`x${i}`));
    render(<Harness inicial={llenas} />);
    pegar(document.body, { files: [png(), png(), png()] });
    await waitFor(() => expect(actuales).toHaveLength(12));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Solo caben 12 imágenes en una sesión.'));
  });

  it('el pie se escribe, las imágenes se mueven y se quitan', async () => {
    render(<Harness inicial={[una('a'), una('b'), una('c')]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Pie de la imagen 2'), 'Mi pie');
    expect(actuales.find(i => i.id === 'b')?.pie).toBe('Mi pie');

    await user.click(screen.getAllByRole('button', { name: 'Mover antes' })[1]);   // b antes que a
    expect(actuales.map(i => i.id)).toEqual(['b', 'a', 'c']);
    await user.click(screen.getAllByRole('button', { name: 'Mover después' })[1]); // a después de c
    expect(actuales.map(i => i.id)).toEqual(['b', 'c', 'a']);

    await user.click(screen.getByRole('button', { name: 'Quitar la imagen 1' }));
    expect(actuales.map(i => i.id)).toEqual(['c', 'a']);
  });

  it('el primero no se puede mover antes ni el último después', () => {
    render(<Harness inicial={[una('a'), una('b')]} />);
    expect((screen.getAllByRole('button', { name: 'Mover antes' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getAllByRole('button', { name: 'Mover después' })[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
