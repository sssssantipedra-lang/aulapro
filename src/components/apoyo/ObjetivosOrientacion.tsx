/**
 * Los objetivos que vienen de la orientación: los que plantea el informe y los que indica la orientadora aunque no
 * estén en el informe. Cada uno con su programa y sus trimestres; la lista se edita aquí y se pasa después a los
 * programas del alumno. Ver `docs/PTAL.md`, «Objetivos de la orientación».
 */
import { useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useI18n } from '../../i18n';
import { nuevoIdApoyo } from '../../lib/apoyo';
import type { ObjetivoOrientacion, Trimestre } from '../../types/apoyo';

interface Props {
  objetivos: ObjetivoOrientacion[];
  onChange: (o: ObjetivoOrientacion[]) => void;
  /** Los programas (ámbitos) a los que se pueden asignar, por su nombre. */
  ambitos: readonly string[];
  /** Si el objetivo ya está en uno de sus programas. */
  enPrograma?: (o: ObjetivoOrientacion) => boolean;
}

const TRIMESTRES: Trimestre[] = [1, 2, 3];

export function ObjetivosOrientacion({ objetivos, onChange, ambitos, enPrograma }: Props) {
  const { t } = useI18n();
  const [nuevo, setNuevo] = useState('');
  const cambiar = (id: string, c: Partial<ObjetivoOrientacion>) => onChange(objetivos.map(o => (o.id === id ? { ...o, ...c } : o)));

  function anadir() {
    const texto = nuevo.trim();
    if (!texto) return;
    onChange([...objetivos, { id: nuevoIdApoyo('oo'), texto, trimestres: [1, 2, 3], origen: 'orientacion' }]);
    setNuevo('');
  }

  return (
    <div className="ap-oo">
      {objetivos.length === 0 && <p className="ap-sub" style={{ margin: 0 }}>{t('Todavía no hay objetivos de la orientación.')}</p>}
      <ul className="ap-oo-lista">
        {objetivos.map(o => (
          <li key={o.id} className="ap-oo-fila">
            <div className="ap-oo-cab">
              <span className={`sda-chip ap-origen ap-origen-${o.origen}`}>{t(o.origen === 'informe' ? 'Informe' : 'Orientación')}</span>
              {enPrograma?.(o) && <span className="sda-chip"><Check size={11} aria-hidden="true" /> {t('En su programa')}</span>}
            </div>
            <input className="finput" value={o.texto} aria-label={t('Objetivo')} onChange={e => cambiar(o.id, { texto: e.target.value })} />
            <div className="ap-oo-opc">
              <select className="finput ap-oo-amb" value={o.ambito ?? ''} aria-label={t('Programa')} onChange={e => cambiar(o.id, { ambito: e.target.value || undefined })}>
                <option value="">{t('Sin programa todavía')}</option>
                {ambitos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <div className="ap-trim" role="group" aria-label={t('Trimestres')}>
                {TRIMESTRES.map(n => {
                  const on = o.trimestres.includes(n);
                  return (
                    <button key={n} type="button" className={`chip sm accent${on ? ' on' : ''}`} aria-pressed={on} title={t('{n}º trimestre', { n })}
                      onClick={() => { const sig = on ? o.trimestres.filter(x => x !== n) : [...o.trimestres, n].sort() as Trimestre[]; if (sig.length) cambiar(o.id, { trimestres: sig }); }}>
                      {t('{n}º', { n })}
                    </button>
                  );
                })}
              </div>
              <button type="button" className="ico-btn" aria-label={t('Quitar el objetivo')} title={t('Quitar el objetivo')} onClick={() => onChange(objetivos.filter(x => x.id !== o.id))}>
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="ap-oo-nuevo">
        <input className="finput" value={nuevo} aria-label={t('Objetivo que indica la orientadora')} placeholder={t('Objetivo que indica la orientadora (aunque no esté en el informe)')}
          onChange={e => setNuevo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); anadir(); } }} />
        <button type="button" className="btn-ghost" onClick={anadir} disabled={!nuevo.trim()}><Plus size={14} />{t('Añadir')}</button>
      </div>
    </div>
  );
}
