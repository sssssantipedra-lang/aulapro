/**
 * Vigila los boletines oficiales y propone el calendario escolar del curso
 * siguiente (decisión del dueño, 3-10-2026: automático, pero nada se publica
 * sin que alguien lo vea; ver docs/COMUNIDADES.md, «Calendario escolar»).
 *
 * Lo lanza `.github/workflows/calendario.yml`. Para cada comunidad que aún no
 * tiene el calendario del curso siguiente en `web/sitio/calendario-escolar.json`:
 *
 * - Comunitat Valenciana: busca en el DOGV (la API de su buscador) la
 *   resolución «calendario escolar del curso académico AAAA-AAAA» y la lee
 *   en castellano (`extraerCV`); el título en valenciano sale de la misma API.
 * - Comunidad de Madrid: repasa el sumario de los últimos boletines del BOCM
 *   buscando la orden «calendario escolar para el curso AAAA/AAAA» y la lee
 *   (`extraerMadrid`).
 * - Cataluña: su orden fija tres cursos y su texto no se puede leer desde
 *   fuera del navegador; se avisa para añadirlo a mano.
 *
 * Si encuentra y lee un calendario, lo añade al JSON (sube `actualizado` y
 * quita los cursos pasados) y escribe el resumen para el cambio que se
 * propone. Si encuentra la norma pero no la puede leer, o llega julio sin
 * norma, deja un aviso. No publica nada: eso lo hace el dueño al aprobar.
 *
 *     node scripts/calendario/vigilar.mjs [--hoy 2027-06-20] [--solo cv|madrid|cataluna]
 *
 * Salida (en `$SALIDA`, por defecto `.calendario/`): `resumen.md`,
 * `avisos.json` y, en GitHub Actions, `cambios`, `rama` y `avisos` en
 * `$GITHUB_OUTPUT`.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anios, cursoActual, cursoSiguiente, extraerCV, extraerMadrid, normaCV, normaMadrid } from './extraer.mjs';

const RAIZ = new URL('../../', import.meta.url).pathname;
const ARCHIVO = process.env.CALENDARIO_ARCHIVO || join(RAIZ, 'web/sitio/calendario-escolar.json');
const SALIDA = process.env.SALIDA || join(RAIZ, '.calendario');
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const HOY = arg('hoy') ? new Date(`${arg('hoy')}T12:00:00Z`) : new Date();
const SOLO = arg('solo');
const isoHoy = HOY.toISOString().slice(0, 10);

const ESPERA = 60_000;
async function pedir(url, opciones = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ESPERA);
  try {
    return await fetch(url, { ...opciones, signal: ctl.signal, headers: { 'User-Agent': 'AulaPro calendario escolar (https://aulapro.app)', ...(opciones.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

/** El texto de un PDF, con `pdftotext` (poppler-utils). */
async function textoDePdf(url) {
  const res = await pedir(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), 'calendario-'));
  const pdf = join(dir, 'norma.pdf');
  writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  return execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
}

/* ── Comunitat Valenciana: DOGV ── */

