/**
 * Del texto oficial del calendario escolar de una comunidad a su entrada en
 * `web/sitio/calendario-escolar.json` (ver `src/lib/calendarioEscolar.ts`).
 *
 * Sin IA: cada comunidad publica cada año el mismo tipo de norma con la misma
 * estructura, y aquí se lee con reglas comprobadas con los textos de varios
 * cursos (`fixtures/`). Si una regla no encuentra lo que busca, la función
 * devuelve los `fallos` y la tarea que vigila los boletines (`vigilar.mjs`)
 * abre un aviso en vez de proponer un calendario a medias.
 *
 * Los nombres van en castellano, como en el resto del archivo: la app los
 * traduce con `t()`.
 */

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MESES_CA = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';
const FECHA = `(\\d{1,2}) de ${MES}(?: de (\\d{4}))?`;

/** El texto en una sola línea, sin guiones de final de línea ni espacios de más. */
export function plano(texto) {
  return texto.replace(/­/g, '').replace(/-\n(?=[a-záéíóú])/g, '').replace(/\s+/g, ' ').trim();
}

const iso = (a, m, d) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** «2027-2028» → [2027, 2028]. */
export function anios(curso) {
  const [a, b] = curso.split('-').map(Number);
  return [a, b];
}

/** El año de una fecha sin año dentro del curso: de septiembre a diciembre, el primero. */
const anioEnCurso = (curso, mes) => (mes >= 9 ? anios(curso)[0] : anios(curso)[1]);

function fecha(dia, mes, anio, curso) {
  const m = MESES[mes.toLowerCase()];
  return iso(anio ? Number(anio) : anioEnCurso(curso, m), m, Number(dia));
}

const esFinde = f => { const d = new Date(`${f}T12:00:00Z`).getUTCDay(); return d === 0 || d === 6; };

/**
 * «desde el 2 al 13 de abril de 2026», «del 22 de diciembre de 2026 al 6 de
 * enero de 2027» (cada año lo redactan un poco distinto), «desde el día 20
 * hasta el día 28 de marzo de 2027».
 */
function periodo(texto, curso) {
  const m = new RegExp(`(?:desde el|del) (?:día )?(\\d{1,2})(?: de ${MES})?(?: de (\\d{4}))? (?:al|hasta el) (?:día )?${FECHA}`, 'i').exec(texto);
  if (!m) return null;
  const [, d1, mes1, a1, d2, mes2, a2] = m;
  const hasta = fecha(d2, mes2, a2, curso);
  const desde = fecha(d1, mes1 ?? mes2, a1 ?? (mes1 ? undefined : hasta.slice(0, 4)), curso);
  return { desde, hasta };
}

/** «7 y 8 de diciembre», «12, 13 y 15 de febrero de 2027» → fechas. */
function dias(lista, mes, anio, curso) {
  return lista.split(/\s*(?:,|\by\b)\s*/).filter(Boolean).map(d => fecha(d, mes, anio, curso));
}

/** Nombres oficiales de los festivos, al nombre corto que usa la app (y que tiene traducción). */
const NOMBRES = {
  'día de la comunitat valenciana': 'Día de la Comunitat Valenciana',
  'fiesta nacional de españa': 'Fiesta Nacional de España',
  'día de la inmaculada concepción': 'Inmaculada Concepción',
  'inmaculada concepción': 'Inmaculada Concepción',
  'día de san josé': 'San José',
  'san josé': 'San José',
  'día internacional de los trabajadores': 'Día Internacional de los Trabajadores',
  'fiesta del trabajo': 'Día Internacional de los Trabajadores',
  'día de todos los santos': 'Todos los Santos',
  'todos los santos': 'Todos los Santos',
  'día de la constitución española': 'Día de la Constitución',
  'día de la constitución': 'Día de la Constitución',
  'diada nacional de catalunya': 'Diada Nacional de Catalunya',
};
const nombreFestivo = n => NOMBRES[n.trim().replace(/[.;]$/, '').toLowerCase()] ?? n.trim().replace(/[.;]$/, '');

/** En Madrid la orden solo da la fecha de cada festividad: el nombre sale de la fecha. */
const FESTIVOS_POR_FECHA = { '10-12': 'Fiesta Nacional de España', '12-08': 'Inmaculada Concepción', '11-01': 'Todos los Santos', '12-06': 'Día de la Constitución', '05-01': 'Día Internacional de los Trabajadores' };

