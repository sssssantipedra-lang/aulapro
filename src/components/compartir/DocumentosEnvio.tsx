import type { SyncSource, ShareScope } from '../../services/paquete';
import { Lista, type Elemento } from './DetalleEnvio';
import { useI18n } from '../../i18n';

/**
 * Elegir qué situaciones de aprendizaje y qué fichas se mandan (25-10-2026).
 * A diferencia de lo que cuelga de una clase, aquí NO viene nada marcado: un
 * documento se manda porque el docente lo ha elegido (`ShareScope.sdaIds` y
 * `fichaIds`). Por dentro se reutiliza la lista de «lo que se quita» de
 * `DetalleEnvio`, al revés: lo que no está marcado es lo que queda fuera.
 */

interface Props {
  source: SyncSource;
  scope: ShareScope;
  onChange: (scope: ShareScope) => void;
}

export function DocumentosEnvio({ source, scope, onChange }: Props) {
  const { t } = useI18n();
  const sdas: Elemento[] = (source.learningSituations ?? []).map(x => ({ id: x.id, etiqueta: x.title, sub: x.class_name }));
  const fichas: Elemento[] = (source.fichas ?? []).map(x => ({ id: x.id, etiqueta: x.title, sub: x.class_name }));
  if (sdas.length === 0 && fichas.length === 0) return null;

  /** La lista trabaja con «lo que queda fuera»; aquí lo que va es lo marcado. */
  const dePropiedad = (elementos: Elemento[], van: string[] | undefined) => {
    const marcados = new Set(van ?? []);
    return elementos.filter(e => !marcados.has(e.id)).map(e => e.id);
  };
  const aMarcados = (elementos: Elemento[], fuera: string[]) => {
    const quitados = new Set(fuera);
    return elementos.filter(e => !quitados.has(e.id)).map(e => e.id);
  };

  return (
    <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 12, padding: '4px 14px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', paddingTop: 10 }}>{t('Documentos')}</div>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, margin: '4px 0 0' }}>
        {t('Marca los que quieras mandar. Van tal cual: si en el contexto de la clase has escrito datos del alumnado, quítalos antes.')}
      </p>
      <Lista
        titulo={t('Situaciones de aprendizaje')} elementos={sdas}
        fuera={dePropiedad(sdas, scope.sdaIds)}
        onFuera={f => onChange({ ...scope, sdaIds: aMarcados(sdas, f) })}
      />
      <Lista
        titulo={t('Fichas')} elementos={fichas}
        fuera={dePropiedad(fichas, scope.fichaIds)}
        onFuera={f => onChange({ ...scope, fichaIds: aMarcados(fichas, f) })}
      />
    </div>
  );
}
