// @vitest-environment jsdom
/**
 * Sesiones: imágenes pegadas en el editor. Se reducen (aquí, de mentira: jsdom no
 * tiene lienzo), se guardan con la sesión y salen en su vista previa, pero no
 * en el borrador automático.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sesiones } from './Sesiones';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { buildDemoEF } from '../lib/demoEF';
import type { EfData } from '../types/ef';

vi.mock('../lib/imagenesSesion', async importOriginal => {
  const real = await importOriginal<typeof import('../lib/imagenesSesion')>();
  let n = 0;
  return {
    ...real,
    prepararNuevas: async (blobs: Blob[], sitio: number) => ({
      nuevas: blobs.slice(0, Math.max(0, sitio)).map(() => ({ id: `n${++n}`, src: 'data:image/jpeg;base64,/9j/4AAQ', ancho: 100, alto: 80 })),
      porElTope: Math.max(0, blobs.length - Math.max(0, sitio)), ilegibles: 0,
    }),
  };
});

const demo = buildDemoEF(new Date(2026, 9, 5));
const TITULO = 'Voleibol: el toque de dedos';
let ultimo: EfData = demo.ef;

function Harness({ ef0 = demo.ef }: { ef0?: EfData }) {
  const [ef, setEf] = useState(ef0);
  return (
    <I18nProvider>
      <ToastProvider>
        <Sesiones perfil="ef" classes={demo.classes} students={demo.students} scheduleBlocks={demo.blocks} ef={ef}
          onChangeEf={f => setEf(d => { ultimo = f(d); return ultimo; })} comunidad="comunitat-valenciana" />
      </ToastProvider>
    </I18nProvider>
  );
}

beforeEach(() => {
  // La vista previa de un documento mide su hoja con un ResizeObserver, que jsdom no trae
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  localStorage.clear();
  ultimo = demo.ef;
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function abrirSesion(user: ReturnType<typeof userEvent.setup>, ef = demo.ef) {
  const s = ef.sesiones.find(x => x.titulo === TITULO)!;
  const clase = demo.classes.find(c => c.id === s.claseId)!;
  await user.click(screen.getByRole('button', { name: `Abrir las sesiones de ${clase.name}` }));
  await user.click(screen.getByText(TITULO));
  return screen.getByRole('dialog', { name: TITULO });
}

function pegarImagen() {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: { files: [new File(['x'], 'captura.png', { type: 'image/png' })], items: [], types: [], getData: () => '' },
  });
  document.body.dispatchEvent(e);
}

describe('imágenes en una sesión', () => {
  it('se pega una imagen, se guarda con la sesión y sale en la vista previa', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const editor = await abrirSesion(user);
    expect(within(editor).queryByRole('img')).toBeNull();

    pegarImagen();
    await waitFor(() => expect(within(editor).getAllByRole('img')).toHaveLength(1));
    await user.type(within(editor).getByLabelText('Pie de la imagen 1'), 'Colocación de manos');

    await user.click(within(editor).getByRole('button', { name: 'Vista previa' }));
    // La vista previa pinta el HTML del PDF en un iframe: ahí está la imagen con su pie
    await waitFor(() => {
      const html = [...document.querySelectorAll('iframe')].map(f => f.getAttribute('srcdoc') ?? '').join('');
      expect(html).toContain('<figcaption>Colocación de manos</figcaption>');
      expect(html).toContain('src="data:image/jpeg;base64,');
    });
    await user.click(screen.getAllByRole('button', { name: /Cerrar/ }).at(-1)!);

    await user.click(within(screen.getByRole('dialog', { name: TITULO })).getByRole('button', { name: 'Guardar' }));
    const guardada = ultimo.sesiones.find(x => x.titulo === TITULO)!;
    expect(guardada.imagenes).toHaveLength(1);
    expect(guardada.imagenes![0]).toMatchObject({ pie: 'Colocación de manos', ancho: 100, alto: 80 });
    // Las demás sesiones no se tocan
    expect(ultimo.sesiones.filter(x => x.id !== guardada.id)).toEqual(demo.ef.sesiones.filter(x => x.id !== guardada.id));
  });

  it('el borrador automático no lleva las imágenes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const editor = await abrirSesion(user);
    pegarImagen();
    await waitFor(() => expect(within(editor).getAllByRole('img')).toHaveLength(1));
    await user.type(within(editor).getByLabelText('Título'), ' (copia)');
    const borrador = () => Object.entries(localStorage).filter(([k]) => k.includes('borrador')).map(([, v]) => v).join('');
    // El borrador se guarda 1,2 s después del último cambio
    await waitFor(() => expect(borrador()).toContain('(copia)'), { timeout: 4000 });
    expect(borrador()).not.toContain('base64');
  });

  it('una sesión con imágenes las enseña al abrirla y se puede quitar una', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
    const ef0: EfData = { ...demo.ef, sesiones: demo.ef.sesiones.map(s => (s.titulo === TITULO
      ? { ...s, imagenes: [{ id: 'a', src: JPG, ancho: 1, alto: 1, pie: 'Una' }, { id: 'b', src: JPG, ancho: 1, alto: 1, pie: 'Dos' }] } : s)) };
    render(<Harness ef0={ef0} />);
    const editor = await abrirSesion(user, ef0);
    expect(within(editor).getAllByRole('img')).toHaveLength(2);

    await user.click(within(editor).getByRole('button', { name: 'Quitar la imagen 1' }));
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }));
    expect(ultimo.sesiones.find(x => x.titulo === TITULO)!.imagenes?.map(i => i.id)).toEqual(['b']);
  });

  it('quitar la última imagen deja la sesión sin el campo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const JPG = 'data:image/jpeg;base64,/9j/4AAQ';
    const ef0: EfData = { ...demo.ef, sesiones: demo.ef.sesiones.map(s => (s.titulo === TITULO ? { ...s, imagenes: [{ id: 'a', src: JPG, ancho: 1, alto: 1 }] } : s)) };
    render(<Harness ef0={ef0} />);
    const editor = await abrirSesion(user, ef0);
    await user.click(within(editor).getByRole('button', { name: 'Quitar la imagen 1' }));
    await user.click(within(editor).getByRole('button', { name: 'Guardar' }));
    expect('imagenes' in ultimo.sesiones.find(x => x.titulo === TITULO)!).toBe(false);
  });
});
