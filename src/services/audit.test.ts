import { describe, it, expect } from 'vitest';
import {
  pushEntry, newEntry, formatDay, formatGrade, dayKeyOf, auditToCsv, MAX_ENTRIES,
  type AuditEntry,
} from './audit';
import { isoDate } from '../lib/utils';

const entry = (what: string): AuditEntry => newEntry('Lucía', 'update', 'grade', 'g1', what);

describe('pushEntry', () => {
  it('pone lo más reciente primero', () => {
    const log = pushEntry(pushEntry([], entry('viejo')), entry('nuevo'));
    expect(log[0].what).toBe('nuevo');
  });

  it('no pasa del tope y descarta lo más antiguo, no lo nuevo', () => {
    let log: AuditEntry[] = [];
    for (let i = 0; i < MAX_ENTRIES + 50; i++) log = pushEntry(log, entry('cambio ' + i));

    expect(log).toHaveLength(MAX_ENTRIES);
    expect(log[0].what).toBe('cambio ' + (MAX_ENTRIES + 49));   // el último entró
    expect(log.some(e => e.what === 'cambio 0')).toBe(false);    // el primero se fue
  });
});

describe('formatDay: la trampa de la zona horaria española', () => {
  it('no resta un día (el fallo clásico de convertir a Date)', () => {
    // new Date('2026-08-05') se interpreta como UTC; al leerlo en España
    // en horario de verano puede caer en el día 4. Por eso se parte la cadena.
    expect(formatDay('2026-08-05')).toBe('5/8/2026');
    expect(formatDay('2026-01-01')).toBe('1/1/2026');
    expect(formatDay('2026-12-31')).toBe('31/12/2026');
  });

  it('aguanta una cadena que no sea una fecha', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('cualquier cosa')).toBe('cualquier cosa');
  });
});

describe('dayKeyOf', () => {
  it('devuelve el día LOCAL de un instante, no el UTC', () => {
    // Un instante de medianoche local debe dar ese mismo día, no el anterior.
    const medianoche = new Date(2026, 7, 5, 0, 30, 0);   // 5 ago 2026, 00:30 local
    expect(dayKeyOf(medianoche.toISOString())).toBe('2026-08-05');
  });

  it('coincide con isoDate(), que es el helper del resto de la app', () => {
    const ahora = new Date();
    expect(dayKeyOf(ahora.toISOString())).toBe(isoDate(ahora));
  });
});

describe('formatGrade', () => {
  it('usa coma decimal', () => {
    expect(formatGrade(7.5)).toBe('7,5');
  });

  it('sin nota pone una raya, y distingue el 0 de «vacío»', () => {
    expect(formatGrade(null)).toBe('—');
    expect(formatGrade(undefined)).toBe('—');
    expect(formatGrade(0)).toBe('0');   // un cero es una nota, no un hueco
  });
});

describe('auditToCsv', () => {
  const log = [newEntry('Lucía', 'update', 'grade', 'g1', 'Nota de Ana', '5,5 → 7')];

  it('lleva BOM y punto y coma, para que Excel español lo abra en columnas', () => {
    const csv = auditToCsv(log);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv.split('\r\n')[0]).toContain(';');
  });

  it('escapa las comillas en vez de romper la columna', () => {
    const conComillas = [newEntry('Lucía', 'update', 'grade', 'g1', 'Prueba «la "buena"»')];
    expect(auditToCsv(conComillas)).toContain('""buena""');
  });
});
