import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImagenSesion } from '../types/ef';
import {
  MAX_IMAGENES_SESION, imagenesDeTransferencia, leerTransferencia, prepararNuevas, traeImagen, type Transferencia,
} from '../lib/imagenesSesion';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

/**
 * Imágenes en el editor de una sesión (25-10-2026): se pegan con Ctrl+V desde
 * cualquier sitio del editor (una imagen copiada de internet, una captura de
 * pantalla, un archivo copiado), se arrastran sobre el editor o se eligen de un
 * archivo. Todo pasa por `añadir`, que las reduce antes de guardarlas
 * (`lib/imagenesSesion.ts`). La pantalla está en `components/sesiones/ImagenesSesion.tsx`.
 */

type Cambiar = (f: (anteriores: ImagenSesion[]) => ImagenSesion[]) => void;

export interface EntradaDeImagenes {
  imagenes: ImagenSesion[];
  cambiar: Cambiar;
  ocupado: boolean;
  /** Para el contenedor del editor: arrastrar y soltar. */
  arrastre: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  arrastrando: boolean;
  /** Imágenes ya leídas (el botón «Elegir imagen»). */
  añadir: (blobs: Blob[]) => Promise<void>;
}

/**
 * `activo`: el editor está abierto y no hay otra ventana encima. Solo entonces
 * se atiende el pegado de todo el documento.
 */
export function useEntradaDeImagenes(imagenes: ImagenSesion[], cambiar: Cambiar, activo: boolean): EntradaDeImagenes {
  const { t } = useI18n();
  const { toast } = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const cuantas = useRef(imagenes.length);
  useEffect(() => { cuantas.current = imagenes.length; });

  const añadir = useCallback(async (blobs: Blob[]) => {
    if (blobs.length === 0) return;
    const cuenta = (n: number, uno: string, varios: string) => t(n === 1 ? uno : varios, { n });
    setOcupado(true);
    try {
      const { nuevas, porElTope, ilegibles } = await prepararNuevas(blobs, MAX_IMAGENES_SESION - cuantas.current);
      if (nuevas.length) cambiar(prev => [...prev, ...nuevas].slice(0, MAX_IMAGENES_SESION));
      if (porElTope > 0) toast(t('Solo caben {n} imágenes en una sesión.', { n: MAX_IMAGENES_SESION }));
      else if (ilegibles > 0) toast(cuenta(ilegibles, 'No se ha podido leer {n} imagen.', 'No se han podido leer {n} imágenes.'));
    } finally {
      setOcupado(false);
    }
  }, [cambiar, t, toast]);

  const procesar = useCallback(async (tr: Transferencia) => {
    setOcupado(true);
    try {
      const { blobs, sinRecuperar } = await imagenesDeTransferencia(tr);
      if (sinRecuperar > 0) toast(t('No se ha podido traer la imagen de esa web. Guárdala en tu equipo y arrástrala aquí.'));
      await añadir(blobs);
    } finally {
      setOcupado(false);
    }
  }, [añadir, t, toast]);

  // Pegar (Ctrl+V) en cualquier punto del editor
  useEffect(() => {
    if (!activo) return;
    const alPegar = (e: ClipboardEvent) => {
      const tr = leerTransferencia(e.clipboardData);
      if (!traeImagen(tr)) return;
      const el = e.target as HTMLElement | null;
      const enTexto = !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable);
      // Copiar celdas de Excel o un trozo de Word trae texto y una imagen de ese trozo: gana el texto
      if (enTexto && tr.texto.trim()) return;
      e.preventDefault();
      void procesar(tr);
    };
    document.addEventListener('paste', alPegar);
    return () => document.removeEventListener('paste', alPegar);
  }, [activo, procesar]);

  const vieneImagen = (e: React.DragEvent) => {
    const tipos = Array.from(e.dataTransfer?.types ?? []);
    // Archivos, o una imagen de una web (trae su dirección). Un texto suelto, no.
    return tipos.includes('Files') || tipos.includes('text/uri-list');
  };

  const arrastre = {
    onDragOver: (e: React.DragEvent) => {
      if (!vieneImagen(e)) return;
      e.preventDefault();
      setArrastrando(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Solo si sale del editor, no al pasar de un hijo a otro
      if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) setArrastrando(false);
    },
    onDrop: (e: React.DragEvent) => {
      setArrastrando(false);
      const tr = leerTransferencia(e.dataTransfer);
      if (!traeImagen(tr)) return;
      e.preventDefault();
      void procesar(tr);
    },
  };

  return { imagenes, cambiar, ocupado, arrastre, arrastrando, añadir };
}
