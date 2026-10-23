import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { ILUSTRACIONES, urlIlustracion, nombreIlustracion } from '../../lib/ilustraciones';
import { PICTOS, urlPicto, nombrePicto } from '../../lib/pictos';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (tipo: 'ilustracion' | 'picto', id: string) => void;
}

/** Selector de la imagen de una tarjeta interactiva: ilustraciones del catálogo o pictogramas. */
export function TarjetaImagenPicker({ open, onClose, onPick }: Props) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<'ilustracion' | 'picto'>('ilustracion');
  const [q, setQ] = useState('');

  const s = q.trim().toLowerCase();
  const ilustraciones = useMemo(() => {
    const base = ILUSTRACIONES.filter(i => i.fuente === 'img');
    if (!s) return base;
    return base.filter(i => i.descripcion[lang].toLowerCase().includes(s) || i.temas.some(x => x.includes(s)));
  }, [s, lang]);
  const pictos = useMemo(() => {
    if (!s) return PICTOS;
    return PICTOS.filter(p => p.es.toLowerCase().includes(s) || p.ca.toLowerCase().includes(s) || p.en.toLowerCase().includes(s));
  }, [s]);

  return (
    <Modal open={open} onClose={onClose} title={t('Elegir imagen')} wide>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" className={`chip sm accent${tab === 'ilustracion' ? ' on' : ''}`} onClick={() => setTab('ilustracion')}>{t('Ilustraciones')}</button>
        <button type="button" className={`chip sm accent${tab === 'picto' ? ' on' : ''}`} onClick={() => setTab('picto')}>{t('Pictogramas')}</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 10, padding: '6px 10px', marginBottom: 12 }}>
        <Search size={15} color="var(--text-3)" aria-hidden="true" />
        <input
          className="finput" style={{ border: 'none', padding: 0, boxShadow: 'none' }}
          value={q} onChange={e => setQ(e.target.value)} placeholder={t('Buscar por nombre o tema')}
        />
      </div>

      <div className="tarjeta-img-grid">
        {tab === 'ilustracion'
          ? ilustraciones.map(i => (
            <button key={i.id} type="button" className="tarjeta-img" onClick={() => onPick('ilustracion', i.id)} title={nombreIlustracion(i.id, lang)}>
              <img src={urlIlustracion(i.id)} alt="" loading="lazy" draggable={false} />
            </button>
          ))
          : pictos.map(p => (
            <button key={p.id} type="button" className="tarjeta-img" onClick={() => onPick('picto', p.id)} title={nombrePicto(p, lang)}>
              <img src={urlPicto(p.id)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
      </div>
    </Modal>
  );
}
