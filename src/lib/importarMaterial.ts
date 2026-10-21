/**
 * Importar el inventario de material de EF desde un documento del centro
 * (petición del dueño, 20-10-2026): una hoja de cálculo, un CSV, un texto o un
 * PDF, para no escribir el material uno a uno. Aquí, lo que se hace sin IA:
 * leer las filas de una tabla y las líneas de un texto, y fusionar lo leído
 * con el inventario. El PDF y los textos que no se entienden los lee la IA
 * (`materialDesdeDocumento` en `services/efIA.ts`).
 */
import type { MaterialEF } from '../types/ef';

export interface MaterialLeido {
  nombre: string;
  cantidad: number;
  /** Solo si el documento lo dice. */
  estado?: MaterialEF['estado'];
  ubicacion?: string;
}

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Para comparar nombres: sin tildes, mayúsculas ni plural sencillo («balón» y «balones»). */
export const claveDeMaterial = (nombre: string): string =>
  plano(nombre).replace(/[^a-z0-9 ]/g, '').split(' ').map(p => p.replace(/(es|s)$/, '')).join(' ');

/** «12», «12 uds», «1.200», «x12» → número entero; `null` si no es una cantidad. */
export function aCantidad(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const m = /^\s*[x×]?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d+)?\s*(?:ud\.?s?|unidades?|u\.?|uds\.?|x)?\s*$/i.exec(String(v ?? ''));
  return m ? Number(m[1].replace(/\./g, '')) : null;
}

/** «bien», «nuevo», «regular», «roto», «para reponer»… → el estado del inventario. */
export function aEstado(v: unknown): MaterialEF['estado'] | undefined {
  const s = plano(String(v ?? ''));
  if (!s) return undefined;
  if (/(repon|roto|mal|deteriorad|inservible|desechar|baja|no funciona|agotad)/.test(s)) return 'reponer';
  if (/(regular|usado|desgastad|justo|aceptable|medio)/.test(s)) return 'regular';
  if (/(bien|bueno|buen|nuevo|ok|correcto|perfecto|optimo)/.test(s)) return 'bien';
  return undefined;
}

const COLUMNAS: { campo: 'nombre' | 'cantidad' | 'estado' | 'ubicacion'; re: RegExp }[] = [
  { campo: 'nombre', re: /^(material|nombre|articulo|descripcion|elemento|equipamiento|producto|denominacion|concepto)\b/ },
  { campo: 'cantidad', re: /^(cantidad|cant\b|unidades|uds|ud\b|n[ºo°]?$|numero|total|stock|existencias)/ },
  { campo: 'estado', re: /^(estado|conservacion|situacion|condicion)/ },
  { campo: 'ubicacion', re: /^(ubicacion|lugar|donde|localizacion|almacen|zona|sitio|armario)/ },
];

/**
 * Las filas de una tabla (la primera hoja con datos, ya como texto) a material.
 * Si la primera fila trae títulos («Material», «Cantidad»…), se usan; si no,
 * la columna de texto más a la izquierda es el nombre y la primera columna de
 * números, la cantidad. Las filas sin nombre o sin cantidad legible se saltan.
 */
export function materialDeFilas(filas: readonly (readonly unknown[])[]): MaterialLeido[] {
  const limpias = filas.map(f => f.map(c => String(c ?? '').trim())).filter(f => f.some(Boolean));
  if (limpias.length === 0) return [];

  // ¿Hay fila de títulos? Se busca entre las primeras (a veces va un rótulo del centro encima)
  let cab = -1;
  const col: Partial<Record<'nombre' | 'cantidad' | 'estado' | 'ubicacion', number>> = {};
  for (let i = 0; i < Math.min(5, limpias.length) && cab < 0; i++) {
    const encontradas: typeof col = {};
    limpias[i].forEach((celda, j) => {
      const c = plano(celda);
      for (const { campo, re } of COLUMNAS) if (encontradas[campo] === undefined && re.test(c)) { encontradas[campo] = j; break; }
    });
    if (encontradas.nombre !== undefined && encontradas.cantidad !== undefined) { cab = i; Object.assign(col, encontradas); }
  }

  let datos = limpias;
  if (cab >= 0) datos = limpias.slice(cab + 1);
  else {
    // Sin títulos: nombre = primera columna que no es un número; cantidad = primera columna numérica
    const ancho = Math.max(...limpias.map(f => f.length));
    for (let j = 0; j < ancho; j++) {
      const celdas = limpias.map(f => f[j]).filter(Boolean);
      const numericas = celdas.filter(c => aCantidad(c) !== null).length;
      if (col.nombre === undefined && numericas < celdas.length / 2) col.nombre = j;
      else if (col.cantidad === undefined && numericas >= celdas.length / 2) col.cantidad = j;
    }
  }
  if (col.nombre === undefined) return [];

  const out: MaterialLeido[] = [];
  for (const f of datos) {
    const nombre = f[col.nombre]?.replace(/\s+/g, ' ').trim();
    if (!nombre || aCantidad(nombre) !== null) continue;
    const cantidad = col.cantidad !== undefined ? aCantidad(f[col.cantidad]) : 1;
    if (cantidad === null) continue;
    out.push({
      nombre: nombre.slice(0, 80), cantidad,
      ...(col.estado !== undefined && aEstado(f[col.estado]) ? { estado: aEstado(f[col.estado]) } : {}),
      ...(col.ubicacion !== undefined && f[col.ubicacion] ? { ubicacion: f[col.ubicacion].slice(0, 80) } : {}),
    });
  }
  return out;
}

