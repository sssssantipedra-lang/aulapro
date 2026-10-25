// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { webcrypto } from 'node:crypto';
import { Share } from './Share';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import type { Class, Student } from '../types';
import type { SyncSource } from '../services/paquete';

// El archivo cifrado que "se descarga" se queda aquí para abrirlo después.
const guardados: { texto: string; nombre: string }[] = [];
vi.mock('../lib/download', () => ({
  downloadFile: async (blob: Blob, nombre: string) => {
    guardados.push({ texto: await new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsText(blob); }), nombre });
  },
}));

beforeAll(() => {
  // jsdom no trae Web Crypto completo ni Blob.text: se usan los de Node
  vi.stubGlobal('crypto', webcrypto);
  if (!File.prototype.text) {
    File.prototype.text = function (this: Blob) {
      return new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsText(this); });
    };
  }
});
afterEach(() => { cleanup(); guardados.length = 0; });

const clase = { id: 'c1', name: '5.º A', subject: 'Matemáticas', color: '#2563eb' } as unknown as Class;
const alumno = { id: 'a1', name: 'Alumno 1', class_id: 'c1' } as unknown as Student;
const alumno2 = { id: 'a2', name: 'Alumno 2', class_id: 'c1' } as unknown as Student;
const fuente: SyncSource = {
  classes: [clase], students: [alumno, alumno2], gradeCategories: [{ id: 'k1', class_id: 'c1', name: 'Exámenes', weight: 100 }],
  gradeItems: [{ id: 'g1', class_id: 'c1', category_id: 'k1', name: 'Examen 1', date: '2026-10-01' }, { id: 'g2', class_id: 'c1', category_id: 'k1', name: 'Examen 2', date: '2026-10-15' }],
  grades: { g1: { a1: 7, a2: 9 }, g2: { a1: 5, a2: 6 } },
  rubrics: [], dianas: [], evaluations: [], me: 'perfil-1',
};

function pinta(onImport = vi.fn(() => ({ clases: 1, alumnos: 1, evaluaciones: 0 }))) {
  const r = render(
    <I18nProvider>
      <ToastProvider>
        <Share classes={[clase]} source={fuente} userName="Profesor" onImport={onImport} />
      </ToastProvider>
    </I18nProvider>,
  );
  return { onImport, ...r };
}

/** Crea un archivo cifrado desde la pantalla y devuelve su contraseña. */
async function creaArchivo(contrasena?: string) {
  await userEvent.click(screen.getByRole('button', { name: '5.º A' }));
  if (contrasena) {
    await userEvent.click(screen.getByRole('button', { name: 'Escribir la mía' }));
    await userEvent.type(screen.getByLabelText('Escribe una contraseña'), contrasena);
  }
  await userEvent.click(screen.getByRole('button', { name: /Crear archivo cifrado/ }));
  await waitFor(() => expect(guardados).toHaveLength(1), { timeout: 15000 });
  return guardados[0];
}

