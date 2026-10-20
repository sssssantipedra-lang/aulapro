import { useState } from 'react';
import { Sparkles, KeyRound } from 'lucide-react';
import { useI18n } from '../i18n';
import { LangSwitch } from './Welcome';
import { currentCourse } from '../lib/utils';
import { DEMO_COMMUNITY, DEMO_USER } from '../lib/demoData';
import { DEMO_APOYO_USER } from '../lib/demoApoyo';
import { DEMO_EF_USER } from '../lib/demoEF';
import { especialidadTexto } from '../lib/apoyo';
import { useModoPrueba } from '../lib/modoPrueba';
import type { NewProfileInput } from '../services/storage';

interface Props {
  /** Crea y abre el perfil de ejemplo (borra antes el de la prueba anterior). */
  onStart: (input: NewProfileInput) => Promise<void>;
}

/**
 * Bienvenida del modo de prueba: en lugar de la lista de perfiles, tres
 * ejemplos para curiosear sin licencia. Sin crear perfiles reales.
 */
export function PruebaInicio({ onStart }: Props) {
  const { t } = useI18n();
  const prueba = useModoPrueba();
  const [busy, setBusy] = useState(false);

  async function start(input: NewProfileInput) {
    setBusy(true);
    await onStart(input);
    setBusy(false);
  }

  const course = currentCourse();
  const opciones: { titulo: string; texto: string; input: NewProfileInput }[] = [
    {
      titulo: t('Docente de aula'),
      texto: t('Clases de Primaria y ESO con alumnado, notas y evaluaciones.'),
      input: { name: t(DEMO_USER.full_name), school: t(DEMO_USER.school), subject: t(DEMO_USER.subject), course, community: DEMO_COMMUNITY },
    },
    {
      titulo: t('Educación Física'),
      texto: t('Sesiones, circuitos y pruebas físicas.'),
      input: { name: t(DEMO_EF_USER.full_name), school: t(DEMO_EF_USER.school), course, community: DEMO_COMMUNITY, subject: t('Educación Física'), tipoDocente: 'ef' },
    },
    {
      titulo: t('PT y AL'),
      texto: t('Apoyo a alumnado con necesidades específicas.'),
      input: { name: t(DEMO_APOYO_USER.full_name), school: t(DEMO_APOYO_USER.school), course, community: DEMO_COMMUNITY, especialidades: ['PT', 'AL'], subject: t(especialidadTexto(['PT', 'AL'])) },
    },
  ];

  return (
    <div className="lic-shell">
      <LangSwitch />
      <div className="auth-card prueba-card">
        <div className="lic-hd">
          <div className="lic-logo"><Sparkles size={22} color="#fff" /></div>
          <div>
            <div className="lic-title">{t('Prueba Aula Pro')}</div>
            <div className="lic-sub">{t('Con datos de ejemplo, sin licencia')}</div>
          </div>
        </div>
        <p className="lic-text">
          {t('Elige un ejemplo para ver cómo funciona. Son datos inventados: lo que cambies aquí no se guarda para después.')}
        </p>
        <div className="prueba-opts">
          {opciones.map(o => (
            <button key={o.titulo} type="button" className="prueba-opt" disabled={busy} onClick={() => start(o.input)}>
              <strong>{o.titulo}</strong>
              <span>{o.texto}</span>
            </button>
          ))}
        </div>
        <button type="button" className="lic-buy prueba-activar" onClick={() => prueba?.activar()}>
          <KeyRound size={14} />{t('Ya tengo una clave de licencia')}
        </button>
      </div>
    </div>
  );
}
