import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AI_STUDIO_USO_URL, cupoAgotadoHasta, horaCorta, MODELOS_CON_CUPO, nombreModelo } from '../services/gemini';
import { useI18n } from '../i18n';

/**
 * El cupo de hoy de cada modelo (16-11-2026, petición del dueño: «¿es posible calcular cuánto uso le queda?»).
 * Exacto no: Google no dice cuántas peticiones quedan, solo avisa cuando se acaban (`cupoAgotadoHasta`). Así que
 * se enseña lo que es cierto (agotado hasta la hora en que se renueva) y se lleva a AI Studio para la cifra exacta.
 */
export function CupoModelos() {
  const { t } = useI18n();
  // Cada minuto, para que «agotado hasta las 9:00» se quite solo a su hora
  const [, setMinuto] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setMinuto(n => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="ak-cupo">
      <strong>{t('Cupo de hoy de cada modelo')}</strong>
      <ul>
        {MODELOS_CON_CUPO.map(m => {
          const hasta = cupoAgotadoHasta(m);
          return (
            <li key={m} className={hasta ? 'agotado' : 'libre'}>
              <span>{nombreModelo(m)}</span>
              <span>{hasta ? t('Agotado hasta las {h}', { h: horaCorta(hasta) }) : t('Disponible')}</span>
            </li>
          );
        })}
      </ul>
      <span>{t('Google no dice cuántas peticiones quedan: solo avisa cuando se acaban. Por eso aquí se ve si un modelo ya ha gastado el cupo de hoy, no cuánto le queda. Lo que se gaste con la misma clave en otro dispositivo no se ve aquí.')}</span>
      <a href={AI_STUDIO_USO_URL} target="_blank" rel="noreferrer" className="ak-link">
        {t('Ver mi uso exacto en Google AI Studio')} <ExternalLink size={12} />
      </a>
    </div>
  );
}
