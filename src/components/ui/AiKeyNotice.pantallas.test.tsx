// @vitest-environment jsdom
/**
 * Los avisos de la clave de la IA no mandan a Configuración (25-11-2026). Desde el 23-11-2026 «Configurar la IA»
 * abre la ventana de la clave encima de la pantalla (`abrirClaveIA`), así que un aviso que dijera «se configura en
 * Configuración» mandaba al docente fuera de lo que tenía a medias. Y donde solo había un botón apagado con un
 * `title`, ahora hay también un aviso con el botón que abre la ventana; al poner la clave, la pantalla se vuelve a
 * pintar y el botón se enciende.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { useState } from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from './Toast';
import { EfActividades } from '../../pages/ef/EfActividades';
import { ScheduleScanner } from '../agenda/ScheduleScanner';
import { buildDemoEF } from '../../lib/demoEF';
import { callGemini, setApiKey } from '../../services/gemini';
import { cerrarClaveIA, ventanaClaveAbierta } from '../../lib/claveIA';

const CLAVE = ['AIza', 'SyD-clave-de-prueba', '-0123456789abcdefg'].join('');

beforeEach(() => { localStorage.clear(); setApiKey(''); });
afterEach(() => { cleanup(); cerrarClaveIA(); setApiKey(''); });

const demo = buildDemoEF(new Date(2026, 9, 5));
function Actividades() {
  const [ef, setEf] = useState(demo.ef);
  return (
    <I18nProvider><ToastProvider>
      <EfActividades classes={demo.classes} students={demo.students} ef={ef} onChangeEf={f => setEf(d => f(d))} comunidad="madrid" />
    </ToastProvider></I18nProvider>
  );
}

describe('avisos de la clave de la IA, sin mandar a Configuración', () => {
  it('Actividades de EF: sin clave hay aviso con «Configurar la IA», que abre la ventana; con la clave, los botones se encienden', async () => {
    const user = userEvent.setup();
    render(<Actividades />);
    const aviso = document.querySelector('.ai-notice')!;
    expect(aviso.textContent).toMatch(/Para usar la IA hace falta la clave gratuita de Google/);
    expect(aviso.textContent).not.toMatch(/Configuración/);
    const proponer = screen.getByRole('button', { name: /Proponer con IA/ }) as HTMLButtonElement;
    expect(proponer.disabled).toBe(true);
    expect(proponer.title).toMatch(/«Configurar la IA»/);
    expect(proponer.title).not.toMatch(/en Configuración/);

    await user.click(screen.getByRole('button', { name: 'Configurar la IA' }));
    expect(ventanaClaveAbierta()).toBe(true);

    act(() => setApiKey(CLAVE));
    expect((screen.getByRole('button', { name: /Proponer con IA/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector('.ai-notice')).toBeNull();
  });

  it('Leer el horario: el texto no manda a Configuración y, al poner la clave, deja de pedirla', () => {
    render(<I18nProvider><ToastProvider>
      <ScheduleScanner open classes={[]} existingCount={0} onClose={() => {}} onImport={() => {}} onNav={() => {}} />
    </ToastProvider></I18nProvider>);
    expect(screen.getByText(/Para leer el horario hace falta la clave gratuita de Google/).textContent).not.toMatch(/Configuración/);
    act(() => setApiKey(CLAVE));
    expect(screen.queryByText(/Para leer el horario hace falta la clave/)).toBeNull();
  });

  it('en el código de las pantallas ningún aviso de la clave dice que se configura en Configuración', () => {
    const raiz = path.resolve(__dirname, '../..');
    const malos: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== 'i18n') recorrer(p); continue; }
        if (!/\.tsx?$/.test(e.name) || /\.test\./.test(e.name)) continue;
        const s = fs.readFileSync(p, 'utf8');
        if (/se configura en Configuración|en Configuración para usar la IA/.test(s)) malos.push(path.relative(raiz, p));
      }
    };
    recorrer(raiz);
    expect(malos).toEqual([]);
  });

  it('la IA llamada sin clave (un botón que no se apaga sin ella, como el de la Diana) abre la ventana y no manda a Configuración', async () => {
    let error = '';
    const respuesta = await callGemini('sistema', 'pregunta', [], { onError: m => { error = m; } });
    expect(respuesta).toBeNull();
    expect(ventanaClaveAbierta()).toBe(true);
    expect(error).toMatch(/hace falta la clave gratuita de Google/);
    expect(error).not.toMatch(/Configuración/);
  });
});
