/**
 * Importar notas desde un archivo (24-11-2026, petición del dueño): un Excel (.xlsx, .xls, .ods) o un CSV con el
 * alumnado y sus notas. Primero se elige la hoja y a qué actividad va cada columna de notas (una que existe, una nueva
 * con el título de la columna o ninguna); después, la vista previa de siempre (`VistaPreviaPegado`), donde cada nota va
 * al alumno que se llama así y nada se escribe hasta aceptar. La lógica es de `lib/importarNotas.ts` y `lib/pegarNotas.ts`.
 * El archivo se lee en el navegador: no sale nada del dispositivo.
 */
import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useI18n } from '../../i18n';
import { entenderPegado, primeraFilaNumera, type CambioDeNota, type DondePegar } from '../../lib/pegarNotas';
import { columnasDeNotas, destinosPropuestos, pegadoDeColumnas, type Destino, type HojaDeNotas } from '../../lib/importarNotas';
import { VistaPreviaPegado } from './VistaPreviaPegado';

/** Una actividad nueva que se crea al aplicar: el id provisional de la vista previa, su nombre y su categoría. */
export interface ActividadNueva { idProvisional: string; nombre: string; categoria: string }

interface Props {
  archivo: string;
  hojas: HojaDeNotas[];
  /** Las actividades donde se puede escribir (las de la evaluación que se ve), con su categoría. */
  actividades: { id: string; name: string; categoria: string }[];
  categorias: { id: string; name: string }[];
  alumnado: DondePegar['alumnado'];
  notas: DondePegar['notas'];
  /** Crea las actividades nuevas y pone las notas (con los ids provisionales ya cambiados por los de verdad). */
  onAplicar: (nuevas: ActividadNueva[], cambios: CambioDeNota[]) => void;
  onClose: () => void;
}

const NUEVA = 'nueva';

