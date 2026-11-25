// @vitest-environment jsdom
/**
 * Los eventos a 5 días o menos (25-11-2026): en el mes, el día lleva el anillo que parpadea al entrar y su título
 * dice cuánto falta; en el día elegido, el evento lleva la píldora; en la semana, el evento y el día. Los ya
 * pasados y los de más de 5 días, no. Y un aviso de la campana abre el mes con su día elegido.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Agenda } from './Agenda';
import { HorarioSemana } from '../components/agenda/HorarioSemana';
import { I18nProvider } from '../i18n';
import { ToastProvider } from '../components/ui/Toast';
import { fromIsoDate, isoDate, shiftDate } from '../lib/utils';
import type { CalEvent } from '../types';

afterEach(cleanup);

const HOY = isoDate();
const evento = (id: string, dias: number): CalEvent =>
  ({ id, name: `Evento ${id}`, date: shiftDate(HOY, dias), time: '10:00', type: 'deadline', urgency: 'media', color: '#ef4444', desc: '' });

function agenda(calEvents: CalEvent[], diaInicial?: string) {
  render(
    <I18nProvider>
      <ToastProvider>
        <Agenda
          classes={[]} scheduleBlocks={[]} calEvents={calEvents}
          onAddBlock={() => {}} onUpdateBlock={() => {}} onDeleteBlock={() => {}} onReplaceBlocks={() => {}}
          onAddCalEvent={() => {}} onUpdateCalEvent={() => {}} onDeleteCalEvent={() => {}} onNav={() => {}}
          diaInicial={diaInicial}
        />
      </ToastProvider>
    </I18nProvider>,
  );
}

describe('Agenda · eventos cercanos', () => {
  it('un aviso abre el mes con su día elegido; el día lleva el anillo y su título dice cuánto falta', () => {
    const dia = shiftDate(HOY, 2);
    agenda([evento('cerca', 2), evento('lejos', 8), evento('pasado', -1)], dia);
    // Se abre directamente en el mes, con el día del evento elegido
    const titulo = fromIsoDate(dia).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(screen.getByText(titulo)).toBeTruthy();
    const marcados = [...document.querySelectorAll('.cal-day.cal-cerca')];
    expect(marcados).toHaveLength(1);
    expect(marcados[0].classList.contains('cerca-latido')).toBe(true);
    expect(marcados[0].getAttribute('title')).toBe('Faltan 2 días: Evento cerca');
    // El evento del día elegido lleva su píldora (quieta: ya late la tarjeta)
    const pildora = screen.getAllByText('Faltan 2 días').find(el => el.closest('.ag-ev-cerca'))!;
    expect(pildora.classList.contains('cerca-pill')).toBe(true);
    expect(pildora.closest('.ag-ev-cerca')?.classList.contains('cerca-latido')).toBe(true);
  });

  it('debajo del mes, los días cercanos escritos y pulsables (la celda del día no se alcanza con el teclado)', async () => {
    const user = userEvent.setup();
    agenda([evento('dos', 2), evento('cinco', 5), evento('seis', 6), evento('pasado', -1)], HOY);
    const lista = screen.getByRole('region', { name: 'Eventos próximos' });
    const botones = within(lista).getAllByRole('button');
    expect(botones.map(b => b.querySelector('.cerca-pill')?.textContent)).toEqual(['Faltan 2 días', 'Faltan 5 días']);
    expect(within(botones[0]).getByText(/Evento dos/)).toBeTruthy();
    // Pulsarlo elige ese día
    await user.click(botones[1]);
    expect(botones[1].getAttribute('aria-pressed')).toBe('true');
    const titulo = fromIsoDate(shiftDate(HOY, 5)).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    expect(screen.getByText(titulo)).toBeTruthy();
  });

  it('hoy y mañana se dicen así', () => {
    agenda([evento('hoy', 0)], HOY);
    expect(document.querySelector('.cal-cerca')?.getAttribute('title')).toBe('Hoy: Evento hoy');
    cleanup();
    agenda([evento('m', 1)], shiftDate(HOY, 1));
    expect(screen.getAllByText('Mañana').length).toBeGreaterThan(0);
  });

  it('un evento pasado o a más de 5 días no se marca', () => {
    agenda([evento('lejos', 6), evento('pasado', -1)], shiftDate(HOY, 6));
    expect(document.querySelectorAll('.cal-cerca')).toHaveLength(0);
    expect(document.querySelectorAll('.cerca-pill')).toHaveLength(0);
  });

  it('sin aviso se abre en la portada, y la tarjeta del mes dice cuánto falta al próximo', async () => {
    const user = userEvent.setup();
    agenda([evento('e', 4)]);
    const tarjeta = screen.getByRole('button', { name: /Agenda mensual/ });
    expect(within(tarjeta).getByText('Faltan 4 días')).toBeTruthy();
    await user.click(tarjeta);
    expect(document.querySelectorAll('.cal-cerca')).toHaveLength(1);
  });
});

describe('Horario semanal · eventos cercanos', () => {
  it('el evento lleva el anillo, su título dice cuánto falta y el día lleva la píldora', () => {
    const lunes = fromIsoDate('2026-11-23');
    const dias = Array.from({ length: 5 }, (_, i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i));
    const ev = (id: string, date: string): CalEvent => ({ id, name: id, date, time: '', type: 'event', urgency: 'baja', color: '#000', desc: '' });
    render(
      <I18nProvider>
        <HorarioSemana
          dias={dias} etiquetas={['L', 'M', 'X', 'J', 'V']} hoy="2026-11-25" bloques={[]} apoyo={[]}
          eventosPorFecha={{ '2026-11-24': [ev('Ayer', '2026-11-24')], '2026-11-27': [ev('Viernes', '2026-11-27')] }}
          isoDe={isoDate} onEditar={() => {}} onMover={() => {}} onAbrirApoyo={() => {}} onEditarEvento={() => {}}
        />
      </I18nProvider>,
    );
    const viernes = screen.getByRole('button', { name: /Viernes/ });
    expect(viernes.classList.contains('cerca-latido')).toBe(true);
    expect(viernes.getAttribute('title')).toBe('Faltan 2 días: Viernes');
    expect(screen.getByText('Faltan 2 días').classList.contains('wk-cerca')).toBe(true);
    expect(screen.getByRole('button', { name: /Ayer/ }).classList.contains('cerca-latido')).toBe(false);
  });
});
