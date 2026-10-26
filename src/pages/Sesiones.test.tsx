// @vitest-environment jsdom
/**
 * Sesiones: la IA prepara una sesión para una clase y un día, con las
 * limitaciones de ese día sin nombres; se revisa y se guarda. La demo trae
 * una sesión para mañana.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sesiones } from './Sesiones';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { buildDemoEF } from '../lib/demoEF';
import type { EfData } from '../types/ef';

const callGemini = vi.hoisted(() => vi.fn());
vi.mock('../services/gemini', async importOriginal => {
  const real = await importOriginal<typeof import('../services/gemini')>();
  return { ...real, callGemini, hasApiKey: () => true };
});

const demo = buildDemoEF(new Date(2026, 9, 5));
let ultimo: EfData = demo.ef;
function Harness({ inicial = demo.ef }: { inicial?: EfData }) {
  const [ef, setEf] = useState(inicial);
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
  localStorage.clear();
  ultimo = demo.ef;
  callGemini.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 5, 9, 0));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Sesiones', () => {
  it('la IA prepara la sesión con las limitaciones de hoy y los niveles II y III, sin nombres, y se guarda tras revisarla', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText('Voleibol: el toque de dedos')).toBeTruthy();

    callGemini.mockResolvedValue(JSON.stringify({
      titulo: 'Bádminton: el clear', objetivo: 'Golpear alto y profundo.', calentamiento: 'Movilidad (10 min)',
      principal: 'Clear por parejas (25 min)', calma: 'Estiramientos (10 min)', material: 'Raquetas y volantes',
      inclusion: 'No puede correr: juega en un campo más estrecho.', planB: 'En el porche, con globos.',
    }));
    await user.click(screen.getByRole('button', { name: /Preparar con IA/ }));
    // 1º ESO A el lunes 5 de octubre de 2026: 55 minutos en el horario, un lesionado y otro con nivel III
    expect((screen.getByLabelText('Minutos') as HTMLInputElement).value).toBe('55');
    expect(screen.getByText(/Ese día hay 2 alumnos con alguna limitación o con medidas de nivel II o III/)).toBeTruthy();
    await user.type(screen.getByLabelText('Qué quieres trabajar'), 'el clear de bádminton');
    await user.click(screen.getByRole('button', { name: /Preparar la sesión/ }));

    const prompt = callGemini.mock.calls[0][1] as string;
    expect(prompt).toContain('No puede correr, No puede saltar');
    expect(prompt).toContain('Nivel III (respuesta diferenciada con apoyos ordinarios adicionales): necesita anticipar la sesión');
    expect(prompt).not.toMatch(/Alumno \d|esguince/i);
    // El marco de la IA explica qué pide cada nivel
    expect(callGemini.mock.calls[0][0]).toContain('en el nivel III, respuesta diferenciada');
    expect(prompt).toContain('Duración de la sesión: 55 minutos');

    expect((await screen.findByLabelText('Título') as HTMLInputElement).value).toBe('Bádminton: el clear');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const s = ultimo.sesiones.find(x => x.titulo === 'Bádminton: el clear');
    expect(s).toMatchObject({ claseId: 'ef-c1', fecha: '2026-10-05', ia: true, planB: 'En el porche, con globos.' });
  });

  it('copia las sesiones de una clase a otras: sin fecha, y cada clase con las suyas', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const antes = demo.ef.sesiones.length;
    const origen = demo.ef.sesiones[0];
    const clasesDestino = demo.classes.filter(c => c.id !== origen.claseId);
    expect(clasesDestino.length).toBeGreaterThan(1);

    await user.click(screen.getByRole('button', { name: /Copiar a otras clases/ }));
    const ventana = screen.getByRole('dialog', { name: 'Copiar sesiones a otras clases' });
    // De partida, todas las sesiones de esa clase marcadas
    expect((within(ventana).getByLabelText(/Sesiones de/) as HTMLSelectElement).value).toBe(origen.claseId ?? '');
    const marcadas = within(ventana).getByRole('group', { name: 'Sesiones que se copian' }).querySelectorAll('input:checked').length;
    expect(marcadas).toBe(demo.ef.sesiones.filter(s => s.claseId === origen.claseId).length);

    // Una sola clase de destino, la última
    const destino = clasesDestino[clasesDestino.length - 1];
    for (const c of clasesDestino) {
      const caja = within(ventana).getByRole('checkbox', { name: new RegExp(`^${c.name}`) }) as HTMLInputElement;
      if (caja.checked !== (c.id === destino.id)) await user.click(caja);
    }
    await user.click(within(ventana).getByRole('button', { name: 'Copiar a 1 clase' }));

    const nuevas = ultimo.sesiones.slice(antes);
    expect(nuevas).toHaveLength(marcadas);
    expect(nuevas.every(n => n.claseId === destino.id && !n.fecha)).toBe(true);
    expect(nuevas.map(n => n.titulo)).toEqual(demo.ef.sesiones.filter(s => s.claseId === origen.claseId).map(s => s.titulo));
    // Las originales no se tocan
    expect(ultimo.sesiones.slice(0, antes)).toEqual(demo.ef.sesiones);
  });

  /** Abre la tarjeta de la clase de una sesión de la demo. */
  async function abrirClaseDe(user: ReturnType<typeof userEvent.setup>, titulo: string) {
    const clase = demo.classes.find(c => c.id === demo.ef.sesiones.find(s => s.titulo === titulo)!.claseId)!;
    await user.click(screen.getByRole('button', { name: `Abrir las sesiones de ${clase.name}` }));
    return clase;
  }

  it('la portada es una tarjeta por clase, con cuántas sesiones tiene; dentro se ven sus sesiones', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    for (const c of demo.classes) expect(screen.getByRole('button', { name: `Abrir las sesiones de ${c.name}` })).toBeTruthy();
    const clase = await abrirClaseDe(user, 'Voleibol: el toque de dedos');
    expect(screen.getByRole('heading', { name: clase.name })).toBeTruthy();
    expect(screen.getByText('Voleibol: el toque de dedos')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sesiones' }));
    expect(screen.getByRole('button', { name: `Abrir las sesiones de ${clase.name}` })).toBeTruthy();
  });

  it('elegir varias y eliminarlas pide confirmación; si dices que no, no toca nada', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const clase = await abrirClaseDe(user, 'Voleibol: el toque de dedos');
    const deLaClase = demo.ef.sesiones.filter(s => s.claseId === clase.id).length;
    const deOtras = demo.ef.sesiones.length - deLaClase;
    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('button', { name: 'Elegir todas' }));
    expect(screen.getByText(`${deLaClase} ${deLaClase === 1 ? 'elegida' : 'elegidas'}`)).toBeTruthy();

    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(confirmar).toHaveBeenCalledOnce();
    expect(ultimo.sesiones).toHaveLength(demo.ef.sesiones.length);

    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('button', { name: 'Elegir todas' }));
    confirmar.mockReturnValueOnce(true);
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    // Solo se van las de esa clase
    expect(ultimo.sesiones).toHaveLength(deOtras);
    expect(ultimo.sesiones.some(s => s.claseId === clase.id)).toBe(false);
    confirmar.mockRestore();
  });

  it('archivar saca las sesiones de la vista sin borrarlas, y se restauran', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await abrirClaseDe(user, 'Voleibol: el toque de dedos');
    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Voleibol: el toque de dedos»' }));
    await user.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(ultimo.sesiones.find(s => s.titulo === 'Voleibol: el toque de dedos')?.archivada).toBe(true);
    expect(ultimo.sesiones).toHaveLength(demo.ef.sesiones.length);
    expect(screen.queryByText('Voleibol: el toque de dedos')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Ver las archivadas (1)' }));
    await user.click(screen.getByRole('button', { name: 'Elegir varias' }));
    await user.click(screen.getByRole('checkbox', { name: 'Elegir «Voleibol: el toque de dedos»' }));
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(ultimo.sesiones.find(s => s.titulo === 'Voleibol: el toque de dedos')?.archivada).toBeUndefined();
  });

  it('marcar una sesión como completada cuenta en el progreso y se puede deshacer', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    const total = demo.ef.sesiones.length;
    expect(screen.getAllByText(`0 de ${total} sesiones completadas`).length).toBeGreaterThan(0);

    const clase = await abrirClaseDe(user, 'Voleibol: el toque de dedos');
    const deLaClase = demo.ef.sesiones.filter(s => s.claseId === clase.id).length;
    await user.click(screen.getByRole('button', { name: 'Marcar «Voleibol: el toque de dedos» como completada' }));
    expect(ultimo.sesiones.find(s => s.titulo === 'Voleibol: el toque de dedos')?.completada).toBe(true);
    expect(screen.getAllByText(`1 de ${deLaClase} sesiones completadas`).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Marcar «Voleibol: el toque de dedos» como pendiente' }));
    expect(ultimo.sesiones.find(s => s.titulo === 'Voleibol: el toque de dedos')?.completada).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Sesiones' }));
    expect(screen.getAllByText(`0 de ${total} sesiones completadas`).length).toBeGreaterThan(0);
  });

  it('una sesión a medias, al cerrar la ventana, se ofrece para continuar; al guardarla, deja de ofrecerse', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Nueva sesión/ }));
    await user.type(screen.getByLabelText('Título'), 'Orientación en el patio');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cerrar' }));

    expect(screen.getByText(/Te quedó una sesión sin guardar: «Orientación en el patio»/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe('Orientación en el patio');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(ultimo.sesiones.some(x => x.titulo === 'Orientación en el patio')).toBe(true);
    expect(screen.queryByText(/Te quedó una sesión sin guardar/)).toBeNull();
  });

  it('subir y bajar una sesión cambia su orden dentro del grupo y se guarda', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const base = demo.ef.sesiones.find(s => s.titulo === 'Voleibol: el toque de dedos')!;
    const otras = ['Segunda', 'Tercera'].map((titulo, i) => ({ ...base, id: `x${i}`, titulo, fecha: undefined, sdaId: undefined, completada: undefined }));
    render(<Harness inicial={{ ...demo.ef, sesiones: [...demo.ef.sesiones.filter(s => s.claseId !== base.claseId), { ...base, sdaId: undefined }, ...otras] }} />);
    const clase = await abrirClaseDe(user, 'Voleibol: el toque de dedos');
    const delGrupo = () => ultimo.sesiones.filter(s => s.claseId === clase.id && !s.sdaId);
    const titulos = () => [...document.querySelectorAll('.ef-sesion-fila .ef-sesion strong')].map(e => e.textContent);
    const antes = titulos();
    expect(antes.length).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: `Bajar «${antes[0]}»` }));
    const despues = titulos();
    expect(despues[0]).toBe(antes[1]);
    expect(despues[1]).toBe(antes[0]);
    expect(delGrupo().every(s => s.orden !== undefined)).toBe(true);
  });
});
