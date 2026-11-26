/**
 * La galería de los juegos para la clase (26-11-2026): filtro por área y una tarjeta grande por juego, con su
 * portada, su área y sus tramos. Las áreas y los juegos que aún no existen salen como «Próximamente», sin poderse
 * abrir. Está dentro de Recursos («Juegos para la clase») y en una ventana desde el botón del mando de la pizarra
 * (`VentanaJuegos`). El catálogo es `lib/juegos/catalogo.ts`.
 */
import { useState, type CSSProperties } from 'react';
import { BookOpen, Calculator, FlaskConical, Gamepad2, Languages, MessageCircle, MonitorPlay, Sparkles, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { AREAS, tarjetasDeGaleria, type AreaJuego, type Juego } from '../../lib/juegos/catalogo';
import { TRAMOS } from '../../lib/juegos/tramos';
import { useHueco } from './usoJuego';

const ICONO: Record<AreaJuego, typeof Calculator> = {
  matematicas: Calculator, castellano: BookOpen, valenciano: MessageCircle, ingles: Languages, ciencias: FlaskConical,
};
/** Los tramos, cortos, para las fichas de cada tarjeta. */
const CORTO: Record<string, string> = { p12: '1-2', p34: '3-4', p56: '5-6', e12: '1-2', e34: '3-4' };

const CLAVE_FILTRO = 'aulapro_juegos_area';
function leerFiltro(): AreaJuego | 'todas' {
  try {
    const v = localStorage.getItem(CLAVE_FILTRO);
    return AREAS.some(a => a.id === v) ? v as AreaJuego : 'todas';
  } catch { return 'todas'; }
}

/** La portada de cada juego en su tarjeta: el dibujo del dueño (`portada.webp`) o uno de código. */
function PortadaJuego({ juego }: { juego: Juego }) {
  const propia = useHueco(`juegos/${juego.id}/portada.webp`);
  if (propia) return <img className="jg-portada-img" src={propia} alt="" draggable={false} />;
  if (juego.id === 'cuerda') return <img className="jg-portada-img cuerda" src="juegos/cuerda/neutral.webp" alt="" draggable={false} />;
  if (juego.id === 'recta') {
    return (
      <span className="jg-recta" aria-hidden="true">
        <img className="jg-recta-sol" src="ilustraciones/nat-sol.webp" alt="" draggable={false} />
        <span className="jg-recta-linea">{[0, 1, 2, 3, 4, 5].map(k => <span key={k}><b>{k}</b></span>)}</span>
        <img className="jg-recta-m m0" src="ilustraciones/ani-zorro.webp" alt="" draggable={false} />
        <img className="jg-recta-m m1" src="ilustraciones/ani-pinguino.webp" alt="" draggable={false} />
        <img className="jg-recta-e" src="ilustraciones/esp-estrella.webp" alt="" draggable={false} />
      </span>
    );
  }
  return <Gamepad2 size={56} aria-hidden="true" />;
}

export function GaleriaJuegos({ onJugar }: { onJugar: (juego: Juego) => void }) {
  const { t } = useI18n();
  const [filtro, setFiltro] = useState<AreaJuego | 'todas'>(leerFiltro);
  const elegir = (f: AreaJuego | 'todas') => {
    setFiltro(f);
    try { localStorage.setItem(CLAVE_FILTRO, f); } catch { /* sin almacenamiento */ }
  };
  const tarjetas = tarjetasDeGaleria(filtro);
  const area = (id: AreaJuego) => AREAS.find(a => a.id === id)!;

  return (
    <div className="jg-galeria">
      <div className="jg-filtro" role="radiogroup" aria-label={t('Área')}>
        <button type="button" role="radio" aria-checked={filtro === 'todas'} className={`jg-chip${filtro === 'todas' ? ' sel' : ''}`} onClick={() => elegir('todas')}>
          <Sparkles size={15} aria-hidden="true" />{t('Todas')}
        </button>
        {AREAS.map(a => {
          const Ico = ICONO[a.id];
          return (
            <button
              key={a.id} type="button" role="radio" aria-checked={filtro === a.id} className={`jg-chip${filtro === a.id ? ' sel' : ''}`}
              style={{ '--jg-c': a.color } as CSSProperties} onClick={() => elegir(a.id)}
            >
              <Ico size={15} aria-hidden="true" />{t(a.nombre)}
            </button>
          );
        })}
      </div>
      <div className="jg-tarjetas">
        {tarjetas.map(tj => {
          if (tj.tipo === 'pronto') {
            const a = area(tj.area);
            const Ico = ICONO[a.id];
            return (
              <div key={a.id} className="jg-card pronto" style={{ '--jg-c': a.color } as CSSProperties} aria-disabled="true">
                <span className="jg-portada"><Ico size={40} aria-hidden="true" /></span>
                <span className="jg-cuerpo">
                  <span className="jg-area">{t(a.nombre)}</span>
                  <span className="jg-ttl">{t('Próximamente')}</span>
                  <span className="jg-txt">{tj.faltan === 1 ? t('Un juego nuevo de esta área, para todos los cursos.') : t('{n} juegos nuevos de esta área, para todos los cursos.', { n: tj.faltan })}</span>
                </span>
              </div>
            );
          }
          const j = tj.juego;
          const a = area(j.area);
          return (
            <button key={j.id} type="button" className="jg-card" style={{ '--jg-c': j.color } as CSSProperties} onClick={() => onJugar(j)}>
              <span className="jg-portada"><PortadaJuego juego={j} /></span>
              <span className="jg-cuerpo">
                <span className="jg-area">{t(a.nombre)}</span>
                <span className="jg-ttl">{t(j.nombre)}</span>
                <span className="jg-txt">{t(j.descripcion)}</span>
                <span className="jg-tramos" aria-label={t('Para: {tramos}', { tramos: j.tramos.map(x => t(TRAMOS.find(y => y.id === x)!.nombre)).join(', ') })}>
                  {TRAMOS.map(x => (
                    <span key={x.id} className={`jg-tramo ${x.etapa}${j.tramos.includes(x.id) ? '' : ' no'}`} aria-hidden="true">
                      <b>{x.etapa === 'eso' ? t('ESO@@corto') : t('Prim.')}</b>{CORTO[x.id]}
                    </span>
                  ))}
                </span>
                <span className="jg-ft"><span className="jg-go"><MonitorPlay size={16} aria-hidden="true" />{t('Jugar')}</span></span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** La galería en una ventana (desde la pizarra). Escape, la X, tocar fuera o el botón de atrás la cierran. */
export function VentanaJuegos({ onJugar, onCerrar }: { onJugar: (juego: Juego) => void; onCerrar: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="jg-ventana-fondo" onClick={e => { if (e.target === e.currentTarget) onCerrar(); }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}
    >
      <div className="jg-ventana" role="dialog" aria-modal="true" aria-label={t('Juegos para la clase')}>
        <div className="jg-ventana-hd">
          <span className="jg-ventana-ttl"><Gamepad2 size={20} aria-hidden="true" />{t('Juegos para la clase')}</span>
          <button type="button" className="jg-cerrar" aria-label={t('Cerrar')} title={t('Cerrar')} autoFocus onClick={onCerrar}><X size={20} /></button>
        </div>
        <GaleriaJuegos onJugar={onJugar} />
      </div>
    </div>
  );
}