/** Un CSV (con «,», «;» o tabulador, y comillas) a filas. */
export function filasDeCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, '');
  const primera = t.split(/\r?\n/).find(l => l.trim()) ?? '';
  const sep = [';', '\t', ','].map(s => [s, primera.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: string[][] = [];
  let fila: string[] = [], celda = '', comillas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"' && t[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(celda); celda = ''; filas.push(fila); fila = [];
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

/**
 * Un texto suelto, una línea por material: «12 balones de voleibol»,
 * «Conos: 30», «Aros - 20», «Petos; 24». Las líneas sin cantidad se saltan:
 * podrían ser títulos o notas, no material.
 */
export function materialDeTexto(texto: string): MaterialLeido[] {
  const out: MaterialLeido[] = [];
  for (const crudo of texto.split(/\r?\n/)) {
    const l = crudo.trim().replace(/^(?:[-–*•·]\s*|\d+\s*[.)]\s+)/, '').trim();
    if (!l) continue;
    let m = /^(\d{1,4})\s*(?:x|×|uds?\.?|unidades?\s+de)?\s+(.{2,80})$/i.exec(l);
    if (m) { out.push({ nombre: m[2].trim(), cantidad: Number(m[1]) }); continue; }
    m = /^(.{2,80}?)\s*[:;\-–=]\s*(\d{1,4})\s*(?:uds?\.?|unidades?)?\s*$/i.exec(l);
    if (m && aCantidad(m[1]) === null) out.push({ nombre: m[1].trim(), cantidad: Number(m[2]) });
  }
  return out;
}

export interface MaterialPorImportar extends MaterialLeido {
  /** El material que ya tiene el mismo nombre en el inventario, si lo hay. */
  existente?: MaterialEF;
}

/** Junta los repetidos del propio documento (suma sus cantidades) y marca los que ya están en el inventario. */
export function prepararImportacion(leidos: readonly MaterialLeido[], inventario: readonly MaterialEF[]): MaterialPorImportar[] {
  const juntos = new Map<string, MaterialLeido>();
  for (const l of leidos) {
    const k = claveDeMaterial(l.nombre);
    if (!k) continue;
    const previo = juntos.get(k);
    if (previo) juntos.set(k, { ...previo, cantidad: previo.cantidad + l.cantidad, estado: previo.estado ?? l.estado, ubicacion: previo.ubicacion ?? l.ubicacion });
    else juntos.set(k, { ...l });
  }
  return [...juntos].map(([k, l]) => ({ ...l, existente: inventario.find(m => claveDeMaterial(m.nombre) === k) }));
}

/** El inventario con lo importado: lo nuevo se añade; lo que ya estaba toma la cantidad (y el estado y el sitio, si el documento los dice). */
export function aplicarImportacion(
  inventario: readonly MaterialEF[], elegidos: readonly MaterialPorImportar[], nuevoId: () => string,
): MaterialEF[] {
  const actualizados = new Map(elegidos.filter(e => e.existente).map(e => [e.existente!.id, e]));
  const base = inventario.map(m => {
    const e = actualizados.get(m.id);
    return e ? { ...m, cantidad: e.cantidad, estado: e.estado ?? m.estado, ubicacion: e.ubicacion ?? m.ubicacion } : m;
  });
  const nuevos = elegidos.filter(e => !e.existente).map(e => ({
    id: nuevoId(), nombre: e.nombre, cantidad: e.cantidad, estado: e.estado ?? 'bien' as const, ubicacion: e.ubicacion ?? '',
  }));
  return [...base, ...nuevos];
}
