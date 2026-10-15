/**
 * El compositor de fichas: mide la hoja ya maquetada y elige cuánto aire lleva para que quepa bien en el papel.
 *
 * El código decide la maqueta (cuántos ejercicios, qué espacios de respuesta) y el diseño «Cuaderno» la dibuja
 * con un factor de densidad (`--d`, ver `lib/densidad.ts`). Aquí se carga el HTML que se va a imprimir en un
 * marco oculto, se mide con cada una de las cuatro densidades (`lib/paginacion.ts`) y se queda con la que ocupa
 * menos hojas y deja menos huecos al pie. Se hace en el navegador de la propia app, así que vale igual en el
 * escritorio, en Android y en la vista previa; sin medir nada (pruebas sin diseño, marco que no carga) devuelve
 * `null` y la hoja se queda en la densidad normal.
 */
import { DENSIDADES, elegirDensidad, type Densidad, type MedidaPaginas } from '../lib/densidad';
import { AREA_FICHA, medirPaginas } from '../lib/paginacion';

export type MedidasPorDensidad = Record<Densidad, MedidaPaginas>;

export interface Composicion {
  /** La densidad que mejor deja la hoja. */
  densidad: Densidad;
  /** Lo que ocupa la hoja con cada densidad. */
  medidas: MedidasPorDensidad;
}

/** Lo más que se espera a que cargue el marco (letras y dibujos van dentro del HTML, así que es poco). */
const ESPERA_MS = 4000;

const CLASE_DENSIDAD = /\bd-(apretada|compacta|holgada)\b/g;

/**
 * Mide un documento ya cargado con cada densidad. Cambia la clase `d-…` de la ficha y el estilo del documento:
 * pásale uno que no se vaya a seguir usando. Sin ficha «Cuaderno» dentro, devuelve `null`.
 */
export function medirDensidades(doc: Document): MedidasPorDensidad | null {
  const ficha = doc.querySelector<HTMLElement>('.ficha-doc.th-cuaderno');
  if (!ficha) return null;
  const base = ficha.className.replace(CLASE_DENSIDAD, '').replace(/\s+/g, ' ').trim();
  const medidas = {} as MedidasPorDensidad;
  for (const d of DENSIDADES) {
    ficha.className = d === 'normal' ? base : `${base} d-${d}`;
    medidas[d] = medirPaginas(doc);
  }
  ficha.className = base;
  return medidas;
}

const espera = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

/**
 * Carga el HTML en un marco oculto, del tamaño del área imprimible, y lo mide. `null` si no se puede
 * (sin navegador, el marco no carga o la hoja no es «Cuaderno»).
 */
export async function medirHoja(html: string, esperaMs: number = ESPERA_MS): Promise<MedidasPorDensidad | null> {
  if (typeof document === 'undefined' || !document.body) return null;
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.tabIndex = -1;
  marco.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.ceil(AREA_FICHA.ancho)}px;height:${Math.ceil(AREA_FICHA.alto)}px;` +
    'border:0;opacity:0;pointer-events:none';
  document.body.appendChild(marco);
  try {
    await Promise.race([
      new Promise<void>(resolve => { marco.onload = () => resolve(); marco.srcdoc = html; }),
      espera(esperaMs),
    ]);
    const doc = marco.contentDocument;
    if (!doc?.body) return null;
    // Letras y dibujos van dentro del HTML: se espera a que estén listos para medir con ellos
    await Promise.race([
      Promise.all([
        doc.fonts?.ready ?? Promise.resolve(),
        ...Array.from(doc.images).map(i => (i.decode ? i.decode().catch(() => undefined) : Promise.resolve())),
      ]),
      espera(esperaMs),
    ]);
    return medirDensidades(doc);
  } catch {
    return null;
  } finally {
    marco.remove();
  }
}

/** Mide la hoja y elige la densidad. `null` si no se pudo medir: quien llama se queda con la normal. */
export async function componerHoja(html: string, esperaMs: number = ESPERA_MS): Promise<Composicion | null> {
  const medidas = await medirHoja(html, esperaMs);
  return medidas ? { densidad: elegirDensidad(medidas), medidas } : null;
}
