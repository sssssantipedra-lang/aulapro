// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClassChips } from './ClassChips';
import { I18nProvider } from '../../i18n';

const clase = (id: string, name: string, etapa?: 'primaria' | 'eso', curso?: number) => ({ id, name, color: '#000', etapa, curso });

describe('selector de clase', () => {
  afterEach(cleanup);

  it('con pocas clases, chips', () => {
    render(<I18nProvider><ClassChips classes={[clase('a', '1º A'), clase('b', '2º A')]} value="a" onChange={() => {}} /></I18nProvider>);
    expect(screen.getByRole('button', { name: '1º A' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('con muchas, un desplegable por etapa y flechas que siguen su orden', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const clases = [
      clase('e2', '2º ESO', 'eso', 2), clase('e1', '1º ESO', 'eso', 1), clase('libre', 'Taller'),
      ...[1, 2, 3, 4, 5].map(n => clase(`p${n}`, `${n}º Primaria`, 'primaria', n)),
    ];
    render(<I18nProvider><ClassChips classes={clases} value="p5" onChange={onChange} /></I18nProvider>);
    const grupos = [...document.querySelectorAll('optgroup')].map(g => [g.label, [...g.querySelectorAll('option')].map(o => o.textContent)]);
    expect(grupos).toEqual([
      ['Primaria', ['1º Primaria', '2º Primaria', '3º Primaria', '4º Primaria', '5º Primaria']],
      ['ESO', ['1º ESO', '2º ESO']],
      ['Otras clases', ['Taller']],
    ]);
    await user.click(screen.getByRole('button', { name: 'Clase siguiente' }));
    expect(onChange).toHaveBeenLastCalledWith('e1');
    await user.selectOptions(screen.getByRole('combobox'), 'Taller');
    expect(onChange).toHaveBeenLastCalledWith('libre');
  });
});
