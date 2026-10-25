// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImagenesDeSesionSda } from './ImagenesDeSesionSda';
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

const una = (id: string, pie?: string): ImagenSesion => ({ id, src: 'data:image/jpeg;base64,/9j/4AAQ', ancho: 10, alto: 10, pie });
const png = (n = 'a.png') => new File(['x'], n, { type: 'image/png' });

/** Dos sesiones juntas, como en una situación de aprendizaje: lo que se añade a una no puede ir a la otra. */
let porSesion: ImagenSesion[][] = [];
function Dos({ inicial }: { inicial: [ImagenSesion[], ImagenSesion[]] }) {
  const [listas, setListas] = useState<ImagenSesion[][]>(inicial);
  useEffect(() => { porSesion = listas; });
  const cambiar = (i: number) => (f: (a: ImagenSesion[]) => ImagenSesion[]) => setListas(prev => prev.map((l, j) => (j === i ? f(l) : l)));
  return (
    <>
      {listas.map((l, i) => (
        <div key={i} data-testid={`sesion-${i + 1}`}>
          <ImagenesDeSesionSda imagenes={l.length ? l : undefined} numero={i + 1} onChange={cambiar(i)}>
            <p>Contenido de la sesión {i + 1}</p>
          </ImagenesDeSesionSda>
        </div>
      ))}
    </>
  );
}
const Harness = ({ inicial = [[], []] as [ImagenSesion[], ImagenSesion[]] }) =>
  <I18nProvider><ToastProvider><Dos inicial={inicial} /></ToastProvider></I18nProvider>;

function pegar(objetivo: EventTarget, datos: { files?: File[]; texto?: string }) {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: { files: datos.files ?? [], items: [], types: [], getData: (t: string) => (t === 'text/plain' ? datos.texto ?? '' : '') },
  });
  objetivo.dispatchEvent(e);
  return e;
}
const soltar = () => ({ dataTransfer: { types: ['Files'], files: [png()], items: [], getData: () => '' } });

describe('imágenes en una sesión de una situación de aprendizaje', () => {
  it('arrastrar una imagen sobre una sesión avisa y la añade solo a esa sesión', async () => {
    render(<Harness />);
    const s2 = screen.getByTestId('sesion-2');
    fireEvent.dragOver(s2.firstElementChild as Element, soltar());
    expect(screen.getByText('Suelta la imagen para añadirla')).toBeTruthy();
    fireEvent.drop(s2.firstElementChild as Element, soltar());
    await waitFor(() => expect(porSesion[1]).toHaveLength(1));
    expect(porSesion[0]).toHaveLength(0);
    expect(screen.queryByText('Suelta la imagen para añadirla')).toBeNull();
    expect(screen.getByRole('img', { name: 'Imagen 1 de la sesión 2' })).toBeTruthy();
  });

  it('arrastrar un texto no lo toma por una imagen', () => {
    render(<Harness />);
    fireEvent.dragOver(screen.getByTestId('sesion-1').firstElementChild as Element, { dataTransfer: { types: ['text/plain'], files: [], items: [], getData: () => 'hola' } });
    expect(screen.queryByText('Suelta la imagen para añadirla')).toBeNull();
  });

  it('«Añadir imagen» abre una zona ya enfocada y el Ctrl+V en ella añade la imagen a esa sesión', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Añadir una imagen a la sesión 2' }));
    const zona = screen.getByRole('group', { name: 'Zona para pegar una imagen en la sesión 2' });
    expect(document.activeElement).toBe(zona);
    const e = pegar(zona, { files: [png()] });
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(porSesion[1]).toHaveLength(1));
    expect(porSesion[0]).toHaveLength(0);
  });

  it('un Ctrl+V fuera de la zona no se atiende: no se sabría a qué sesión va', async () => {
    render(<Harness />);
    expect(pegar(document.body, { files: [png()] }).defaultPrevented).toBe(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Añadir una imagen a la sesión 1' }));
    expect(pegar(document.body, { files: [png()] }).defaultPrevented).toBe(false);
    await new Promise(r => setTimeout(r, 30));
    expect(porSesion.flat()).toHaveLength(0);
  });

  it('pegar solo texto en la zona no se toca', async () => {
    render(<Harness />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Añadir una imagen a la sesión 1' }));
    const zona = screen.getByRole('group', { name: 'Zona para pegar una imagen en la sesión 1' });
    expect(pegar(zona, { texto: 'hola' }).defaultPrevented).toBe(false);
  });

  it('elegir archivos desde la zona añade varias a la vez', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Añadir una imagen a la sesión 1' }));
    await user.upload(screen.getByTestId('sesion-1').querySelector('input[type=file]') as HTMLInputElement, [png('1.png'), png('2.png')]);
    await waitFor(() => expect(porSesion[0]).toHaveLength(2));
  });

  it('el pie se escribe y la imagen se quita, sin tocar la otra sesión', async () => {
    render(<Harness inicial={[[una('a'), una('b')], [una('c')]]} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Pie de la imagen 2 de la sesión 1'), 'Mi pie');
    expect(porSesion[0].find(i => i.id === 'b')?.pie).toBe('Mi pie');
    await user.click(screen.getByRole('button', { name: 'Quitar la imagen 1 de la sesión 1' }));
    expect(porSesion[0].map(i => i.id)).toEqual(['b']);
    expect(porSesion[1].map(i => i.id)).toEqual(['c']);
  });

  it('con 12 imágenes el botón de añadir queda desactivado', () => {
    render(<Harness inicial={[Array.from({ length: 12 }, (_, i) => una(`x${i}`)), []]} />);
    expect((screen.getByRole('button', { name: 'Añadir una imagen a la sesión 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Añadir una imagen a la sesión 2' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no pinta lo que no es una imagen de verdad (un SVG o una dirección web)', () => {
    const raras: ImagenSesion[] = [
      una('ok'),
      { id: 'svg', src: 'data:image/svg+xml;base64,PHN2Zz4=', ancho: 1, alto: 1 },
      { id: 'web', src: 'https://x.com/a.png', ancho: 1, alto: 1 },
    ];
    render(<Harness inicial={[raras, []]} />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
