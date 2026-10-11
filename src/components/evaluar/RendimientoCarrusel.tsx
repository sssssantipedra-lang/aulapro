/**
 * «Cómo va cada clase»: la nota media de cada rúbrica en una clase, en barras
 * sobre 10, y una clase tras otra como un carrusel (decisión del dueño,
 * 11-10-2026).
 *
 * Pasa sola cada pocos segundos, salvo con el ratón o el foco encima (para
 * poder leerla) o con «reducir movimiento» en el sistema. Las flechas y los
 * puntos la cambian a mano. Una sola serie por clase: las barras van del
 * color de la clase, que es el que ya lleva en toda la aplicación, y los
 * números en el color del texto.
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RendimientoClase } from '../../lib/rendimiento';
import { useI18n } from '../../i18n';

const CADA_MS = 6000;

function reducirMovimiento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function RendimientoCarrusel({ clases }: { clases: RendimientoClase[] }) {
  const { t, locale } = useI18n();
  const [i, setI] = useState(0);
  const [quieto, setQuieto] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);
  const n = clases.length;
  const actual = clases[Math.min(i, n - 1)];

  useEffect(() => {
    if (n < 2 || quieto || reducirMovimiento()) return;
    const id = window.setInterval(() => setI(v => (v + 1) % n), CADA_MS);
    return () => window.clearInterval(id);
  }, [n, quieto]);

  if (!actual) return null;
  const fmt = (v: number) => v.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ir = (d: number) => setI(v => (v + d + n) % n);

  return (
    <div
      className="rend"
      aria-roledescription={t('carrusel')}
      onMouseEnter={() => setQuieto(true)}
      onMouseLeave={() => { setQuieto(false); setSobre(null); }}
      onFocus={() => setQuieto(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setQuieto(false); }}
    >
      <div className="rend-hd">
        <span className="rend-dot" style={{ background: actual.color }} aria-hidden="true" />
        <h3 className="rend-clase">{actual.nombre}</h3>
        <span className="rend-sub">{t('Nota media por rúbrica, sobre 10')}</span>
        {n > 1 && (
          <span className="rend-nav">
            <button type="button" className="ico-btn" onClick={() => ir(-1)} aria-label={t('Clase anterior')}><ChevronLeft size={16} /></button>
            <button type="button" className="ico-btn" onClick={() => ir(1)} aria-label={t('Clase siguiente')}><ChevronRight size={16} /></button>
          </span>
        )}
      </div>

      {/* key: al cambiar de clase, las barras crecen otra vez desde cero */}
      <div key={actual.classId} className="rend-plot" aria-hidden="true">
        {/* La raya del aprobado */}
        <div className="rend-cinco"><span>5</span></div>
        {actual.rubricas.map(r => (
          <div
            key={r.id}
            className={`rend-row${sobre === r.id ? ' on' : ''}`}
            onMouseEnter={() => setSobre(r.id)}
            onMouseLeave={() => setSobre(null)}
          >
            <span className="rend-name" title={r.nombre}>{r.nombre}</span>
            <span className="rend-track">
              <span className="rend-bar" style={{ width: `${Math.max(0, Math.min(10, r.media)) * 10}%`, background: actual.color }} />
              {sobre === r.id && (
                <span className="rend-tip" style={{ left: `${Math.max(0, Math.min(10, r.media)) * 10}%` }}>
                  <strong>{r.nombre}</strong>
                  {t('Media {nota} · {n} alumnos', { nota: fmt(r.media), n: r.alumnos })}
                </span>
              )}
            </span>
            <span className="rend-val">{fmt(r.media)}</span>
          </div>
        ))}
      </div>

      {/* Lo mismo para lectores de pantalla, en tabla */}
      <table className="sr-only">
        <caption>{actual.nombre}</caption>
        <thead><tr><th>{t('Rúbrica')}</th><th>{t('Media')}</th><th>{t('Alumnos')}</th></tr></thead>
        <tbody>
          {actual.rubricas.map(r => <tr key={r.id}><td>{r.nombre}</td><td>{fmt(r.media)}</td><td>{r.alumnos}</td></tr>)}
        </tbody>
      </table>

      {n > 1 && (
        <div className="rend-dots" role="group" aria-label={t('Elegir clase')}>
          {clases.map((c, k) => (
            <button
              key={c.classId}
              type="button"
              className={`rend-pip${k === i ? ' on' : ''}`}
              style={k === i ? { background: c.color } : undefined}
              aria-label={c.nombre}
              aria-current={k === i ? 'true' : undefined}
              onClick={() => setI(k)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
