/**
 * Un archivo que el docente adjunta para la IA (el trabajo de un alumno en una rúbrica, un documento en el asistente
 * del cuaderno), con las reglas de privacidad del 31-10-2026: un documento (PDF, Word, texto) se convierte en texto
 * aquí, en el navegador, sin los datos que identifican, y nunca se envía el archivo; una foto pasa antes por «Tapa el
 * nombre» (`components/TaparNombre.tsx`) y sale con lo tapado pintado de negro. Ver `lib/documentoParaIA.ts`.
 */
import { useState } from 'react';
import { TaparNombre } from '../components/TaparNombre';
import { avisoDeLectura, esDocumento, leerDocumento, quitarIdentificadores } from '../lib/documentoParaIA';
import { fotoParaIA, LADO_FOTO_EXAMEN } from '../lib/fotos';
import { taparFoto } from '../lib/tapar';
import type { InlineFile } from '../services/gemini';

export const MAX_BYTES_ADJUNTO = 19 * 1024 * 1024;
export const ACEPTA_ADJUNTO = 'image/*,.pdf,.docx,.txt';

export interface AdjuntoIA {
  nombre: string;
  /** El texto del documento, ya sin los datos que identifican (los nombres del alumnado los cambia `callGemini`). */
  texto?: string;
  /** La foto, con lo tapado ya pintado. */
  imagen?: InlineFile;
}

/** `onError` recibe el texto en castellano: quien llama lo traduce. */
export function useAdjuntoParaIA(onError: (mensaje: string) => void) {
  const [adjunto, setAdjunto] = useState<AdjuntoIA | null>(null);
  const [porTapar, setPorTapar] = useState<{ nombre: string; foto: InlineFile } | null>(null);

  async function elegir(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES_ADJUNTO) { onError('El archivo supera el límite de 19 MB.'); return; }
    try {
      if (file.type.startsWith('image/')) { setPorTapar({ nombre: file.name, foto: await fotoParaIA(file, LADO_FOTO_EXAMEN) }); return; }
      if (!esDocumento(file)) { onError('Adjunta una foto, un PDF, un Word (.docx) o un texto.'); return; }
      const texto = quitarIdentificadores(await leerDocumento(file)).trim();
      if (!texto) { onError('El documento no tiene texto que leer.'); return; }
      setAdjunto({ nombre: file.name, texto });
    } catch (e) {
      onError(file.type.startsWith('image/') ? 'Alguno de esos archivos no es una imagen que se pueda usar.' : avisoDeLectura(e));
    }
  }

  async function tapada(zonas: Parameters<typeof taparFoto>[1]) {
    if (!porTapar) return;
    try { setAdjunto({ nombre: porTapar.nombre, imagen: await taparFoto(porTapar.foto, zonas) }); }
    catch { onError('Alguno de esos archivos no es una imagen que se pueda usar.'); }
    setPorTapar(null);
  }

  const ventana = (
    <TaparNombre key={porTapar?.nombre ?? 'cerrado'} foto={porTapar?.foto ?? null} onListo={z => void tapada(z)} onCancelar={() => setPorTapar(null)} />
  );

  return {
    adjunto,
    elegir,
    quitar: () => setAdjunto(null),
    /** La ventana de tapar: hay que pintarla en la pantalla que usa el adjunto. */
    ventana,
    /** Las imágenes que van a la IA como archivo (solo la foto ya tapada). */
    archivos: adjunto?.imagen ? [adjunto.imagen] : [],
  };
}
