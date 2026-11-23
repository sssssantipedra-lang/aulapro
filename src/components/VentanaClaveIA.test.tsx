// @vitest-environment jsdom
/**
 * La clave de la IA sin salir de la pantalla (20-11-2026): el aviso de que falta la clave abre los pasos en una
 * ventana encima de lo que el docente tenía a medias; sin marcar la casilla de aceptación no se guarda nada; con la
 * clave comprobada la ventana se cierra y la pantalla de debajo activa su botón sin perder lo escrito.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n';
import { ToastProvider } from './ui/Toast';
import { AiKeyNotice } from './ui/AiKeyNotice';
import { Modal } from './ui/Modal';
import { VentanaClaveIA } from './VentanaClaveIA';
import { useHayClaveIA } from '../hooks/useClaveIA';
import { getApiKey, hasApiKey, setApiKey } from '../services/gemini';
import { cerrarClaveIA, ventanaClaveAbierta } from '../lib/claveIA';
import { usoIaAceptado, VERSION_USO_IA } from '../lib/usoIA';
import { loAbierto } from '../lib/loAbierto';

const CLAVE = 'AIzaSyD-clave-de-prueba-0123456789abcdefg';

beforeEach(() => { localStorage.clear(); setApiKey(''); });
afterEach(() => { cleanup(); cerrarClaveIA(); setApiKey(''); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

/** Una pantalla con un formulario a medias dentro de una ventana, como «Nueva rúbrica» en su pestaña de la IA. */
function Pantalla({ onCerrarDeDebajo = () => {} }: { onCerrarDeDebajo?: () => void }) {
  const hayClave = useHayClaveIA();
  const [texto, setTexto] = useState('');
  return (
    <>
      <Modal open onClose={onCerrarDeDebajo} title="Ventana de debajo">
        {!hayClave && <AiKeyNotice message="Falta la clave." action="Configurar la IA" />}
        <textarea aria-label="Contexto" value={texto} onChange={e => setTexto(e.target.value)} />
        <button disabled={!hayClave || !texto.trim()}>Generar</button>
      </Modal>
      <VentanaClaveIA />
    </>
  );
}

const pintar = (onCerrarDeDebajo?: () => void) =>
  render(<I18nProvider><ToastProvider><Pantalla onCerrarDeDebajo={onCerrarDeDebajo} /></ToastProvider></I18nProvider>);

const ventana = () => document.querySelector<HTMLElement>('.vci')!;
const generar = () => screen.getByRole('button', { name: 'Generar' }) as HTMLButtonElement;
const googleContesta = (status: number) => vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));

async function escribirClave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(ventana()).getByRole('button', { name: 'Prefiero escribirla a mano' }));
  await user.type(within(ventana()).getByLabelText('Clave de Google'), CLAVE);
  await user.click(within(ventana()).getByRole('button', { name: 'Guardar' }));
}

describe('la clave de la IA en una ventana sobre la pantalla en curso', () => {
  it('«Configurar la IA» abre los tres pasos encima, con la línea para quien usa la cuenta del centro', async () => {
    const user = userEvent.setup();
    pintar();
    await user.type(screen.getByLabelText('Contexto'), 'Exposición sobre los volcanes');
    expect(generar().disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));

    expect(ventanaClaveAbierta()).toBe(true);
    const v = ventana();
    expect(v.getAttribute('role')).toBe('dialog');
    expect(v.getAttribute('aria-modal')).toBe('true');
    expect(within(v).getByRole('link', { name: /Abrir AI Studio/ })).toBeTruthy();
    expect(within(v).getByRole('button', { name: /Pegar mi clave/ })).toBeTruthy();
    expect(v.textContent).toMatch(/cuenta de tu centro y no te deja crear la clave, usa una cuenta personal de Google/);
    // Va al final del documento: es lo de más arriba, y el botón de atrás la cierra a ella antes que a la de debajo
    expect(loAbierto(document)).toBe(v.parentElement);
    expect(v.parentElement!.parentElement).toBe(document.body);
  });

  it('sin marcar la casilla de aceptación no se guarda la clave', async () => {
    const user = userEvent.setup();
    googleContesta(200);
    pintar();
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    await escribirClave(user);

    const aceptar = within(ventana()).getAllByRole('dialog', { hidden: true }).find(d => d.closest('.modal-overlay.open'))!;
    expect(aceptar.textContent).toMatch(/Antes de usar la IA/);
    expect((within(aceptar).getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(hasApiKey()).toBe(false);
    expect(usoIaAceptado()).toBe(false);

    await user.click(within(aceptar).getByRole('button', { name: 'Ahora no' }));
    expect(hasApiKey()).toBe(false);
    expect(ventanaClaveAbierta()).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('con la clave comprobada se cierra sola y el botón de debajo se activa con lo escrito intacto', async () => {
    const user = userEvent.setup();
    googleContesta(200);
    const cerrarDeDebajo = vi.fn();
    pintar(cerrarDeDebajo);
    await user.type(screen.getByLabelText('Contexto'), 'Exposición sobre los volcanes');
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    await escribirClave(user);
    const aceptar = within(ventana()).getAllByRole('dialog', { hidden: true }).find(d => d.closest('.modal-overlay.open'))!;
    await user.click(within(aceptar).getByRole('checkbox'));
    await user.click(within(aceptar).getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(ventanaClaveAbierta()).toBe(false));
    expect(document.querySelector('.vci')).toBeNull();
    expect(usoIaAceptado()).toBe(true);
    expect(getApiKey()).toBe(CLAVE);
    expect((screen.getByLabelText('Contexto') as HTMLTextAreaElement).value).toBe('Exposición sobre los volcanes');
    expect(generar().disabled).toBe(false);
    expect(screen.queryByRole('button', { name: 'Configurar la IA' })).toBeNull();
    expect(cerrarDeDebajo).not.toHaveBeenCalled();
  });

  it('si Google no acepta la clave, la ventana se queda abierta y lo dice', async () => {
    localStorage.setItem('aulapro_uso_ia', JSON.stringify({ v: VERSION_USO_IA, fecha: '2026-11-20T10:00:00.000Z' }));
    const user = userEvent.setup();
    googleContesta(400);
    pintar();
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    await escribirClave(user);
    await waitFor(() => expect(within(ventana()).getByRole('alert').textContent).toMatch(/Google no acepta esta clave/));
    expect(ventanaClaveAbierta()).toBe(true);
    expect(within(ventana()).getByRole('link', { name: /Abrir AI Studio/ })).toBeTruthy();
  });

  it('Escape cierra solo la ventana de la clave, no la de debajo; y «Ahora no» también la cierra', async () => {
    const user = userEvent.setup();
    const cerrarDeDebajo = vi.fn();
    pintar(cerrarDeDebajo);
    await user.type(screen.getByLabelText('Contexto'), 'A medias');
    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    await user.keyboard('{Escape}');
    expect(ventanaClaveAbierta()).toBe(false);
    expect(cerrarDeDebajo).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Contexto') as HTMLTextAreaElement).value).toBe('A medias');

    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    await user.click(within(ventana()).getByRole('button', { name: 'Ahora no' }));
    expect(document.querySelector('.vci')).toBeNull();
    expect(generar().disabled).toBe(true);
  });
});
