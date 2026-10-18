/**
 * Ventana para elegir a qué clases se copia algo (una situación de aprendizaje,
 * unas sesiones). Las clases salen agrupadas por etapa y marcadas de partida
 * las del mismo curso que el de origen, salvo la propia clase y las que ya lo
 * tienen. Ver `lib/clonar.ts`.
 */
import { useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useI18n } from '../i18n';
import { agruparPorEtapa } from '../lib/etapas';
import { mismoNivel } from '../lib/clonar';
import type { Class } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  titulo: string;
  /** Qué se copia, en una frase. */
  texto: string;
  classes: Class[];
  /** La clase de la que se copia: no sale entre las de destino. */
  origen?: Class;
  /** Las clases que ya lo tienen: salen sin marcar y con el aviso. */
  yaLoTienen?: ReadonlySet<string>;
  /** Lo que haya que elegir antes de las clases (por ejemplo, qué sesiones). */
  arriba?: ReactNode;
  /** El texto del botón, según cuántas clases se han elegido. */
  boton: (n: number) => string;
  /** Si no hay nada que copiar, el botón no deja. */
  deshabilitado?: boolean;
  onConfirm: (clasesIds: string[]) => void;
}

export function CopiarAClases({ open, onClose, titulo, texto, classes, origen, yaLoTienen, arriba, boton, deshabilitado, onConfirm }: Props) {
  const { t } = useI18n();
  const destinos = classes.filter(c => c.id !== origen?.id);
  const deSalida = () => destinos.filter(c => (!origen || mismoNivel(origen, c)) && !yaLoTienen?.has(c.id)).map(c => c.id);
  const [elegidas, setElegidas] = useState<string[]>(deSalida);
  // Cada vez que se abre, vuelve a empezar con las del mismo curso marcadas
  const [vista, setVista] = useState(open);
  if (open !== vista) {
    setVista(open);
    if (open) setElegidas(deSalida());
  }

  const alternar = (id: string) => setElegidas(e => (e.includes(id) ? e.filter(x => x !== id) : [...e, id]));

  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      <div className="ap-form">
        <p className="ap-sub" style={{ gridColumn: '1 / -1' }}>{texto}</p>
        {arriba && <div style={{ gridColumn: '1 / -1' }}>{arriba}</div>}
        {destinos.length === 0
          ? <p className="ap-vacio" style={{ gridColumn: '1 / -1' }}>{t('No tienes más clases. Crea las otras clases en Mis Clases y vuelve aquí.')}</p>
          : (
            <div className="copiar-clases" style={{ gridColumn: '1 / -1' }}>
              {agruparPorEtapa(destinos).map(g => (
                <fieldset key={g.id} className="copiar-grupo">
                  <legend>{t(g.label)}</legend>
                  {g.clases.map(c => {
                    const tiene = yaLoTienen?.has(c.id);
                    return (
                      <label key={c.id} className="td-chk">
                        <input type="checkbox" checked={elegidas.includes(c.id)} onChange={() => alternar(c.id)} />
                        <span>{c.name}</span>
                        {origen && !mismoNivel(origen, c) && <span className="ap-sub">{t('otro curso')}</span>}
                        {tiene && <span className="ap-sub">{t('ya la tiene')}</span>}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
        <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
          <button className="btn-accent" disabled={deshabilitado || elegidas.length === 0}
            onClick={() => onConfirm(elegidas)}>
            <Copy size={15} />{boton(elegidas.length)}
          </button>
          <button className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        </div>
      </div>
    </Modal>
  );
}
