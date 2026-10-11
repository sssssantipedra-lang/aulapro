/**
 * La clase (y la asignatura) con que se abre «Anotar actitud» al llegar desde
 * el Cuaderno. Sin pedido, se abre la clase que toca según el horario.
 */
import { unaVez } from './apoyoNav';

export interface ActitudPedido { classId: string; subject?: string }

const actitud = unaVez<ActitudPedido>();
export const requestActitud = actitud.pedir;
export const takeActitud = actitud.tomar;
export const useActitudPedido = actitud.usePedido;
