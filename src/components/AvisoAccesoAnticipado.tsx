import { useState } from 'react';
import { useI18n } from '../i18n';
import { marcarAvisoBetaVisto } from '../lib/avisoBeta';

/**
 * Lo que tiene que saber quien entra en el acceso anticipado gratuito, con una casilla que hay que marcar para seguir
 * (`lib/avisoBeta.ts`). Dice tres cosas: que es gratis durante un periodo, que después pasa a ser de pago y que su trabajo es suyo
 * y se lo puede llevar. No promete una fecha: todavía no está fijada.
 */
export function AvisoAccesoAnticipado({ onContinuar }: { onContinuar: () => void }) {
  const { t } = useI18n();
  const [entendido, setEntendido] = useState(false);
  return (
    <div className="lic-shell entrar">
      <div className="entrar-caja">
        <img className="entrar-logo" src="./favicon.svg" alt="AulaPro" width={120} height={120} />
        <h1 className="entrar-titulo">{t('Estás en el acceso anticipado gratuito')}</h1>
        <p className="entrar-sub">{t('Antes de empezar, lee esto. Son tres cosas.')}</p>
        <ol className="aviso-beta-lista" style={{ textAlign: 'left', margin: '14px 0 6px', paddingLeft: 22, display: 'grid', gap: 10, fontSize: 14.5, lineHeight: 1.5 }}>
          <li><strong>{t('Es gratis durante el lanzamiento.')}</strong> {t('AulaPro está abierta a todos los docentes, sin tarjeta y sin pagar. El acceso gratuito dura hasta el 1 de enero de 2027.')}</li>
          <li><strong>{t('Después pasará a ser de pago.')}</strong> {t('Cuando se cierre, AulaPro será una suscripción anual (con la oferta de lanzamiento, 9,90 € el primer año si te suscribes hasta el 15 de abril de 2027; después, 14,99 € al año) y la aplicación se bloqueará hasta que te suscribas. Nada se cobra solo. Te lo diremos en la web y en la propia aplicación.')}</li>
          <li><strong>{t('Tu trabajo es tuyo.')}</strong> {t('Se guarda en tu dispositivo (y en tu Drive u OneDrive, si lo elegiste). Puedes descargar una copia cuando quieras, con o sin suscripción, en Configuración › Datos y copias › Llevar a otro equipo › «Descargar mis datos».')}</li>
        </ol>
        <label className="entrar-acepto">
          <input type="checkbox" checked={entendido} onChange={e => setEntendido(e.target.checked)} />
          <span>{t('He entendido que el acceso gratuito es temporal y que después tendré que suscribirme para seguir usando AulaPro.')}</span>
        </label>
        <button type="button" className="btn-primary entrar-seguir" disabled={!entendido} onClick={() => { marcarAvisoBetaVisto(); onContinuar(); }}>
          {t('Entrar en AulaPro')}
        </button>
      </div>
    </div>
  );
}
