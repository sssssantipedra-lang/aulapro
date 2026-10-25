import type { Class } from '../../types';
import { gruposDeEvaluaciones, usadoEn, type ShareScope, type SyncSource } from '../../services/paquete';
import { useI18n } from '../../i18n';

/**
 * Elegir con detalle qué va en el archivo que se comparte (25-10-2026, petición
 * del dueño: «poder elegir qué exactamente se quiere enviar»).
 *
 * Todo viene marcado y se quita lo que no se quiera mandar: así lo que el
 * docente crea después entra solo, y el archivo nunca lleva menos de lo que
 * parece. Lo que se quita se guarda en `ShareScope` (`sinAlumnos`,
 * `sinColumnas`, `sinInstrumentos`, `sinEvaluacionesDe`) y lo aplica `buildBundle`.
 */

type Clave = 'sinAlumnos' | 'sinColumnas' | 'sinInstrumentos' | 'sinEvaluacionesDe';

export interface Elemento { id: string; etiqueta: string; sub?: string }

interface ListaProps {
  titulo: string;
  elementos: Elemento[];
  fuera: string[];
  onFuera: (siguiente: string[]) => void;
}

/** Una lista de casillas con «Todos» y «Ninguno». Marcado = va en el archivo. */
export function Lista({ titulo, elementos, fuera, onFuera }: ListaProps) {
  const { t } = useI18n();
  if (elementos.length === 0) return null;
  const idsLista = new Set(elementos.map(e => e.id));
  const sinLista = fuera.filter(id => !idsLista.has(id));      // lo quitado en otras listas se respeta
  const quitados = new Set(fuera.filter(id => idsLista.has(id)));
  const van = elementos.length - quitados.size;

  const poner = (id: string, va: boolean) =>
    onFuera(va ? fuera.filter(x => x !== id) : [...fuera, id]);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1, minWidth: 0 }}>{titulo}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{t('{n} de {total}', { n: van, total: elementos.length })}</span>
        <button type="button" className="btn-ghost" style={{ fontSize: 11.5, padding: '2px 8px' }}
          onClick={() => onFuera(sinLista)} disabled={quitados.size === 0}>{t('Todos')}</button>
        <button type="button" className="btn-ghost" style={{ fontSize: 11.5, padding: '2px 8px' }}
          onClick={() => onFuera([...sinLista, ...elementos.map(e => e.id)])} disabled={van === 0}>{t('Ninguno')}</button>
      </div>
      <div style={{ maxHeight: 168, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
        {elementos.map(e => (
          <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-2)' }}>
            <input
              type="checkbox" checked={!quitados.has(e.id)}
              onChange={ev => poner(e.id, ev.target.checked)}
              style={{ accentColor: 'var(--accent-d)', width: 15, height: 15, flexShrink: 0, cursor: 'pointer' }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.etiqueta}</span>
            {e.sub && <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{e.sub}</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

interface Props {
  source: SyncSource;
  scope: ShareScope;
  onChange: (scope: ShareScope) => void;
}

export function DetalleEnvio({ source, scope, onChange }: Props) {
  const { t } = useI18n();
  const clases: Class[] = source.classes.filter(c => scope.classIds.includes(c.id));
  if (clases.length === 0) return null;
  const ids = new Set(scope.classIds);

  const poner = (clave: Clave) => (siguiente: string[]) => onChange({ ...scope, [clave]: siguiente });

  const instrumentos: Elemento[] = [
    ...source.rubrics.filter(r => usadoEn(r, ids)).map(r => ({ id: r.id, etiqueta: r.name, sub: t('Rúbrica') })),
    ...source.dianas.filter(d => usadoEn(d, ids)).map(d => ({ id: d.id, etiqueta: d.name, sub: d.tipo === 'registro' ? t('Escala de registro') : t('Diana de evaluación') })),
  ];
  const evaluaciones: Elemento[] = gruposDeEvaluaciones(source.evaluations, scope.classIds)
    .map(g => ({ id: g.id, etiqueta: t(g.nombre), sub: String(g.n) }));

  // Solo cuenta lo que se puede ver ahora: lo quitado de una clase que ya no se envía no importa
  const visibles = new Set<string>([
    ...source.students.filter(x => ids.has(x.class_id)).map(x => x.id),
    ...source.gradeItems.filter(x => ids.has(x.class_id)).map(x => x.id),
    ...instrumentos.map(x => x.id),
    ...evaluaciones.map(x => x.id),
  ]);
  const quitadas = [
    ...(scope.sinAlumnos ?? []), ...(scope.sinColumnas ?? []),
    ...(scope.sinInstrumentos ?? []), ...(scope.sinEvaluacionesDe ?? []),
  ].filter(id => visibles.has(id)).length;

  return (
    <details style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 12, padding: '10px 14px' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
        {t('Elegir con detalle')}
        {quitadas > 0 && (
          <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--accent-d)' }}>
            {t('{n} sin enviar', { n: quitadas })}
          </span>
        )}
      </summary>
      <p style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, margin: '8px 0 0' }}>
        {t('Quita lo que no quieras mandar: lo que dejes sin marcar no va en el archivo. Si quitas a un alumno, también se quitan sus notas y sus evaluaciones.')}
      </p>

      {clases.map(c => {
        const alumnos = source.students.filter(s => s.class_id === c.id).map(s => ({ id: s.id, etiqueta: s.name }));
        const categorias = new Map(source.gradeCategories.filter(k => k.class_id === c.id).map(k => [k.id, k.name]));
        const columnas = source.gradeItems.filter(i => i.class_id === c.id)
          .map(i => ({ id: i.id, etiqueta: i.name, sub: categorias.get(i.category_id) }));
        return (
          <div key={c.id} style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: c.color || 'var(--text)' }}>{c.name}</div>
            <Lista titulo={t('Alumnado')} elementos={alumnos} fuera={scope.sinAlumnos ?? []} onFuera={poner('sinAlumnos')} />
            {scope.grades && (
              <Lista titulo={t('Columnas del cuaderno')} elementos={columnas} fuera={scope.sinColumnas ?? []} onFuera={poner('sinColumnas')} />
            )}
          </div>
        );
      })}

      {(scope.rubrics && instrumentos.length > 0) || (scope.evaluations && evaluaciones.length > 0) ? (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
          {scope.rubrics && (
            <Lista titulo={t('Rúbricas, dianas y escalas')} elementos={instrumentos} fuera={scope.sinInstrumentos ?? []} onFuera={poner('sinInstrumentos')} />
          )}
          {scope.evaluations && (
            <Lista titulo={t('Evaluaciones, por instrumento')} elementos={evaluaciones} fuera={scope.sinEvaluacionesDe ?? []} onFuera={poner('sinEvaluacionesDe')} />
          )}
        </div>
      ) : null}
    </details>
  );
}
