/**
 * Un campo para escribir un número (24-11-2026, aviso del dueño con una captura de «Alumnos por mesa»: al borrar la
 * cifra salía un 1 al instante y costaba escribir otro número).
 *
 * Antes cada pantalla corregía el número en cada pulsación (`Math.max(1, Number(valor) || 1)`), así que el cuadro no
 * podía quedarse vacío ni pasar por un número fuera del margen (escribir 45 minutos con un mínimo de 20 pasa por el 4).
 * Ahora el cuadro guarda lo que se escribe tal cual: vacío, a medias o fuera del margen, y solo se avisa a la pantalla
 * (`onChange`) cuando lo escrito es un número válido dentro de `min` y `max`. Al salir del campo (o con Intro), un
 * número fuera del margen se lleva al límite más cercano y un cuadro vacío o que no es un número vuelve al último
 * valor bueno. La pantalla nunca recibe un número fuera del margen ni `NaN`.
 *
 * Cualquier campo nuevo donde se escriba una cantidad usa este componente, no `<input type="number">` con su
 * propia corrección.
 */
import { useState, type InputHTMLAttributes } from 'react';
import { numeroEscrito, numeroAlSalir } from '../../lib/campoNumero';

type Nativos = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step' | 'defaultValue'>;

interface Props extends Nativos {
  /** El número de la pantalla. `null` o `undefined` solo con `onVaciar`: el campo se ve vacío. */
  value: number | null | undefined;
  onChange: (n: number) => void;
  /**
   * Para un dato que puede quedarse sin poner (las horas de una formación): borrar la cifra lo deja vacío de verdad
   * y se avisa aquí, en vez de volver al último número al salir.
   */
  onVaciar?: () => void;
  min?: number;
  max?: number;
  /** Paso del número (y de las flechas). Con `decimales` falso, se redondea a entero. */
  step?: number;
  /** Admite decimales (con coma o punto). De partida, solo enteros. */
  decimales?: boolean;
}

export function CampoNumero({ value, onChange, onVaciar, min, max, step, decimales = false, onBlur, onKeyDown, className, inputMode, ...resto }: Props) {
  const limites = { min, max, decimales };
  // Lo que se ve en el cuadro mientras se escribe, o `null` cuando no se está escribiendo (se ve `value`)
  const [escrito, setEscrito] = useState<string | null>(null);
  const hay = typeof value === 'number' && Number.isFinite(value);
  const texto = escrito ?? (hay ? String(value).replace('.', decimales ? ',' : '.') : '');

  const terminar = () => {
    if (escrito === null) return;
    setEscrito(null);
    if (onVaciar && escrito.trim() === '') return;
    // Sin número anterior (un dato que estaba sin poner) y nada válido escrito: se queda sin poner
    if (!hay && numeroEscrito(escrito, { decimales }) === null && !/\d/.test(escrito)) return;
    const n = numeroAlSalir(escrito, hay ? value : (min ?? 0), limites);
    if (n !== value) onChange(n);
  };

  return (
    <input
      {...resto}
      type="text"
      inputMode={inputMode ?? (decimales ? 'decimal' : 'numeric')}
      className={className ?? 'finput'}
      value={texto}
      onChange={e => {
        const t = e.target.value;
        setEscrito(t);
        if (t.trim() === '' && onVaciar) { if (hay) onVaciar(); return; }
        const n = numeroEscrito(t, limites);
        if (n !== null && n !== value) onChange(n);
      }}
      onBlur={e => { terminar(); onBlur?.(e); }}
      onKeyDown={e => {
        if (e.key === 'Enter') terminar();
        // Las flechas suben y bajan como en un campo de número
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.altKey) {
          e.preventDefault();
          const paso = step ?? 1;
          const base = numeroEscrito(escrito ?? texto, { decimales }) ?? (hay ? value : (min ?? 0) - (e.key === 'ArrowUp' ? paso : -paso));
          const n = numeroAlSalir(String(base + (e.key === 'ArrowUp' ? paso : -paso)), hay ? value : (min ?? 0), limites);
          setEscrito(null);
          if (n !== value) onChange(n);
        }
        onKeyDown?.(e);
      }}
    />
  );
}