function etapa(texto, regex, curso) {
  const m = regex.exec(texto);
  if (!m) return null;
  return { inicio: fecha(m[1], m[2], m[3], curso), fin: fecha(m[4], m[5], m[6], curso) };
}

function cerrar(cal, fallos) {
  // Los fines de semana ya no son lectivos: no hace falta marcarlos (y la app no los sombrea)
  cal.noLectivos = cal.noLectivos.filter(d => !esFinde(d.fecha));
  const vistos = new Set();
  cal.noLectivos = cal.noLectivos.filter(d => (vistos.has(d.fecha) ? false : vistos.add(d.fecha))).sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!cal.clases.primaria) fallos.push('no se encuentran el inicio y el fin de Primaria');
  if (!cal.clases.eso) fallos.push('no se encuentran el inicio y el fin de la ESO');
  if (!cal.vacaciones.some(v => /Navidad/.test(v.nombre))) fallos.push('no se encuentran las vacaciones de Navidad');
  if (cal.vacaciones.length < 2) fallos.push('no se encuentran las vacaciones de Semana Santa o Pascua');
  if (cal.noLectivos.length === 0) fallos.push('no se encuentra ningún día no lectivo');
  for (const e of Object.values(cal.clases)) {
    const [a, b] = anios(cal.curso);
    if (!e.inicio.startsWith(`${a}-09`) || !e.fin.startsWith(`${b}-06`)) fallos.push(`fechas de clase raras: ${e.inicio} a ${e.fin}`);
  }
  return { calendario: fallos.length ? null : cal, fallos };
}

/**
 * Comunitat Valenciana: resolución de la Dirección General de Centros
 * Docentes, en castellano. «Primero»: inicio y fin por enseñanzas; «Cuarto»:
 * vacaciones; «Quinto»: festivos («9 de octubre, Día de la Comunitat
 * Valenciana»).
 */
export function extraerCV(textoOriginal, curso) {
  const texto = plano(textoOriginal);
  const fallos = [];
  const cal = { curso, clases: {}, vacaciones: [], noLectivos: [] };
  const pri = etapa(texto, new RegExp(`Educación Primaria[^.]{0,80}?(?:se iniciarán|comenzarán) el ${FECHA}[^.]{0,40}?(?:finalizarán|terminarán) el ${FECHA}`, 'i'), curso);
  const eso = etapa(texto, new RegExp(`Educación Secundaria Obligatoria[^.]{0,80}?(?:se iniciarán|comenzarán) el ${FECHA}[^.]{0,40}?(?:finalizarán|terminarán) el ${FECHA}`, 'i'), curso);
  if (pri) cal.clases.primaria = pri;
  if (eso) cal.clases.eso = eso;
  for (const m of texto.matchAll(/Vacaciones de (Navidad|Pascua|Semana Santa): ([^.]*?ambos inclusive)/gi)) {
    const p = periodo(m[2], curso);
    if (p) cal.vacaciones.push({ nombre: `Vacaciones de ${m[1]}`, ...p });
  }
  const festivos = /no serán lectivos los días festivos siguientes:(.*?)(?:Sexto|Los ayuntamientos)/i.exec(texto);
  if (festivos) {
    for (const m of festivos[1].matchAll(new RegExp(`(\\d{1,2}) de ${MES}(?: de (\\d{4}))?,\\s*(.+?)(?=\\s+\\d{1,2} de ${MES}|$)`, 'gi'))) {
      cal.noLectivos.push({ fecha: fecha(m[1], m[2], m[3], curso), nombre: nombreFestivo(m[4]) });
    }
  }
  return cerrar(cal, fallos);
}

/**
 * Comunidad de Madrid: orden de la Consejería de Educación. Apartado segundo
 * (Primaria) y tercero (ESO): cuándo comienzan y terminan las actividades
 * lectivas; quinto: vacaciones, festividades (solo la fecha) y otros días no
 * lectivos.
 */
