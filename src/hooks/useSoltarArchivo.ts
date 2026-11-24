import { useEffect, useRef, useState } from 'react';

/**
 * Arrastrar un archivo sobre una pantalla (24-11-2026, cuaderno: «que se pueda arrastrar el archivo» de notas).
 *
 * Se escucha en toda la ventana, no en un elemento: el docente suelta el Excel donde caiga (encima de la tabla, de la
 * barra o de la ventana de importar) y llega igual. Solo cuenta lo que trae archivos: arrastrar un texto o una
 * columna del propio cuaderno no hace nada. Mientras la pantalla está montada, un archivo soltado nunca lo abre el
 * navegador (que cambiaría de página y dejaría la app); si no se puede importar ahora, `alSoltar` lo dice.
 *
 * `arrastrando` vale `true` mientras hay un archivo encima de la ventana, para enseñar dónde soltarlo. Se cuenta con
 * un contador de `dragenter` y `dragleave`, porque se disparan al pasar de un elemento a otro.
 */
export function useSoltarArchivo(
  alSoltar: (archivos: File[]) => void,
  /** Si ahora se puede soltar: si no, el cursor lo dice (`dropEffect = 'none'`), aunque el navegador sigue sin abrir el archivo. */
  sePuede: () => boolean = () => true,
): { arrastrando: boolean } {
  const [arrastrando, setArrastrando] = useState(false);
  const llamar = useRef(alSoltar);
  const puede = useRef(sePuede);
  useEffect(() => { llamar.current = alSoltar; puede.current = sePuede; });

  useEffect(() => {
    let dentro = 0;
    // Mientras hay un archivo encima, el navegador manda `dragover` sin parar (aunque el puntero esté quieto). Si deja
    // de llegar, el arrastre se fue sin avisar (un `dragleave` perdido): la marca se quita sola.
    let vigilancia: ReturnType<typeof setTimeout> | undefined;
    const quitar = () => { clearTimeout(vigilancia); dentro = 0; setArrastrando(false); };
    const vigilar = () => { clearTimeout(vigilancia); vigilancia = setTimeout(quitar, 1000); };
    const traeArchivos = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!traeArchivos(e)) return;
      dentro++;
      setArrastrando(true);
      vigilar();
    };
    const over = (e: DragEvent) => {
      if (!traeArchivos(e)) return;
      // Sin esto, soltar abre el archivo en la pestaña
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = puede.current() ? 'copy' : 'none';
      vigilar();
      // Por si un `dragleave` se adelantó a su `dragenter` (pasa en Safari): mientras se mueve encima, sigue puesta
      setArrastrando(true);
    };
    const leave = (e: DragEvent) => {
      if (!traeArchivos(e)) return;
      dentro = Math.max(0, dentro - 1);
      // Al salir de la ventana el último `dragleave` lleva el puntero en el borde o fuera: se quita aunque la cuenta
      // no cuadre (algunos navegadores no mandan todos los `dragenter`)
      const fuera = e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
      if (dentro === 0 || fuera) quitar();
    };
    const drop = (e: DragEvent) => {
      if (!traeArchivos(e)) return;
      e.preventDefault();
      quitar();
      const archivos = Array.from(e.dataTransfer?.files ?? []);
      if (archivos.length > 0) llamar.current(archivos);
    };
    // Si el arrastre se cancela (Escape) o acaba fuera, no queda la marca puesta
    const fin = quitar;
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', fin);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', fin);
      clearTimeout(vigilancia);
    };
  }, []);

  return { arrastrando };
}
