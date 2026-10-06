/**
 * Educación Física, «Pruebas físicas» (decisión del dueño, 5-10-2026): se
 * anotan las marcas de cada toma y se ve la mejora de cada alumno respecto a
 * sí mismo. Si el docente quiere, un baremo (por curso y, si quiere, por sexo)
 * pasa la última marca a nota y la lleva al cuaderno. La app no trae ningún
 * baremo publicado hasta comprobar que su licencia lo permite (ver
 * `docs/EF.md`).
 */
import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Settings2, Ruler, ArrowUp, ArrowDown, Minus, BookOpen, Eye, EyeOff } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useI18n } from '../../i18n';
import { isoDate, fromIsoDate } from '../../lib/utils';
import {
  asignaturaEF, baremoPara, CATEGORIAS_PRUEBA, evolucionPrueba, leerTramos, nuevoIdEF, notaConBaremo, pruebasDe,
} from '../../lib/ef';
import type { Class, GradeCategory, GradeItem, Section, Student } from '../../types';
import type { BaremoEF, CategoriaPrueba, EfData, MarcaPrueba, PruebaFisica, SexoEF } from '../../types/ef';

interface Props {
  classes: Class[];
  students: Student[];
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
  gradeCategories: GradeCategory[];
  onAddGradeItem: (i: GradeItem) => void;
  onSetGrade: (itemId: string, studentId: string, value: number | null) => void;
  onNav: (s: Section) => void;
}

const leerNumero = (x: string) => {
  const n = Number(x.trim().replace(',', '.'));
  return x.trim() !== '' && Number.isFinite(n) ? n : null;
};

const CURSOS: { etapa: 'primaria' | 'eso'; curso: number }[] = [
  ...[1, 2, 3, 4, 5, 6].map(curso => ({ etapa: 'primaria' as const, curso })),
  ...[1, 2, 3, 4].map(curso => ({ etapa: 'eso' as const, curso })),
];