export function extraerMadrid(textoOriginal, curso) {
  const texto = plano(textoOriginal);
  const fallos = [];
  const cal = { curso, clases: {}, vacaciones: [], noLectivos: [] };
  const pri = etapa(texto, new RegExp(`Educación Primaria[^.]{0,120}?comenzarán el (?:día )?${FECHA}[^.]{0,60}?(?:finalizarán|terminarán) el (?:día )?${FECHA}`, 'i'), curso);
  const eso = etapa(texto, new RegExp(`Educación Secundaria Obligatoria[^.]{0,120}?comenzarán el (?:día )?${FECHA}[^.]{0,60}?(?:finalizarán|terminarán) el (?:día )?${FECHA}`, 'i'), curso);
  if (pri) cal.clases.primaria = pri;
  if (eso) cal.clases.eso = eso;
  for (const m of texto.matchAll(/(Navidad|Semana Santa)\. Comprenderán ([^.]*?ambos inclusive)/gi)) {
    const p = periodo(m[2], curso);
    if (p) cal.vacaciones.push({ nombre: `Vacaciones de ${m[1]}`, ...p });
  }
  const items = (bloque, nombre) => {
    for (const m of bloque.matchAll(new RegExp(`—\\s*((?:\\d{1,2}(?:,\\s*|\\s+y\\s+))*\\d{1,2}) de ${MES}(?: de (\\d{4}))?\\.`, 'gi'))) {
      for (const f of dias(m[1], m[2], m[3], curso)) cal.noLectivos.push({ fecha: f, nombre: nombre(f) });
    }
  };
  const festividades = /Festividades:(.*?)Otros días no lectivos/i.exec(texto);
  if (festividades) items(festividades[1], f => FESTIVOS_POR_FECHA[f.slice(5)] ?? 'Festivo');
  const otros = /Otros días no lectivos:(.*?)(?:En el caso de|Sexto|Especificaciones)/i.exec(texto);
  if (otros) items(otros[1], () => 'Día no lectivo');
  return cerrar(cal, fallos);
}

/* ── Cómo se cita la norma (como en el resto del archivo) ── */

function fechaLarga(isoFecha, idioma) {
  const [a, m, d] = isoFecha.split('-').map(Number);
  if (idioma === 'ca') {
    const mes = MESES_CA[m - 1];
    return `${d} ${/^[aeiouà]/.test(mes) ? `d'${mes}` : `de ${mes}`} de ${a}`;
  }
  return `${d} de ${MESES_ES[m - 1]} de ${a}`;
}

/** «RESOLUCIÓN de 15 de junio de 2026, de la Dirección General…, por la que se fija…» → «Resolución de 15 de junio de 2026, de la Dirección General…». */
function encabezado(titulo, corte) {
  const i = titulo.search(corte);
  const t = (i > 0 ? titulo.slice(0, i) : titulo).trim();
  return t.replace(/^(\S+)/, w => w.charAt(0) + w.slice(1).toLowerCase());
}

/** La cita de una resolución del DOGV en cada lengua, con su número y su fecha de publicación (dd/mm/aaaa). */
export function normaCV({ tituloEs, tituloCa, numeroDogv, fechaPublicacion }) {
  const [d, m, a] = fechaPublicacion.split('/');
  const f = `${a}-${m}-${d}`;
  const norma = { es: `${encabezado(tituloEs, /, por la que/i)} (DOGV núm. ${numeroDogv}, de ${fechaLarga(f, 'es')})` };
  if (tituloCa) norma.ca = `${encabezado(tituloCa, /, per la qual/i)} (DOGV núm. ${numeroDogv}, de ${fechaLarga(f, 'ca')})`;
  return norma;
}

/** «Orden 2034/2026, de 25 de mayo, de la Consejera…» y el boletín → «Orden 2034/2026, de 25 de mayo (BOCM núm. 131, de 4 de junio de 2026)». */
export function normaMadrid({ titulo, numero, fecha: f }) {
  const m = /Orden (\d+\/\d{4}), de (\d{1,2} de [a-záéíóú]+)/i.exec(titulo);
  return { es: `Orden ${m ? `${m[1]}, de ${m[2]}` : titulo} (BOCM núm. ${numero}, de ${fechaLarga(f, 'es')})` };
}

/** El curso siguiente al de una fecha: en octubre de 2026 (curso 2026-2027), el 2027-2028. */
export function cursoSiguiente(hoy) {
  const y = hoy.getUTCFullYear();
  const actual = hoy.getUTCMonth() >= 8 ? y : y - 1;
  return `${actual + 1}-${actual + 2}`;
}

export function cursoActual(hoy) {
  const y = hoy.getUTCFullYear();
  const a = hoy.getUTCMonth() >= 8 ? y : y - 1;
  return `${a}-${a + 1}`;
}
