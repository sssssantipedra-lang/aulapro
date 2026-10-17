// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { tipoHorario, parecePdf, bytesDeBase64, documentoDeArchivo, horarioDocValido, MAX_HORARIO_BYTES } from './horarioDoc';

const b64 = (s: string) => btoa(s);

describe('horarioDoc', () => {
  it('reconoce PDF e imágenes y descarta lo demás', () => {
    expect(tipoHorario('application/pdf')).toBe('pdf');
    expect(tipoHorario('', 'Horario.PDF')).toBe('pdf');
    expect(tipoHorario('image/png')).toBe('imagen');
    expect(tipoHorario('', 'foto.jpeg')).toBe('imagen');
    expect(tipoHorario('application/vnd.ms-excel')).toBeNull();
    expect(tipoHorario('text/csv', 'horario.csv')).toBeNull();
  });

  it('comprueba la cabecera del PDF y el peso del base64', () => {
    expect(parecePdf(b64('%PDF-1.7 ...'))).toBe(true);
    expect(parecePdf(b64('<html>'))).toBe(false);
    expect(bytesDeBase64(b64('abcdef'))).toBe(6);
    expect(bytesDeBase64(b64('abcde'))).toBe(5);
    expect(bytesDeBase64(b64('abcd'))).toBe(4);
  });

  it('guarda un PDF válido tal cual', async () => {
    const file = new File(['%PDF-1.4 horario'], 'horario.pdf', { type: 'application/pdf' });
    const r = await documentoDeArchivo(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.doc.name).toBe('horario.pdf');
      expect(r.doc.mimeType).toBe('application/pdf');
      expect(atob(r.doc.base64)).toBe('%PDF-1.4 horario');
    }
  });

  it('rechaza otros archivos, PDF falsos y PDF demasiado pesados', async () => {
    expect(await documentoDeArchivo(new File(['a;b'], 'h.csv', { type: 'text/csv' }))).toEqual({ ok: false, error: 'tipo' });
    expect(await documentoDeArchivo(new File(['<html>'], 'h.pdf', { type: 'application/pdf' }))).toEqual({ ok: false, error: 'tipo' });
    const grande = new File([new Uint8Array(MAX_HORARIO_BYTES + 1)], 'h.pdf', { type: 'application/pdf' });
    expect(await documentoDeArchivo(grande)).toEqual({ ok: false, error: 'peso' });
  });

  it('solo acepta un documento guardado con la forma esperada', () => {
    expect(horarioDocValido(null)).toBeNull();
    expect(horarioDocValido({ base64: 'x', mimeType: 'text/html' })).toBeNull();
    expect(horarioDocValido({ base64: '', mimeType: 'application/pdf' })).toBeNull();
    expect(horarioDocValido({ base64: 'x', mimeType: 'application/pdf', name: 'h.pdf', addedAt: '2026-10-17' }))
      .toEqual({ base64: 'x', mimeType: 'application/pdf', name: 'h.pdf', addedAt: '2026-10-17' });
  });
});
