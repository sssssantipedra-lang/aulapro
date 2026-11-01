/**
 * Versión web: AulaPro abierta en una sola pestaña o ventana a la vez (auditoría del 1-11-2026; ver
 * `platform/unaPestana.ts`). Dos pantallas:
 *
 *  - `PestanaOcupada`: al abrir, si otra pestaña ya tiene la app. «Usar AulaPro aquí» se la queda.
 *  - `AvisoPestanaPerdida`: en la pestaña que la tenía, cuando otra se la queda. Esta ya no guarda nada (lo que tiene en
 *    memoria no es lo último) y solo ofrece recargar.
 */
import { useEffect, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n';
import { PESTANA_PERDIDA, pestanaPerdida } from '../platform/unaPestana';

const PANTALLA: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', padding: 16,
};

export function PestanaOcupada({ onUsarAqui }: { onUsarAqui: () => void }) {
  const { t } = useI18n();
  const [ocupado, setOcupado] = useState(false);
  return (
    <div style={PANTALLA}>
      <div className="card" role="alert" style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 12 }}>
        <div className="card-ttl" style={{ fontSize: 17 }}><Copy size={18} aria-hidden="true" />{t('AulaPro ya está abierta en otra pestaña o ventana')}</div>
        <p style={{ margin: 0 }}>{t('Para no pisar tu trabajo, AulaPro solo se usa en una pestaña a la vez. Vuelve a la otra o úsala aquí: la otra dejará de guardar.')}</p>
        <div>
          <button type="button" className="btn-accent" disabled={ocupado} onClick={() => { setOcupado(true); onUsarAqui(); }}>
            {ocupado ? <span className="spin" /> : null}{t('Usar AulaPro aquí')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AvisoPestanaPerdida() {
  const { t } = useI18n();
  const [perdida, setPerdida] = useState(pestanaPerdida);
  useEffect(() => {
    const alPerder = () => setPerdida(true);
    window.addEventListener(PESTANA_PERDIDA, alPerder);
    return () => window.removeEventListener(PESTANA_PERDIDA, alPerder);
  }, []);
  if (!perdida) return null;
  return (
    <div style={{ ...PANTALLA, position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, 0.55)' }}>
      <div className="card" role="alertdialog" aria-modal="true" style={{ maxWidth: 520, width: '100%', display: 'grid', gap: 12 }}>
        <div className="card-ttl" style={{ fontSize: 17 }}><Copy size={18} aria-hidden="true" />{t('AulaPro se ha abierto en otra pestaña o ventana')}</div>
        <p style={{ margin: 0 }}>{t('Esta pestaña ha dejado de guardar para no pisar lo que hagas en la otra. Tu trabajo está a salvo.')}</p>
        <div>
          <button type="button" className="btn-accent" onClick={() => window.location.reload()}>
            <RotateCcw size={15} />{t('Usar AulaPro aquí')}
          </button>
        </div>
      </div>
    </div>
  );
}
