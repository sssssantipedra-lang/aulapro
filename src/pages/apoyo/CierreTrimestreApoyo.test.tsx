// @vitest-environment jsdom
/**
 * El cierre del trimestre: cada objetivo con lo que sugiere el registro y la valoración del especialista.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CierreTrimestreApoyo } from './CierreTrimestreApoyo';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '../../components/ui/Toast';
import { APOYO_VACIO } from '../../lib/apoyo';
import type { ApoyoData } from '../../types/apoyo';

afterEach(cleanup);

const base: ApoyoData = {
  ...APOYO_VACIO,
  alumnos: [{ id: 'a', nombre: 'Alumno 1', claseOrigen: '', categorias: [], diagnostico: '', necesidades: '', notas: '' }],
  programas: [{ id: 'p', alumnoId: 'a', ambito: 'Lectoescritura', especialidad: 'PT', objetivos: [
    { id: 'o1', texto: 'Leer sílabas', trimestres: [1], criterios: [] },
  ] }],
  sesiones: [{ id: 's', grupoId: 'g', fecha: '2026-10-05', temaClase: '', alumnos: [{ alumnoId: 'a', objetivos: { o1: 'proceso' }, respuesta: {}, nota: '' }] }],
};

function montar() {
  let datos = base;
  const onChange = vi.fn((f: (d: ApoyoData) => ApoyoData) => { datos = f(datos); });
  const onDocumentos = vi.fn();
  const vista = () => (
    <I18nProvider><ToastProvider>
      <CierreTrimestreApoyo alumno={datos.alumnos[0]} data={datos} onChange={onChange} onDocumentos={onDocumentos} />
    </ToastProvider></I18nProvider>
  );
  const r = render(vista());
  return { actual: () => datos, repintar: () => r.rerender(vista()), onDocumentos };
}

describe('Cierre del trimestre', () => {
  it('sugiere lo registrado, deja corregirlo, lo guarda y lleva a preparar los informes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-10T10:00:00'));
    const m = montar();
    vi.useRealTimers();
    const user = userEvent.setup();
    expect(screen.getByText(/Aún sin cerrar/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: /En proceso/ }).getAttribute('aria-checked')).toBe('true');

    await user.click(screen.getByRole('radio', { name: /Conseguido/ }));
    await user.type(screen.getByLabelText('Comentario (opcional)'), 'Lo lee solo');
    await user.click(screen.getByRole('button', { name: /Guardar el cierre del 1º trimestre/ }));

    expect(m.actual().evaluaciones).toMatchObject([{ alumnoId: 'a', objetivoId: 'o1', trimestre: 1, resultado: 'si', comentario: 'Lo lee solo' }]);
    m.repintar();
    expect(screen.getByText(/Cerrado el/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Preparar los informes/ }));
    expect(m.onDocumentos).toHaveBeenCalledWith(1);
  });
});