export function EfPruebas({ classes, students, ef, onChangeEf, gradeCategories, onAddGradeItem, onSetGrade, onNav }: Props) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const hoy = isoDate();
  const pruebas = pruebasDe(ef);
  const visibles = pruebas.filter(p => !p.oculta);
  const [claseId, setClaseId] = useState<string | null>(null);
  const clase = classes.find(c => c.id === claseId) ?? classes[0] ?? null;
  const [pruebaId, setPruebaId] = useState<string>(visibles[0]?.id ?? '');
  const prueba = visibles.find(p => p.id === pruebaId) ?? visibles[0];
  const [fecha, setFecha] = useState(hoy);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [gestionar, setGestionar] = useState(false);
  const [baremos, setBaremos] = useState(false);
  const [alCuaderno, setAlCuaderno] = useState(false);

  const alumnos = useMemo(
    () => (clase ? students.filter(s => s.class_id === clase.id).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [students, clase],
  );
  const fmt = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const dia = (f: string) => fromIsoDate(f).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const nombreCurso = (c: { etapa: string; curso: number }) => `${c.curso}º ${c.etapa === 'eso' ? 'ESO' : t('Primaria')}`;

  if (!clase || !prueba) {
    return (
      <section className="sec active ap-page">
        <div className="pg-hd"><div><h1 className="pg-title">{t('Pruebas físicas')}</h1></div></div>
        <div className="card">
          <p className="ap-vacio">{t('Para anotar pruebas físicas, crea primero tus clases con su alumnado.')}</p>
          <button className="btn-accent" style={{ marginTop: 12 }} onClick={() => onNav('classes')}>{t('Ir a Mis Clases')}</button>
        </div>
      </section>
    );
  }

  const cursoClase = clase.etapa && clase.curso ? { etapa: clase.etapa, curso: clase.curso } : undefined;
  const hayBaremo = !!cursoClase && ef.baremos.some(b => b.pruebaId === prueba.id && b.etapa === cursoClase.etapa && b.curso === cursoClase.curso);
  const notaDe = (alumnoId: string, valor: number) => {
    const b = baremoPara(ef, prueba.id, cursoClase, ef.sexos[alumnoId]);
    return b ? notaConBaremo(b, prueba, valor) : null;
  };

  function guardarToma() {
    const nuevas: MarcaPrueba[] = alumnos.flatMap(s => {
      const v = leerNumero(valores[s.id] ?? '');
      return v === null ? [] : [{ id: nuevoIdEF('mar'), pruebaId: prueba.id, alumnoId: s.id, fecha, valor: v }];
    });
    if (!nuevas.length) { toast(t('Escribe al menos una marca.')); return; }
    const ids = new Set(nuevas.map(m => m.alumnoId));
    // Una sola marca por alumno, prueba y día: la nueva sustituye a la anterior
    onChangeEf(d => ({
      ...d,
      marcas: [...d.marcas.filter(m => !(m.pruebaId === prueba.id && m.fecha === fecha && ids.has(m.alumnoId))), ...nuevas],
    }));
    setValores({});
    toast(t(nuevas.length === 1 ? '✅ {n} marca guardada' : '✅ {n} marcas guardadas', { n: nuevas.length }));
  }

  return (
    <section className="sec active ap-page">
      <div className="pg-hd">
        <div>
          <h1 className="pg-title">{t('Pruebas físicas')}</h1>
          <p className="pg-sub">{t('Las marcas de cada toma y cómo mejora cada alumno respecto a sí mismo. Con un baremo, la marca se puede pasar a nota.')}</p>
        </div>
        <div className="ap-prog-acc">
          <button className="btn-ghost" onClick={() => setBaremos(true)}><Ruler size={15} />{t('Baremos')}</button>
          <button className="btn-ghost" onClick={() => setGestionar(true)}><Settings2 size={15} />{t('Pruebas')}</button>
        </div>
      </div>

      <div className="chip-row ap-alumnos" role="tablist" aria-label={t('Clase')}>
        {classes.map(c => (
          <button key={c.id} type="button" role="tab" aria-selected={c.id === clase.id}
            className={`chip sm accent${c.id === clase.id ? ' on' : ''}`} onClick={() => { setClaseId(c.id); setValores({}); }}>{c.name}</button>
        ))}
      </div>
      <div className="ef-pruebas-sel">
        {CATEGORIAS_PRUEBA.filter(cat => visibles.some(p => p.categoria === cat.id)).map(cat => (
          <div key={cat.id} className="ef-pruebas-cat">
            <span className="ap-sub">{t(cat.label)}</span>
            <div className="chip-row">
              {visibles.filter(p => p.categoria === cat.id).map(p => (
                <button key={p.id} type="button" className={`chip sm accent${p.id === prueba.id ? ' on' : ''}`} aria-pressed={p.id === prueba.id}
                  onClick={() => { setPruebaId(p.id); setValores({}); }}>{t(p.nombre)}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="ap-prog-hd">
          <div style={{ minWidth: 0 }}>
            <div className="ap-prog-ttl">{t(prueba.nombre)} <span className="sda-chip">{t(prueba.unidad)}</span></div>
            <p className="ap-sub" style={{ marginTop: 4 }}>{t(prueba.descripcion)}</p>
          </div>
          <label className="ap-intensidad">
            {t('Toma del')}
            <input type="date" className="finput" value={fecha} onChange={e => setFecha(e.target.value)} />
          </label>
        </div>

        <div className="ef-tabla-wrap">
          <table className="ef-tabla">
            <thead>
              <tr>
                <th>{t('Alumno o alumna')}</th>
                <th>{t('Primera')}</th>
                <th>{t('Última')}</th>
                <th>{t('Mejora')}</th>
                {hayBaremo && <th>{t('Nota')}</th>}
                <th>{t('Nueva marca')}</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.map(s => {
                const ev = evolucionPrueba(ef, prueba, s.id);
                const nota = ev.ultima ? notaDe(s.id, ev.ultima.valor) : null;
                return (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    <td>{ev.primera ? <>{fmt(ev.primera.valor)} <span className="ap-sub">{dia(ev.primera.fecha)}</span></> : '—'}</td>
                    <td>{ev.ultima && ev.tomas > 1 ? <>{fmt(ev.ultima.valor)} <span className="ap-sub">{dia(ev.ultima.fecha)}</span></> : '—'}</td>
                    <td>
                      {ev.mejora === null ? '—' : (
                        <span className={`ef-mejora ${ev.mejora > 0 ? 'sube' : ev.mejora < 0 ? 'baja' : 'igual'}`}
                          aria-label={ev.mejora > 0 ? t('Ha mejorado un {n} %', { n: fmt(ev.mejora) }) : ev.mejora < 0 ? t('Ha empeorado un {n} %', { n: fmt(-ev.mejora) }) : t('Igual')}>
                          {ev.mejora > 0 ? <ArrowUp size={13} /> : ev.mejora < 0 ? <ArrowDown size={13} /> : <Minus size={13} />}
                          {fmt(Math.abs(ev.mejora))} %
                        </span>
                      )}
                    </td>
                    {hayBaremo && <td>{nota === null ? '—' : fmt(nota)}</td>}
                    <td>
                      <input className="finput ef-marca-in" inputMode="decimal" value={valores[s.id] ?? ''}
                        aria-label={t('Nueva marca de {nombre}', { nombre: s.name })}
                        onChange={e => setValores(v => ({ ...v, [s.id]: e.target.value }))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="ap-acciones">
          <button className="btn-accent" onClick={guardarToma}>{t('Guardar la toma')}</button>
          {hayBaremo && (
            <button className="btn-ghost" onClick={() => setAlCuaderno(true)}><BookOpen size={15} />{t('Pasar las notas al cuaderno')}</button>
          )}
          {!hayBaremo && (
            <span className="ap-sub">{t('Sin baremo para {curso}: solo se ven las marcas y la mejora.', { curso: cursoClase ? nombreCurso(cursoClase) : t('esta clase') })}</span>
          )}
        </div>
      </div>

      <GestionPruebas open={gestionar} onClose={() => setGestionar(false)} pruebas={pruebas} onChangeEf={onChangeEf} />
      <Baremos open={baremos} onClose={() => setBaremos(false)} prueba={prueba} ef={ef} onChangeEf={onChangeEf}
        cursoInicial={cursoClase} nombreCurso={nombreCurso} />
      <AlCuaderno
        open={alCuaderno} onClose={() => setAlCuaderno(false)} clase={clase} prueba={prueba}
        categorias={gradeCategories.filter(c => c.class_id === clase.id && (c.subject ?? clase.subjects[0]) === asignaturaEF(clase))}
        onConfirmar={categoriaId => {
          const itemId = nuevoIdEF('gi');
          onAddGradeItem({ id: itemId, class_id: clase.id, category_id: categoriaId, name: t(prueba.nombre), date: hoy });
          let n = 0;
          alumnos.forEach(s => {
            const ev = evolucionPrueba(ef, prueba, s.id);
            const nota = ev.ultima ? notaDe(s.id, ev.ultima.valor) : null;
            if (nota !== null) { onSetGrade(itemId, s.id, nota); n++; }
          });
          setAlCuaderno(false);
          toast(t('✅ {n} notas en el cuaderno', { n }));
        }}
        onNav={onNav}
      />
    </section>
  );
}

/* ── Las pruebas: ocultar las de partida, añadir las propias ── */

function GestionPruebas({ open, onClose, pruebas, onChangeEf }: {
  open: boolean; onClose: () => void; pruebas: PruebaFisica[]; onChangeEf: Props['onChangeEf'];
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [nueva, setNueva] = useState<PruebaFisica | null>(null);

  const ocultar = (p: PruebaFisica, oculta: boolean) => onChangeEf(d => {
    if (p.propia) return { ...d, pruebas: d.pruebas.map(x => (x.id === p.id ? { ...x, oculta } : x)) };
    const otras = d.pruebas.filter(x => x.id !== p.id);
    return { ...d, pruebas: oculta ? [...otras, { ...p, oculta: true }] : otras };
  });

  function guardar() {
    if (!nueva) return;
    if (!nueva.nombre.trim() || !nueva.unidad.trim()) { toast(t('Escribe el nombre de la prueba y su unidad.')); return; }
    const p = { ...nueva, nombre: nueva.nombre.trim(), unidad: nueva.unidad.trim() };
    onChangeEf(d => ({ ...d, pruebas: [...d.pruebas.filter(x => x.id !== p.id), p] }));
    setNueva(null);
  }

  return (
    <Modal open={open} onClose={onClose} wide title={t('Pruebas')}>
      {nueva ? (
        <div className="ap-form">
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="ef-p-nombre">{t('Nombre')}</label>
            <input id="ef-p-nombre" className="finput" value={nueva.nombre} placeholder={t('Ej: Abdominales en 30 segundos')} onChange={e => setNueva({ ...nueva, nombre: e.target.value })} />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="ef-p-cat">{t('Capacidad')}</label>
            <select id="ef-p-cat" className="finput" value={nueva.categoria} onChange={e => setNueva({ ...nueva, categoria: e.target.value as CategoriaPrueba })}>
              {CATEGORIAS_PRUEBA.map(c => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="ef-p-unidad">{t('Unidad')}</label>
            <input id="ef-p-unidad" className="finput" value={nueva.unidad} placeholder={t('Ej: repeticiones')} onChange={e => setNueva({ ...nueva, unidad: e.target.value })} />
          </div>
          <fieldset className="fgroup ap-fs" style={{ gridColumn: '1 / -1' }}>
            <legend className="flabel">{t('Qué es mejor')}</legend>
            <div className="chip-row">
              {(['mas', 'menos'] as const).map(m => (
                <button key={m} type="button" className={`chip sm accent${nueva.mejor === m ? ' on' : ''}`} aria-pressed={nueva.mejor === m}
                  onClick={() => setNueva({ ...nueva, mejor: m })}>{t(m === 'mas' ? 'Una marca más alta' : 'Una marca más baja (un tiempo)')}</button>
              ))}
            </div>
          </fieldset>
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="ef-p-desc">{t('Cómo se hace')}</label>
            <textarea id="ef-p-desc" className="finput" rows={2} value={nueva.descripcion} onChange={e => setNueva({ ...nueva, descripcion: e.target.value })} />
          </div>
          <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
            <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
            <button className="btn-ghost" onClick={() => setNueva(null)}>{t('Cancelar')}</button>
          </div>
        </div>
      ) : (
        <>
          <ul className="ap-lista">
            {pruebas.map(p => (
              <li key={p.id} style={p.oculta ? { opacity: 0.55 } : undefined}>
                <span className="ap-lista-txt">
                  <strong>{t(p.nombre)}</strong>
                  <span className="ap-meta"><span>{t(CATEGORIAS_PRUEBA.find(c => c.id === p.categoria)!.label)}</span><span>{t(p.unidad)}</span>{p.propia && <span className="sda-chip">{t('Tuya')}</span>}</span>
                </span>
                <button className="ico-btn" onClick={() => ocultar(p, !p.oculta)} aria-label={t(p.oculta ? 'Mostrar «{name}»' : 'Ocultar «{name}»', { name: t(p.nombre) })}
                  title={t(p.oculta ? 'Mostrar' : 'Ocultar')}>{p.oculta ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                {p.propia && (
                  <>
                    <button className="ico-btn" onClick={() => setNueva(p)} aria-label={t('Editar «{name}»', { name: p.nombre })} title={t('Editar')}><Pencil size={15} /></button>
                    <button className="ico-btn" onClick={() => {
                      if (window.confirm(t('¿Eliminar la prueba «{name}» y sus marcas?', { name: p.nombre }))) {
                        onChangeEf(d => ({ ...d, pruebas: d.pruebas.filter(x => x.id !== p.id), marcas: d.marcas.filter(m => m.pruebaId !== p.id), baremos: d.baremos.filter(b => b.pruebaId !== p.id) }));
                      }
                    }} aria-label={t('Eliminar «{name}»', { name: p.nombre })} title={t('Eliminar')}><Trash2 size={15} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="ap-acciones">
            <button className="btn-accent" onClick={() => setNueva({ id: nuevoIdEF('pru'), nombre: '', categoria: 'fuerza', unidad: '', mejor: 'mas', descripcion: '', propia: true })}>
              <Plus size={15} />{t('Nueva prueba')}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── Baremos de una prueba ── */

function Baremos({ open, onClose, prueba, ef, onChangeEf, cursoInicial, nombreCurso }: {
  open: boolean; onClose: () => void; prueba: PruebaFisica; ef: EfData; onChangeEf: Props['onChangeEf'];
  cursoInicial?: { etapa: 'primaria' | 'eso'; curso: number };
  nombreCurso: (c: { etapa: string; curso: number }) => string;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [editando, setEditandoBaremo] = useState<BaremoEF | null>(null);
  /** Los tramos tal como se escriben; se convierten al guardar. */
  const [filas, setFilas] = useState<{ marca: string; nota: string }[]>([]);
  const [pegado, setPegado] = useState('');
  const aTexto = (n: number) => (locale.startsWith('en') ? String(n) : String(n).replace('.', ','));
  const setEditando = (b: BaremoEF | null) => {
    setEditandoBaremo(b);
    setFilas(b ? b.tramos.map(x => ({ marca: aTexto(x.marca), nota: aTexto(x.nota) })) : []);
  };
  const lista = ef.baremos.filter(b => b.pruebaId === prueba.id)
    .sort((a, b) => a.etapa.localeCompare(b.etapa) || a.curso - b.curso || (a.sexo ?? '').localeCompare(b.sexo ?? ''));
  const sexoTxt = (s?: SexoEF) => t(s === 'F' ? 'Chicas' : s === 'M' ? 'Chicos' : 'Todo el grupo');

  function guardar() {
    if (!editando) return;
    const tramos = filas.flatMap(f => {
      const marca = leerNumero(f.marca);
      const nota = leerNumero(f.nota);
      return marca !== null && nota !== null && nota >= 0 && nota <= 10 ? [{ marca, nota }] : [];
    });
    if (!tramos.length) { toast(t('Añade al menos un tramo: una marca y su nota.')); return; }
    const b = { ...editando, tramos: [...tramos].sort((x, y) => x.nota - y.nota), fuente: editando.fuente.trim() || 'propio' };
    onChangeEf(d => ({ ...d, baremos: [...d.baremos.filter(x => x.id !== b.id && !(x.pruebaId === b.pruebaId && x.etapa === b.etapa && x.curso === b.curso && x.sexo === b.sexo)), b] }));
    setEditando(null);
    setPegado('');
  }

  return (
    <Modal open={open} onClose={() => { setEditando(null); onClose(); }} wide title={`${t('Baremos')} · ${t(prueba.nombre)}`}>
      {editando ? (
        <div className="ap-form">
          <div className="fgroup">
            <label className="flabel" htmlFor="ef-b-curso">{t('Curso')}</label>
            <select id="ef-b-curso" className="finput" value={`${editando.etapa}-${editando.curso}`}
              onChange={e => { const [etapa, curso] = e.target.value.split('-'); setEditandoBaremo({ ...editando, etapa: etapa as 'primaria' | 'eso', curso: Number(curso) }); }}>
              {CURSOS.map(c => <option key={`${c.etapa}-${c.curso}`} value={`${c.etapa}-${c.curso}`}>{nombreCurso(c)}</option>)}
            </select>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="ef-b-sexo">{t('Para')}</label>
            <select id="ef-b-sexo" className="finput" value={editando.sexo ?? ''}
              onChange={e => setEditandoBaremo(e.target.value ? { ...editando, sexo: e.target.value as SexoEF } : (({ sexo: _s, ...r }) => { void _s; return r; })(editando))}>
              <option value="">{t('Todo el grupo')}</option>
              <option value="F">{t('Chicas')}</option>
              <option value="M">{t('Chicos')}</option>
            </select>
          </div>
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <span className="flabel">{t('Tramos: con esta marca o mejor, esta nota')} ({t(prueba.unidad)})</span>
            <ul className="ef-tramos">
              {filas.map((f, i) => (
                <li key={i}>
                  <input className="finput" inputMode="decimal" aria-label={t('Marca del tramo {n}', { n: i + 1 })} value={f.marca}
                    onChange={e => setFilas(fs => fs.map((x, j) => (j === i ? { ...x, marca: e.target.value } : x)))} />
                  <span aria-hidden="true">→</span>
                  <input className="finput" inputMode="decimal" aria-label={t('Nota del tramo {n}', { n: i + 1 })} value={f.nota}
                    onChange={e => setFilas(fs => fs.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)))} />
                  <button type="button" className="ico-btn" onClick={() => setFilas(fs => fs.filter((_, j) => j !== i))} aria-label={t('Quitar el tramo')} title={t('Quitar')}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost" style={{ fontSize: 12.5 }} onClick={() => setFilas(fs => [...fs, { marca: '', nota: '' }])}><Plus size={14} />{t('Añadir tramo')}</button>
          </div>
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="ef-b-pegar">{t('O pégalo de una hoja de cálculo')}</label>
            <textarea id="ef-b-pegar" className="finput" rows={3} value={pegado} placeholder={t('Una línea por tramo: marca y nota. Ej: 160;5')} onChange={e => setPegado(e.target.value)} />
            <button type="button" className="btn-ghost" style={{ marginTop: 6, fontSize: 12.5 }} onClick={() => {
              const tramos = leerTramos(pegado);
              if (!tramos.length) { toast(t('No se ha entendido ninguna línea. Cada una, una marca y una nota.')); return; }
              setFilas(tramos.map(x => ({ marca: aTexto(x.marca), nota: aTexto(x.nota) })));
              toast(t(tramos.length === 1 ? '{n} tramo leído' : '{n} tramos leídos', { n: tramos.length }));
            }}>{t('Leer lo pegado')}</button>
          </div>
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <label className="flabel" htmlFor="ef-b-fuente">{t('De dónde sale')}</label>
            <input id="ef-b-fuente" className="finput" value={editando.fuente === 'propio' ? '' : editando.fuente} placeholder={t('Propio (o la referencia de donde lo has sacado)')}
              onChange={e => setEditandoBaremo({ ...editando, fuente: e.target.value })} />
          </div>
          <div className="ap-acciones" style={{ gridColumn: '1 / -1' }}>
            <button className="btn-accent" onClick={guardar}>{t('Guardar')}</button>
            <button className="btn-ghost" onClick={() => setEditando(null)}>{t('Cancelar')}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="ap-sub" style={{ marginBottom: 12 }}>
            {t('Un baremo dice qué nota da cada marca en un curso. Es opcional: sin baremo se ven las marcas y la mejora. La app todavía no trae baremos publicados; puedes crear el tuyo o pegar el de tu departamento.')}
          </p>
          {lista.length === 0 ? <p className="ap-vacio">{t('Esta prueba todavía no tiene baremos.')}</p> : (
            <ul className="ap-lista">
              {lista.map(b => (
                <li key={b.id}>
                  <span className="ap-lista-txt">
                    <strong>{nombreCurso(b)} · {sexoTxt(b.sexo)}</strong>
                    <span className="ap-meta">
                      <span>{t(b.tramos.length === 1 ? '{n} tramo' : '{n} tramos', { n: b.tramos.length })}</span>
                      <span>{b.fuente === 'propio' ? t('Propio') : b.fuente}</span>
                    </span>
                  </span>
                  <button className="ico-btn" onClick={() => setEditando(b)} aria-label={t('Editar')} title={t('Editar')}><Pencil size={15} /></button>
                  <button className="ico-btn" onClick={() => setEditando({ ...b, id: nuevoIdEF('bar'), curso: Math.min(b.etapa === 'eso' ? 4 : 6, b.curso + 1) })} aria-label={t('Copiar a otro curso')} title={t('Copiar a otro curso')}><Plus size={15} /></button>
                  <button className="ico-btn" onClick={() => onChangeEf(d => ({ ...d, baremos: d.baremos.filter(x => x.id !== b.id) }))} aria-label={t('Eliminar')} title={t('Eliminar')}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="ap-acciones">
            <button className="btn-accent" onClick={() => setEditando({
              id: nuevoIdEF('bar'), pruebaId: prueba.id, etapa: cursoInicial?.etapa ?? 'eso', curso: cursoInicial?.curso ?? 1,
              tramos: [], fuente: 'propio',
            })}><Plus size={15} />{t('Nuevo baremo')}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ── Pasar las notas al cuaderno ── */

function AlCuaderno({ open, onClose, clase, prueba, categorias, onConfirmar, onNav }: {
  open: boolean; onClose: () => void; clase: Class; prueba: PruebaFisica; categorias: GradeCategory[];
  onConfirmar: (categoriaId: string) => void; onNav: (s: Section) => void;
}) {
  const { t } = useI18n();
  const [cat, setCat] = useState('');
  const elegida = categorias.find(c => c.id === cat) ?? categorias[0];
  return (
    <Modal open={open} onClose={onClose} title={t('Pasar las notas al cuaderno')}>
      {categorias.length === 0 ? (
        <>
          <p className="ap-vacio">{t('{clase} todavía no tiene categorías en el cuaderno. Crea una (por ejemplo, «Condición física y salud») y vuelve.', { clase: clase.name })}</p>
          <div className="ap-acciones"><button className="btn-accent" onClick={() => onNav('notebook')}>{t('Ir al Cuaderno')}</button></div>
        </>
      ) : (
        <>
          <p className="ap-sub" style={{ marginBottom: 12 }}>
            {t('Se crea la columna «{prueba}» con la nota de la última marca de cada alumno, según su baremo.', { prueba: t(prueba.nombre) })}
          </p>
          <div className="fgroup">
            <label className="flabel" htmlFor="ef-c-cat">{t('En qué categoría')}</label>
            <select id="ef-c-cat" className="finput" value={elegida?.id} onChange={e => setCat(e.target.value)}>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="ap-acciones">
            <button className="btn-accent" onClick={() => elegida && onConfirmar(elegida.id)}>{t('Pasar al cuaderno')}</button>
            <button className="btn-ghost" onClick={onClose}>{t('Cancelar')}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
