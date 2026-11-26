/**
 * Un juego del catálogo, abierto: su código se pide al abrirlo (`Juego.cargar`) y se enseña encima de la pantalla.
 * Cada juego tiene su componente fijo, creado una vez al cargar este módulo.
 */
import { Suspense, createElement, lazy } from 'react';
import { JUEGOS, type PropsJuego } from '../../lib/juegos/catalogo';

const COMPONENTES = new Map(JUEGOS.map(j => [j.id, lazy(j.cargar)]));

export function JuegoAbierto({ id, ...props }: PropsJuego & { id: string }) {
  const componente = COMPONENTES.get(id);
  return componente ? <Suspense fallback={null}>{createElement(componente, props)}</Suspense> : null;
}
