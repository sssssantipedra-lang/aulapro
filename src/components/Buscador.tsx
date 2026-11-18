/**
 * El buscador general (18-11-2026): «¿Qué quieres hacer?». Una caja para ir a
 * cualquier pantalla, clase, alumno, rúbrica, diana, escala, situación de
 * aprendizaje o ficha. Se abre con el botón «Buscar» del menú o con Ctrl+K
 * (⌘K en Mac); flechas para moverse, Intro para ir y Esc para cerrar. Qué
 * encuentra y en qué orden, en `lib/buscador.ts`.
 */
import { useMemo, useState } from 'react';
import { BookOpen, ClipboardCheck, CornerDownLeft, FileText, LayoutGrid, Search, Target, ThumbsUp, User, Users } from 'lucide-react';
import { useI18n } from '../i18n';
import { buscar, NOMBRE_TIPO, type DatosDelBuscador, type Resultado, type TipoResultado } from '../lib/buscador';

const ICONO: Record<TipoResultado, typeof Search> = {
  pantalla: LayoutGrid, clase: Users, alumno: User, rubrica: ClipboardCheck, diana: Target, escala: ThumbsUp, sda: BookOpen, ficha: FileText,
};

export function Buscador({ datos, onElegir, onCerrar }: {
  datos: DatosDelBuscador;
  onElegir: (r: Resultado) => void;
  onCerrar: () => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(0);
  const resultados = useMemo(() => buscar(q, datos, t), [q, datos, t]);
  const elegido = Math.min(activo, Math.max(0, resultados.length - 1));

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(Math.min(elegido + 1, resultados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(Math.max(elegido - 1, 0)); }
    else if (e.key === 'Enter' && resultados[elegido]) { e.preventDefault(); onElegir(resultados[elegido]); }
    else if (e.key === 'Escape') { e.preventDefault(); onCerrar(); }
  };

  return (
    <div className="bq-fondo" onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="bq" role="dialog" aria-modal="true" aria-label={t('Buscar en AulaPro')} onKeyDown={tecla}>
        <div className="bq-caja">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus type="search" value={q} onChange={e => { setQ(e.target.value); setActivo(0); }}
            placeholder={t('¿Qué quieres hacer? Escribe una pantalla, una clase, un alumno…')}
            aria-label={t('Buscar en AulaPro')} aria-controls="bq-lista" aria-activedescendant={resultados[elegido] ? `bq-${elegido}` : undefined}
            autoComplete="off" spellCheck={false}
          />
          <button type="button" className="bq-esc" onClick={onCerrar}>{t('Cerrar')}</button>
        </div>
        {resultados.length === 0 ? (
          <p className="bq-vacio">{t('No hay nada con «{texto}». Prueba con menos letras o con otra palabra.', { texto: q.trim() })}</p>
        ) : (
          <ul id="bq-lista" className="bq-lista" role="listbox" aria-label={t('Resultados')}>
            {resultados.map((r, i) => {
              const Icono = ICONO[r.tipo];
              // El nombre del tipo, una vez, encima del primero de cada grupo
              const cabecera = i === 0 || resultados[i - 1].tipo !== r.tipo;
              return (
                <li key={`${r.tipo}-${r.id}`} role="presentation">
                  {cabecera && <span className="bq-tipo">{t(NOMBRE_TIPO[r.tipo])}</span>}
                  <button
                    type="button" id={`bq-${i}`} role="option" aria-selected={i === elegido}
                    className={`bq-res${i === elegido ? ' on' : ''}`}
                    onMouseEnter={() => setActivo(i)} onClick={() => onElegir(r)}
                  >
                    <Icono size={16} aria-hidden="true" />
                    <span className="bq-res-txt"><b>{r.titulo}</b>{r.detalle && <small>{r.detalle}</small>}</span>
                    {i === elegido && <CornerDownLeft size={14} aria-hidden="true" className="bq-intro" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="bq-pie">{t('Flechas para moverte, Intro para ir y Esc para cerrar.')}</p>
      </div>
    </div>
  );
}
