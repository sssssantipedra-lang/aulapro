/**
 * Saltos entre pantallas de PT y AL con algo ya elegido. Como
 * `settingsNav.ts`: se piden antes de navegar y la pantalla los lee una sola
 * vez al abrirse, con su `use…Pedido`.
 *
 * La pantalla lo lee al dibujarse y lo olvida cuando ya está en pantalla, no
 * antes: React puede dibujar una pantalla recién cargada, descartar ese
 * dibujo y repetirlo, y si el pedido se hubiera olvidado al leerlo la
 * segunda vez llegaría vacío.
 */
import { useEffect, useState } from 'react';

/** Un pedido que se guarda hasta que una pantalla lo usa. */
function unaVez<T>() {
  let pendiente: T | null = null;
  return {
    pedir(v: T) { pendiente = v; },
    /** Lo pedido, y se olvida (para las pruebas y para leerlo fuera de React). */
    tomar(): T | null {
      const v = pendiente;
      pendiente = null;
      return v;
    },
    /** Lo pedido al abrirse la pantalla; se olvida en cuanto se monta. */
    usePedido(): T | null {
      const [v] = useState(() => pendiente);
      useEffect(() => { pendiente = null; }, []);
      return v;
    },
  };
}

/**
 * El grupo y el día que se quieren abrir en el Registro diario al llegar
 * desde el Inicio («Registrar» en una sesión de hoy o en una que se quedó sin
 * registrar) o desde la página de un alumno («Registrar sesión»).
 */
export interface RegistroPedido { grupoId: string; fecha: string }

const registro = unaVez<RegistroPedido>();
export const requestRegistro = registro.pedir;
export const takeRegistro = registro.tomar;
export const useRegistroPedido = registro.usePedido;

/**
 * El alumno para el que se quiere una ficha adaptada al llegar a Recursos
 * desde su página.
 */
const fichaPara = unaVez<string>();
export const requestFichaPara = fichaPara.pedir;
export const takeFichaPara = fichaPara.tomar;
export const useFichaParaPedido = fichaPara.usePedido;

/**
 * La página de un alumno (`apoyo-alumno`) y la pestaña con la que se abre.
 * Decisión del dueño (6-10-2026): todo lo de un alumno está en su página, en
 * pestañas, en vez de repartido por varias pantallas del menú.
 */
export type PestanaAlumno = 'resumen' | 'programa' | 'sesiones' | 'coordinaciones' | 'documentos' | 'datos';
export interface AlumnoPedido { alumnoId: string; pestana: PestanaAlumno }

const alumno = unaVez<AlumnoPedido>();
export function requestAlumno(alumnoId: string, pestana: PestanaAlumno = 'resumen') {
  alumno.pedir({ alumnoId, pestana });
}
export const takeAlumno = alumno.tomar;
export const useAlumnoPedido = alumno.usePedido;

/**
 * «Mi alumnado» abierto en la pestaña Grupos y, si se da, con ese grupo
 * abierto para cambiarlo (desde un bloque de la Agenda, por ejemplo).
 */
const grupos = unaVez<{ grupoId?: string }>();
export function requestGrupos(grupoId?: string) {
  grupos.pedir({ grupoId });
}
export const takeGrupos = grupos.tomar;
export const useGruposPedido = grupos.usePedido;

/** La Agenda visual con las agendas de un alumno, al llegar desde su página. */
const agendaPara = unaVez<string>();
export const requestAgendaPara = agendaPara.pedir;
export const takeAgendaPara = agendaPara.tomar;
export const useAgendaParaPedido = agendaPara.usePedido;
