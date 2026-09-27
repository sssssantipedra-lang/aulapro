import { useState } from 'react';

const UNSET = Symbol('unset');

/**
 * Ejecuta `reset` cada vez que cambia `key` (y también al montar), en el
 * mismo render y no en un efecto después.
 *
 * Es el patrón que recomienda React para «reiniciar un formulario cuando se
 * abre con otros datos»: con un `useEffect` el modal se pintaba un instante
 * con los datos anteriores y luego otra vez con los buenos. `reset` solo debe
 * llamar a setters del propio componente, nunca a los del padre.
 *
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 */
export function useResetOnChange(key: string, reset: () => void): void {
  const [prev, setPrev] = useState<string | typeof UNSET>(UNSET);
  if (prev !== key) {
    setPrev(key);
    reset();
  }
}
