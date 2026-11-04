import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { fechaUsoIa } from '../lib/usoIA';

/**
 * Lo que AulaPro envía a la IA y lo que no, para que el docente lo lea antes de poner su clave y se haga cargo de su
 * uso (`lib/usoIA.ts`). Es el texto de la política de privacidad en pocas líneas: si cambia lo que va a la IA, cambian
 * estas líneas, la privacidad de la web y `VERSION_USO_IA`.
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
    </ul>
  );
}

/** La casilla, con el texto. Sin marcarla, no se puede guardar la clave. Una vez aceptada, el texto queda plegado. */
export function AceptarUsoIA({ aceptado, marcada, onCambio }: { aceptado: boolean; marcada: boolean; onCambio: (v: boolean) => void }) {
  const { t } = useI18n();
  if (aceptado) {
    return (
      <details className="ak-uso ok">
        <summary><ShieldCheck size={15} color="var(--ok)" aria-hidden="true" />{t('Aceptaste el uso de la IA el {fecha}. Volver a leerlo', { fecha: fechaUsoIa() ?? '' })}</summary>
        <PuntosUsoIA />
      </details>
    );
  }
  return (
    <section className="ak-uso" aria-labelledby="ak-uso-t">
      <h3 id="ak-uso-t"><ShieldCheck size={16} color="var(--accent-d)" aria-hidden="true" />{t('Antes de poner tu clave: lo que AulaPro envía a la IA')}</h3>
      <PuntosUsoIA />
      <label className="ak-casilla">
        <input type="checkbox" checked={marcada} onChange={e => onCambio(e.target.checked)} />
        <span>
          {t('He leído esto, lo entiendo y me hago responsable del uso de la IA con los datos de mi alumnado. Más en la')}{' '}
          <a href="../privacidad.html" target="_blank" rel="noopener noreferrer">{t('política de privacidad')}</a>.
        </span>
      </label>
    </section>
  );
}