const DOGV = 'https://dogv.gva.es/dogv-portal';
async function buscarDogv(texto, desde, lang) {
  const cuerpo = {
    texto, soloTitulo: true, fechaInicioPublicacion: desde,
    tiposDocumentosId: [], organismosEmisoresId: [], organismosPublicadoresId: [], legislaturas: [],
    descriptoresOrganismosId: [], descriptoresGeograficosId: [], descriptoresTematicosId: [],
    isPortalLegislativo: false, soloDerogadas: false, soloVigentes: false, soloConsolidadas: false, enVigor: false,
  };
  const res = await pedir(`${DOGV}/dogv/search?lang=${lang}&page=0&size=20&sort=desc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`DOGV, búsqueda: ${res.status}`);
  return (await res.json()).content ?? [];
}

async function cv(curso) {
  const [a, b] = anios(curso);
  const delCurso = d => /calendario escolar/i.test(d.titulo) && new RegExp(`${a}\\s*[-/]\\s*${b}`).test(d.titulo);
  const es = (await buscarDogv('calendario escolar', `01-01-${a}`, 'es_es')).filter(delCurso);
  if (es.length === 0) return { encontrado: false };
  const d = es[0];
  const ca = (await buscarDogv('calendari escolar', `01-01-${a}`, 'es_ca')).find(x => x.id === d.id);
  const url = `https://dogv.gva.es/datos${d.urlPdf}`;
  const { calendario, fallos } = extraerCV(await textoDePdf(url), curso);
  return {
    encontrado: true, url, titulo: d.titulo, fallos,
    entrada: calendario && {
      comunidad: 'comunitat-valenciana', curso,
      norma: normaCV({ tituloEs: d.titulo, tituloCa: ca?.titulo, numeroDogv: d.numeroDogv, fechaPublicacion: d.fechaPublicacion }),
      url, verificado: true, clases: calendario.clases, vacaciones: calendario.vacaciones, noLectivos: calendario.noLectivos,
    },
  };
}

/* ── Comunidad de Madrid: BOCM ── */

/** El sumario del BOCM de un día (los domingos no hay: 404). */
async function sumarioBocm(fecha) {
  const [y, m, d] = fecha.split('-');
  const res = await pedir(`https://www.bocm.es/boletin/CM_Boletin_BOCM/${y}/${m}/${d}/BOCM-${y}${m}${d}.xml`);
  if (!res.ok) return null;
  const xml = await res.text();
  if (!xml.includes(`<identificador>BOCM-${y}${m}${d}</identificador>`)) return null;
  return xml;
}

async function madrid(curso, dias = 21) {
  const [a, b] = anios(curso);
  for (let k = 0; k < dias; k++) {
    const fecha = new Date(HOY.getTime() - k * 86_400_000).toISOString().slice(0, 10);
    const xml = await sumarioBocm(fecha);
    if (!xml) continue;
    for (const [, bloque] of xml.matchAll(/<disposicion[^>]*>([\s\S]*?)<\/disposicion>/g)) {
      const titulo = (/<titulo>([\s\S]*?)<\/titulo>/.exec(bloque)?.[1] ?? '').replace(/\s+/g, ' ');
      if (!/<rango>ORDEN<\/rango>/.test(bloque) || !new RegExp(`calendario escolar para el curso ${a}\\s*/\\s*${b}`, 'i').test(titulo)) continue;
      const url = /<url_pdf>([^<]+)<\/url_pdf>/.exec(bloque)[1].trim();
      const numero = Number(/<numero>(\d+)<\/numero>/.exec(xml)?.[1]);
      const { calendario, fallos } = extraerMadrid(await textoDePdf(url), curso);
      return {
        encontrado: true, url, titulo, fallos,
        entrada: calendario && {
          comunidad: 'madrid', curso, norma: normaMadrid({ titulo, numero, fecha }),
          url, verificado: true, clases: calendario.clases, vacaciones: calendario.vacaciones, noLectivos: calendario.noLectivos,
        },
      };
    }
  }
  return { encontrado: false };
}

/* ── Cataluña ── */

/** La Ordre EDF/66/2026 fija los cursos 2026-2027, 2027-2028 y 2028-2029. */
const ORDRE_CATALUNYA = { cursos: ['2026-2027', '2027-2028', '2028-2029'], url: 'https://portaljuridic.gencat.cat/eli/es-ct/o/2026/04/22/edf66', cita: "Ordre EDF/66/2026, de 22 d'abril" };

/* ── Todo junto ── */

const NOMBRE = { 'comunitat-valenciana': 'Comunitat Valenciana', madrid: 'Comunidad de Madrid', cataluna: 'Cataluña' };

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const archivo = JSON.parse(readFileSync(ARCHIVO, 'utf8'));
  const tiene = (c, curso) => archivo.calendarios.some(x => x.comunidad === c && x.curso === curso);
  const curso = cursoSiguiente(HOY);
  // Julio y agosto: desde septiembre el curso siguiente ya es el otro, que sale en primavera
  const desdeJulio = [6, 7].includes(HOY.getUTCMonth());
  const nuevas = [];
  const avisos = [];
  const fuentes = { 'comunitat-valenciana': cv, madrid };

  for (const [comunidad, buscar] of Object.entries(fuentes)) {
    if ((SOLO && !comunidad.startsWith(SOLO)) || tiene(comunidad, curso)) continue;
    let r;
    try {
      r = await buscar(curso);
    } catch (e) {
      console.error(`${comunidad}: ${e.message}`);
      r = { encontrado: false, error: e.message };
    }
    console.log(`${comunidad} ${curso}: ${r.encontrado ? (r.entrada ? 'leído' : `encontrado, sin leer (${r.fallos.join('; ')})`) : 'aún no está'}${r.error ? ` (error: ${r.error})` : ''}`);
    if (r.entrada) nuevas.push(r);
    else if (r.encontrado) {
      avisos.push({
        titulo: `Calendario escolar ${curso}: revisar el de ${NOMBRE[comunidad]}`,
        cuerpo: `Ha salido la norma, pero la tarea no ha podido leer todas sus fechas: ${r.fallos.join('; ')}.\n\n- ${r.titulo}\n- ${r.url}\n\nHay que añadirlo a mano en \`web/sitio/calendario-escolar.json\` (ver docs/COMUNIDADES.md, «Calendario escolar») y, si cambió la redacción, ajustar \`scripts/calendario/extraer.mjs\`.`,
      });
    } else if (desdeJulio) {
      avisos.push({
        titulo: `Calendario escolar ${curso}: aún no está el de ${NOMBRE[comunidad]}`,
        cuerpo: `Ya es julio y la tarea no encuentra en el boletín el calendario escolar ${curso} de ${NOMBRE[comunidad]}${r.error ? ` (error: ${r.error})` : ''}. Si ya se ha publicado, hay que añadirlo a mano en \`web/sitio/calendario-escolar.json\` y revisar por qué no lo encuentra \`scripts/calendario/vigilar.mjs\`.`,
      });
    }
  }

  if ((!SOLO || 'cataluna'.startsWith(SOLO)) && !tiene('cataluna', curso)) {
    const enLaOrden = ORDRE_CATALUNYA.cursos.includes(curso);
    avisos.push({
      titulo: `Calendario escolar ${curso}: añadir el de Cataluña`,
      cuerpo: enLaOrden
        ? `El calendario ${curso} de Cataluña ya está publicado en la ${ORDRE_CATALUNYA.cita} (${ORDRE_CATALUNYA.url}), que fija tres cursos. Su texto no se puede leer automáticamente: hay que añadirlo a mano en \`web/sitio/calendario-escolar.json\` (inicio y fin de Primaria y ESO, Navidad, Semana Santa y los festivos generales).`
        : `La ${ORDRE_CATALUNYA.cita} llega hasta el curso 2028-2029. Hay que buscar en el DOGC la orden del calendario ${curso} y añadirlo a mano en \`web/sitio/calendario-escolar.json\`.`,
    });
  }

  let cambios = false;
  if (nuevas.length) {
    const actual = cursoActual(HOY);
    archivo.calendarios = [...archivo.calendarios.filter(c => c.curso >= actual), ...nuevas.map(n => n.entrada)];
    archivo.actualizado = isoHoy;
    writeFileSync(ARCHIVO, `${JSON.stringify(archivo, null, 2)}\n`);
    cambios = true;
  }

  const filas = nuevas.map(n => {
    const e = n.entrada;
    const vac = e.vacaciones.map(v => `${v.nombre}: ${v.desde} a ${v.hasta}`).join('<br>');
    const dias = e.noLectivos.map(d => `${d.fecha} (${d.nombre})`).join('<br>');
    return `### ${NOMBRE[e.comunidad]}, ${e.curso}\n\n${e.norma.es}. [Texto oficial](${n.url})\n\n| | |\n|---|---|\n| Primaria | ${e.clases.primaria.inicio} a ${e.clases.primaria.fin} |\n| ESO | ${e.clases.eso.inicio} a ${e.clases.eso.fin} |\n| Vacaciones | ${vac} |\n| Días no lectivos | ${dias} |\n`;
  });
  writeFileSync(join(SALIDA, 'resumen.md'), [
    `La tarea que vigila los boletines ha encontrado y leído el calendario escolar del curso ${curso}:`,
    '', ...filas, '',
    'Antes de aprobar, comprueba las fechas con el texto oficial (enlazado arriba). Las pruebas del calendario ya han pasado en la tarea. Al fusionar, la web publica el calendario y las apps lo descargan al abrirse.',
  ].join('\n'));
  writeFileSync(join(SALIDA, 'avisos.json'), JSON.stringify(avisos, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `cambios=${cambios ? 'si' : 'no'}\nrama=calendario-${curso}-${nuevas.map(n => n.entrada.comunidad).join('-')}\navisos=${avisos.length}\ncurso=${curso}\n`);
  }
  console.log(`Nuevos: ${nuevas.length}. Avisos: ${avisos.length}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