export function ImportarNotas({ archivo, hojas, actividades, categorias, alumnado, notas, onAplicar, onClose }: Props) {
  const { t } = useI18n();
  const [hojaElegida, setHojaElegida] = useState(0);
  const [cabecera, setCabecera] = useState<boolean | undefined>(undefined);
  const hoja = hojas[Math.min(hojaElegida, hojas.length - 1)];
  const pegado = useMemo(() => entenderPegado(hoja.filas, { cabecera }), [hoja, cabecera]);
  const columnas = useMemo(() => columnasDeNotas(pegado), [pegado]);
  const propuestos = useMemo(() => destinosPropuestos(columnas, actividades), [columnas, actividades]);
  // Lo elegido vale para la hoja y la cabecera con que se eligió: al cambiarlas, se vuelve a proponer
  const clave = `${hojaElegida}|${String(cabecera)}`;
  const [elegidos, setElegidos] = useState<{ clave: string; d: Destino[] } | null>(null);
  const destinos = elegidos && elegidos.clave === clave ? elegidos.d : propuestos;
  const cambiarDestino = (k: number, v: Destino) => setElegidos({ clave, d: destinos.map((x, i) => (i === k ? v : x)) });
  const [categoriaNueva, setCategoriaNueva] = useState(categorias[0]?.id ?? '');
  const [viendo, setViendo] = useState(false);

  const elegidas = columnas.filter(c => destinos[c.k] !== null && destinos[c.k] !== undefined);
  const repetidas = new Set(elegidas.map(c => destinos[c.k]).filter((d, i, a) => d !== NUEVA && a.indexOf(d) !== i));
  const hayNuevas = elegidas.some(c => destinos[c.k] === NUEVA);
  const puedeSeguir = elegidas.length > 0 && repetidas.size === 0 && (!hayNuevas || !!categoriaNueva) && alumnado.length > 0;
  const nombreNueva = (k: number) => columnas[k]?.titulo || t('Columna {n}', { n: k + 1 });

  // Lo que se lleva a la vista previa: las columnas elegidas, cada una con su actividad (las nuevas, con id provisional)
  const ks = elegidas.map(c => c.k);
  const vista = {
    pegado: pegadoDeColumnas(pegado, ks),
    actividades: ks.map(k => (destinos[k] === NUEVA
      ? { id: `nueva:${k}`, name: `${nombreNueva(k)} (${t('nueva')})` }
      : { id: destinos[k] as string, name: actividades.find(a => a.id === destinos[k])?.name ?? '' })),
  };

  if (viendo && vista.actividades.length > 0 && alumnado.length > 0) {
    return (
      <VistaPreviaPegado
        filas={hoja.filas}
        pegadoFijo={vista.pegado}
        donde={{ alumnado, actividades: vista.actividades, alumnoId: alumnado[0].id, actividadId: vista.actividades[0].id, notas }}
        textoCancelar={t('Volver')}
        onClose={() => setViendo(false)}
        onAplicar={cambios => {
          const nuevas: ActividadNueva[] = elegidas.filter(c => destinos[c.k] === NUEVA)
            .map(c => ({ idProvisional: `nueva:${c.k}`, nombre: nombreNueva(c.k), categoria: categoriaNueva }));
          onAplicar(nuevas, cambios);
        }}
      />
    );
  }

  return (
    <Modal open onClose={onClose} wide stickyHeader title={<span className="mk-ttl"><FileSpreadsheet size={17} color="var(--accent-d)" />{t('Importar notas de un archivo')}</span>}>
      <div className="pn-previa">
        <p className="pn-como">
          {t('Elige a qué actividad va cada columna de notas de «{archivo}». Después verás, alumno por alumno, cómo quedan antes de poner nada: cada nota va al alumno que se llama así en tu hoja.', { archivo })}
        </p>

        {hojas.length > 1 && (
          <label className="pn-imp-campo">
            <span>{t('Hoja del archivo')}</span>
            <select value={hojaElegida} onChange={e => { setHojaElegida(Number(e.target.value)); setCabecera(undefined); }}>
              {hojas.map((h, i) => <option key={h.nombre + i} value={i}>{h.nombre}</option>)}
            </select>
          </label>
        )}

        {hoja.filas.length > 1 && (
          <label className="pn-cabecera">
            <input type="checkbox" checked={pegado.cabecera} onChange={e => setCabecera(e.target.checked)} />
            <span>
              {t('La primera fila es la cabecera de mi hoja: no es de ningún alumno')}
              {primeraFilaNumera(hoja.filas) && !pegado.cabecera && <small>{t('Si esa fila numera las actividades (1, 2, 3…), márcala: sus números serán los títulos de las columnas y no se pondrán como notas.')}</small>}
            </span>
          </label>
        )}

        <p className="sda-note pn-apartado">
          {pegado.etiquetas
            ? t('Tu hoja trae {n} filas con nombre: cada nota irá al alumno que se llama así.', { n: pegado.celdas.length })
            : t('Tu hoja no trae una columna con los nombres: las notas se colocarán en el orden de la lista, y tendrás que confirmarlo.')}
        </p>

        {columnas.length === 0 ? (
          <p className="pn-como">{t('Esta hoja no trae ninguna columna de notas.')}</p>
        ) : (
          <div className="pn-tabla-caja">
            <table className="pn-tabla pn-imp">
              <thead>
                <tr>
                  <th scope="col">{t('Columna de tu hoja')}</th>
                  <th scope="col">{t('Notas')}</th>
                  <th scope="col">{t('Va a')}</th>
                </tr>
              </thead>
              <tbody>
                {columnas.map(c => {
                  const d = destinos[c.k] ?? null;
                  const valor = d === null ? '' : d;
                  return (
                    <tr key={c.k} className={d !== null && d !== NUEVA && repetidas.has(d) ? 'pn-fila-mal' : undefined}>
                      <th scope="row">{c.titulo || <em>{t('Columna {n}', { n: c.k + 1 })}</em>}</th>
                      <td className="pn-etiqueta">
                        {c.notas > 0 ? t('{n} notas', { n: c.notas }) : t('ninguna nota')}
                        {c.muestra.length > 0 && <small> · {c.muestra.join(', ')}</small>}
                      </td>
                      <td>
                        <select
                          aria-label={t('A qué actividad va la columna «{nombre}»', { nombre: c.titulo || t('Columna {n}', { n: c.k + 1 }) })}
                          value={valor}
                          onChange={e => cambiarDestino(c.k, e.target.value === '' ? null : e.target.value)}
                        >
                          <option value="">{t('No importar')}</option>
                          <option value={NUEVA}>{t('Actividad nueva: «{nombre}»', { nombre: c.titulo || t('Columna {n}', { n: c.k + 1 }) })}</option>
                          {actividades.map(a => <option key={a.id} value={a.id}>{a.name} · {a.categoria}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {repetidas.size > 0 && <p className="pn-error" role="alert">{t('Dos columnas van a la misma actividad: elige otra para una de ellas.')}</p>}

        {hayNuevas && (
          <label className="pn-imp-campo">
            <span>{t('Las actividades nuevas van a la categoría')}</span>
            <select value={categoriaNueva} onChange={e => setCategoriaNueva(e.target.value)}>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}

        <p className="sda-note">{t('El archivo se lee en este dispositivo: no se envía a ningún sitio.')}</p>
        <div className="pn-pie">
          <button type="button" className="btn-accent" disabled={!puedeSeguir} onClick={() => setViendo(true)}>
            {t('Ver cómo quedan')}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
        </div>
      </div>
    </Modal>
  );
}
