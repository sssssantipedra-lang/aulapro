// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentosInicio } from './DocumentosInicio';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';

afterEach(() => { cleanup(); delete window.electronAPI; });

const pinta = () => render(
  <I18nProvider>
    <ToastProvider>
      <DocumentosInicio classes={[]} reports={[]} gradeItems={[]} learningSituations={[]} fichas={[]} onNav={() => {}} />
    </ToastProvider>
  </I18nProvider>,
);

describe('Documentos: acceso a los documentos descargados', () => {
  it('sin Android no hay botón', () => {
    pinta();
    expect(screen.queryByRole('button', { name: /Documentos descargados/ })).toBeNull();
  });

  it('en Android el botón abre la carpeta de AulaPro', async () => {
    const openFolder = vi.fn().mockResolvedValue({ existe: true });
    window.electronAPI = { isDesktop: false, platform: 'android', version: '', docs: { savePdf: vi.fn(), print: vi.fn(), reveal: vi.fn(), openFolder } };
    pinta();
    await userEvent.click(screen.getByRole('button', { name: /Documentos descargados/ }));
    expect(openFolder).toHaveBeenCalledOnce();
  });

  it('si aún no hay carpeta, lo dice', async () => {
    window.electronAPI = { isDesktop: false, platform: 'android', version: '', docs: { savePdf: vi.fn(), print: vi.fn(), reveal: vi.fn(), openFolder: vi.fn().mockResolvedValue({ existe: false }) } };
    pinta();
    await userEvent.click(screen.getByRole('button', { name: /Documentos descargados/ }));
    await waitFor(() => expect(screen.getByText(/Todavía no has guardado ningún documento/)).toBeTruthy());
  });
});
