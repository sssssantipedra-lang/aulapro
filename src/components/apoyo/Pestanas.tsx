/**
 * Pestañas dentro de una pantalla de PT y AL («Mi alumnado» y la página de
 * cada alumno). Con las flechas del teclado se pasa a la de al lado.
 */
import { useRef } from 'react';

export function Pestanas<T extends string>({ items, value, onChange, label }: {
  items: readonly { id: T; label: string; n?: number }[];
  value: T;
  onChange: (id: T) => void;
  /** Para los lectores de pantalla. */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  function teclas(e: React.KeyboardEvent, i: number) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + items.length) % items.length;
    onChange(items[j].id);
    ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[j]?.focus();
  }
  return (
    <div className="al-tabs" role="tablist" aria-label={label} ref={ref}>
      {items.map((it, i) => {
        const on = it.id === value;
        return (
          <button
            key={it.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
            className={`al-tab${on ? ' on' : ''}`} onClick={() => onChange(it.id)} onKeyDown={e => teclas(e, i)}
          >
            {it.label}
            {it.n !== undefined && <span className="al-tab-n">{it.n}</span>}
          </button>
        );
      })}
    </div>
  );
}
