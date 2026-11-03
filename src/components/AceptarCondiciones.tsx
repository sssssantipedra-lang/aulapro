import { useState } from 'react';
import { useI18n } from '../i18n';
import { aceptarCondiciones } from '../lib/condiciones';

/**
 * La casilla de las condiciones y la privacidad (`lib/condiciones.ts`). Sin marcar, no se puede seguir. Va en la
 * pantalla de entrada y, sola, para quien ya había entrado antes de que existiera o cuando cambia la versión.
 */
export function CasillaCondiciones({ marcada, onCambio }: { marcada: boolean; onCambio: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <label className="entrar-acepto">
      <input type="checkbox" checked={marcada} onChange={e => onCambio(e.target.checked)} />
      <span>
        {t('He leído y acepto las')}{' '}
        <a href="../condiciones.html" target="_blank" rel="noopener noreferrer">{t('condiciones de venta y de uso')}</a>{' '}
        {t('y la')}{' '}
        <a href="../privacidad.html" target="_blank" rel="noopener noreferrer">{t('política de privacidad')}</a>.
      </span>
    </label>
  );
}

/** Pantalla para quien ya tenía la sesión abierta: tiene que marcar la casilla una vez para seguir. */
export function AceptarCondiciones({ onAceptar }: { onAceptar: () => void }) {
  const { t } = useI18n();
  const [marcada, setMarcada] = useState(false);
  return (
    <div className="lic-shell entrar">
      <div className="entrar-caja">
        <img className="entrar-logo" src="./favicon.svg" alt="AulaPro" width={120} height={120} />
        <h1 className="entrar-titulo">{t('Condiciones de AulaPro')}</h1>
        <p className="entrar-sub">{t('Para seguir usando AulaPro, lee y acepta las condiciones de venta y de uso y la política de privacidad. Tu trabajo no cambia.')}</p>
        <CasillaCondiciones marcada={marcada} onCambio={setMarcada} />
        <button type="button" className="btn-primary entrar-seguir" disabled={!marcada} onClick={() => { aceptarCondiciones(); onAceptar(); }}>
          {t('Continuar')}
        </button>
      </div>
    </div>
  );
}
