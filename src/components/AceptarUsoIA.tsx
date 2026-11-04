import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { Modal } from './ui/Modal';

/**
 * Lo que AulaPro envía a la IA y lo que no, y la responsabilidad de quien la usa (`lib/usoIA.ts`). Es el texto de la
 * política de privacidad en pocas líneas: si cambia lo que va a la IA, cambian estas líneas, la privacidad de la web
 * y `VERSION_USO_IA`.
 */
export function PuntosUsoIA() {
  const { t } = useI18n();
  return (
    <ul className="ak-puntos">
      <li>{t('Los nombres de tu alumnado no salen de este dispositivo: antes de enviar nada a Google se cambian por códigos, distintos en cada petición, y al recibir la respuesta se vuelven a poner.')}</li>
      <li>{t('AulaPro no guarda ni pide diagnósticos. Describe las barreras de aprendizaje, no el diagnóstico: si escribes un dato de salud en un texto, AulaPro lo quita antes de enviarlo, pero no puede reconocer todos los casos.')}</li>
      <li>{t('Un nombre que no esté en tus listas (un apodo, un familiar) no se puede tapar solo: evita escribirlo. De un documento solo se envía su texto, sin correos, teléfonos ni DNI.')}</li>
      <li>{t('Lo que envías va a Google con tu propia clave. Desde el Espacio Económico Europeo, según las condiciones de la API de Gemini, Google aplica también a la clave gratuita las reglas de la de pago: no usa lo que envías para entrenar sus modelos ni para mejorar sus productos. Esas condiciones son de Google y pueden cambiar.')}</li>
      <li>{t('La IA propone borradores y puede equivocarse: revisa siempre lo que genera. AulaPro no la usa para poner notas.')}</li>
      <li>{t('Tú decides qué escribes y qué envías. Quien responde de los datos del alumnado es tu centro o, si los usas por tu cuenta, tú.')}</li>
    </ul>
  );
}

/** Panel informativo, para leerlo cuando se quiera (también después de aceptar). */
export function PanelUsoIA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} wide title={t('Cómo trata AulaPro lo que envías a la IA')}>
      <PuntosUsoIA />
      <p className="ak-mas">
        {t('Más detalle en la')}{' '}
        <a href="../privacidad.html" target="_blank" rel="noopener noreferrer">{t('política de privacidad')}</a>.
      </p>
      <div className="ap-acciones"><button type="button" className="btn-accent" onClick={onClose}>{t('Cerrar')}</button></div>
    </Modal>
  );
}

/**
 * El recuadro que sale la primera vez que se va a conseguir o a poner la clave: una casilla («Acepto el uso y las
 * responsabilidades…») y un enlace que abre el panel con toda la información. Sin marcarla no se sigue.
 */
export function AceptarUsoIA({ open, onClose, onAceptar }: { open: boolean; onClose: () => void; onAceptar: () => void }) {
  const { t } = useI18n();
  const [marcada, setMarcada] = useState(false);
  const [info, setInfo] = useState(false);
  return (
    <>
      <Modal open={open && !info} onClose={onClose} title={<span className="ak-tit"><ShieldCheck size={18} color="var(--accent-d)" aria-hidden="true" />{t('Antes de usar la IA')}</span>}>
        <p className="ak-intro" style={{ marginBottom: 12 }}>
          {t('La IA de AulaPro funciona con tu propia clave de Google. Antes de conseguirla, confirma que has entendido qué se envía y qué no.')}
        </p>
        <label className="ak-casilla">
          <input type="checkbox" checked={marcada} onChange={e => setMarcada(e.target.checked)} />
          <span>
            {t('Acepto el uso de la IA en AulaPro y las responsabilidades que conlleva.')}{' '}
            <button type="button" className="ak-link" style={{ margin: 0 }} onClick={e => { e.preventDefault(); setInfo(true); }}>
              {t('Leer la información')}
            </button>
          </span>
        </label>
        <div className="ap-acciones">
          <button type="button" className="btn-accent" disabled={!marcada} onClick={() => { onAceptar(); setMarcada(false); }}>{t('Continuar')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Ahora no')}</button>
        </div>
      </Modal>
      <PanelUsoIA open={open && info} onClose={() => setInfo(false)} />
    </>
  );
}