describe('compartir con otro docente', () => {
  it('sin elegir ninguna clase no se puede crear el archivo', () => {
    pinta();
    expect((screen.getByRole('button', { name: /Crear archivo cifrado/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('crea un archivo cifrado que no deja ver ni el nombre del alumnado ni el de la clase', async () => {
    pinta();
    const archivo = await creaArchivo();
    expect(archivo.nombre).toMatch(/^aulapro-compartido-\d{4}-\d{2}-\d{2}\.json$/);
    expect(archivo.texto).not.toContain('Alumno 1');
    expect(archivo.texto).not.toContain('5.º A');
    expect(archivo.texto).toContain('"_cifrada":true');
  });

  it('exige una contraseña de al menos 10 caracteres', async () => {
    pinta();
    await userEvent.click(screen.getByRole('button', { name: '5.º A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Escribir la mía' }));
    await userEvent.type(screen.getByLabelText('Escribe una contraseña'), 'corta');
    expect((screen.getByRole('button', { name: /Crear archivo cifrado/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('el otro docente lo abre con la contraseña, ve qué trae y lo importa', async () => {
    const { unmount } = pinta();
    const clave = 'una frase larga y secreta';
    const archivo = await creaArchivo(clave);
    unmount();

    const { onImport, container } = pinta();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([archivo.texto], archivo.nombre, { type: 'application/json' }));
    await userEvent.type(await screen.findByLabelText('Contraseña que te han dado'), clave);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(await screen.findByText('De Profesor', {}, { timeout: 15000 })).toBeTruthy();
    // una vez en los botones de enviar y otra en la vista previa de lo que llega
    expect(screen.getAllByText('5.º A').length).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: /Importar/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
    const [paquete, modo] = onImport.mock.calls[0] as unknown as [{ classes: { id: string }[]; students: { id: string }[] }, string];
    expect(modo).toBe('conservar');
    expect(paquete.classes.map(c => c.id)).toEqual(['c1']);
    expect(paquete.students.map(s => s.id)).toEqual(['a1', 'a2']);
  });

  it('con una contraseña equivocada no entra nada', async () => {
    const { unmount } = pinta();
    const archivo = await creaArchivo('una frase larga y secreta');
    unmount();

    const { onImport, container } = pinta();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([archivo.texto], archivo.nombre, { type: 'application/json' }));
    await userEvent.type(await screen.findByLabelText('Contraseña que te han dado'), 'otra frase diferente');
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect((await screen.findByRole('alert', {}, { timeout: 15000 })).textContent).toContain('La contraseña no es correcta');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('un archivo que no es una copia cifrada se rechaza con un aviso', async () => {
    const { container } = pinta();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['{"_app":"AulaPro","data":{}}'], 'copia.json', { type: 'application/json' }));
    expect((await screen.findByRole('alert')).textContent).toContain('no es una copia cifrada');
  });

  it('se puede elegir con detalle qué va: sin un alumno ni una columna, y sin sus notas', async () => {
    const { unmount } = pinta();
    const clave = 'una frase larga y secreta';
    await userEvent.click(screen.getByRole('button', { name: '5.º A' }));
    await userEvent.click(screen.getByText('Elegir con detalle'));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Alumno 2' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Examen 1/ }));
    expect(screen.getByText('2 sin enviar')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Escribir la mía' }));
    await userEvent.type(screen.getByLabelText('Escribe una contraseña'), clave);
    await userEvent.click(screen.getByRole('button', { name: /Crear archivo cifrado/ }));
    await waitFor(() => expect(guardados).toHaveLength(1), { timeout: 15000 });
    unmount();

    // Quien lo recibe solo ve lo que se dejó marcado
    const { onImport, container } = pinta();
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([guardados[0].texto], guardados[0].nombre, { type: 'application/json' }));
    await userEvent.type(await screen.findByLabelText('Contraseña que te han dado'), clave);
    await userEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await screen.findByText('De Profesor', {}, { timeout: 15000 });
    await userEvent.click(screen.getByRole('button', { name: /Importar/ }));

    const [paquete] = onImport.mock.calls[0] as unknown as [{
      students: { id: string }[]; gradeItems: { id: string }[]; grades: Record<string, Record<string, number>>;
    }];
    expect(paquete.students.map(x => x.id)).toEqual(['a1']);
    expect(paquete.gradeItems.map(x => x.id)).toEqual(['g2']);
    expect(paquete.grades).toEqual({ g2: { a1: 5 } });
  });

  it('Ninguno y Todos cambian de golpe toda la lista', async () => {
    pinta();
    await userEvent.click(screen.getByRole('button', { name: '5.º A' }));
    await userEvent.click(screen.getByText('Elegir con detalle'));
    const botonesNinguno = screen.getAllByRole('button', { name: 'Ninguno' });
    await userEvent.click(botonesNinguno[0]);                       // el alumnado
    expect((screen.getByRole('checkbox', { name: 'Alumno 1' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('checkbox', { name: 'Alumno 2' }) as HTMLInputElement).checked).toBe(false);
    await userEvent.click(screen.getAllByRole('button', { name: 'Todos' })[0]);
    expect((screen.getByRole('checkbox', { name: 'Alumno 1' }) as HTMLInputElement).checked).toBe(true);
  });
});
