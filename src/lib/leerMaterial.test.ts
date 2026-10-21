import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { leerDocumentoMaterial } from './leerMaterial';

// Sin FileReader en este entorno: la conversión a base64 se simula
vi.mock('./utils', async importOriginal => ({
  ...await importOriginal<typeof import('./utils')>(),
  fileToBase64: async (f: File) => ({ name: f.name, mimeType: f.type, base64: 'JVBER' }),
}));

describe('leer un documento con el inventario', () => {
  it('una hoja de cálculo, con títulos y varias hojas', async () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Inventario'], ['Material', 'Cantidad', 'Estado'], ['Balones', 12, 'Bien'], ['Conos', 30, 'Roto']]), 'Pabellón');
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Material', 'Uds'], ['Colchonetas', 6]]), 'Almacén');
    const buf = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const r = await leerDocumentoMaterial(new File([buf], 'inventario.xlsx'));
    expect(r.leidos).toEqual([
      { nombre: 'Balones', cantidad: 12, estado: 'bien' }, { nombre: 'Conos', cantidad: 30, estado: 'reponer' }, { nombre: 'Colchonetas', cantidad: 6 },
    ]);
    expect(r.paraIA).toBeUndefined();
  });

  it('un Word con una línea por material', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>Material</w:t></w:r></w:p><w:p><w:r><w:t>12 balones &amp; pelotas</w:t></w:r></w:p><w:p><w:r><w:t>Aros: 20</w:t></w:r></w:p></w:body></w:document>');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const r = await leerDocumentoMaterial(new File([buf], 'material.docx'));
    expect(r.leidos).toEqual([{ nombre: 'balones & pelotas', cantidad: 12 }, { nombre: 'Aros', cantidad: 20 }]);
  });

  it('un texto sin forma de lista se deja para la IA, y un PDF también', async () => {
    const t = await leerDocumentoMaterial(new File(['Tenemos varios balones y algunos conos.'], 'nota.txt'));
    expect(t.leidos).toEqual([]);
    expect(t.paraIA?.texto).toContain('balones');
    const p = await leerDocumentoMaterial(new File(['%PDF'], 'inv.pdf', { type: 'application/pdf' }));
    expect(p.paraIA?.archivo?.mimeType).toBe('application/pdf');
  });

  it('un formato que no se lee, error', async () => {
    await expect(leerDocumentoMaterial(new File(['x'], 'foto.png'))).rejects.toThrow('formato');
  });
});
