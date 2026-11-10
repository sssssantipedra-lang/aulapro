// El informe del registro de usuarios (web/funciones/api/_usuarios.js): junta lo que guardaron Netlify y Cloudflare y
// calcula qué dice el uso de cada docente. Sin dependencias, para que lo usen igual la página del informe
// (aulapro.app/informe, assets/informe.js, en el navegador) y `scripts/usuarios.mjs` (en el ordenador). El servidor no lo
// usa: solo guarda los registros y los entrega con la contraseña USUARIOS_INFORME_SECRETO.

const MAX_MINUTOS_DIA = 24 * 60;

/** Junta lo que apuntaron Netlify y Cloudflare: por correo, sumando los minutos de cada día. */
export function fusionar(...listas) {
  const porCorreo = new Map();
  for (const u of listas.flat()) {
    const a = porCorreo.get(u.email);
    if (!a) { porCorreo.set(u.email, { ...u, dias: { ...(u.dias ?? {}) } }); continue; }
    for (const [d, m] of Object.entries(u.dias ?? {})) a.dias[d] = Math.min(MAX_MINUTOS_DIA, (a.dias[d] ?? 0) + m);
    if (u.alta < a.alta) a.alta = u.alta;
    if (u.ultima > a.ultima) { a.ultima = u.ultima; a.tipo = u.tipo ?? a.tipo; a.proveedor = u.proveedor ?? a.proveedor; }
  }
  return [...porCorreo.values()];
}

// ---- El motor: qué dice el uso de cada docente ----

const numDia = d => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86400_000;
const diaDeNum = n => new Date(n * 86400_000).toISOString().slice(0, 10);
const lunesDe = d => { const n = numDia(d); return diaDeNum(n - ((new Date(n * 86400_000).getUTCDay() + 6) % 7)); };

/**
 * Lo que dice el uso de un docente el día `hoy` (AAAA-MM-DD):
 * - `estado`: «nuevo» (se dio de alta hace menos de 7 días), «activo» (la usó en los últimos 7 días), «en riesgo» (hace
 *   de 8 a 21 días) o «perdido» (hace más de 21).
 * - `frecuencia`: días de uso por semana en las últimas 4 (o desde el alta): «habitual» (3 o más), «semanal» (1 o más)
 *   u «ocasional».
 * - `racha`: días seguidos de uso que acaban hoy o ayer.
 */
export function analizarUsuario(u, hoy) {
  const h = numDia(hoy);
  const dias = Object.entries(u.dias ?? {}).filter(([d]) => numDia(d) <= h).sort(([a], [b]) => a.localeCompare(b));
  const usados = dias.map(([d]) => numDia(d));
  const ultimoUso = usados.length ? usados[usados.length - 1] : numDia(u.alta);
  const desdeAlta = h - numDia(u.alta);
  const sinUsar = h - ultimoUso;
  const en = n => dias.filter(([d]) => h - numDia(d) < n);
  const ventana = Math.min(28, desdeAlta + 1);
  const porSemana = (en(28).length / ventana) * 7;
  let racha = 0;
  if (sinUsar <= 1) for (let n = ultimoUso; usados.includes(n); n--) racha++;
  return {
    email: u.email,
    tipo: u.tipo ?? '',
    proveedor: u.proveedor ?? '',
    alta: u.alta,
    ultimoDia: diaDeNum(ultimoUso),
    diasSinUsar: sinUsar,
    diasDeUso: dias.length,
    dias7: en(7).length,
    dias30: en(30).length,
    minutosTotales: dias.reduce((s, [, m]) => s + m, 0),
    minutos7: en(7).reduce((s, [, m]) => s + m, 0),
    racha,
    porSemana: Math.round(porSemana * 10) / 10,
    frecuencia: porSemana >= 3 ? 'habitual' : porSemana >= 1 ? 'semanal' : 'ocasional',
    estado: desdeAlta < 7 ? 'nuevo' : sinUsar <= 7 ? 'activo' : sinUsar <= 21 ? 'en riesgo' : 'perdido',
    // Si siguió usándola una semana después de darse de alta (null: aún no ha pasado una semana)
    sigueTrasUnaSemana: desdeAlta < 7 ? null : usados.some(n => n >= numDia(u.alta) + 7),
  };
}

/** El informe completo: cada docente (del alta más antigua a la más reciente, numerado) y el resumen. */
export function analizar(usuarios, hoy) {
  const filas = usuarios.map(u => analizarUsuario(u, hoy)).sort((a, b) => a.alta.localeCompare(b.alta) || a.email.localeCompare(b.email))
    .map((f, i) => ({ n: i + 1, ...f }));
  const cuenta = pred => filas.filter(pred).length;
  const porTipo = {};
  const porEstado = {};
  for (const f of filas) { porTipo[f.tipo || 'sin dato'] = (porTipo[f.tipo || 'sin dato'] ?? 0) + 1; porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1; }
  const semanas = new Map();
  for (const f of filas) {
    const s = lunesDe(f.alta);
    const c = semanas.get(s) ?? { semana: s, altas: 0, conUnaSemana: 0, siguen: 0 };
    c.altas++;
    if (f.sigueTrasUnaSemana !== null) { c.conUnaSemana++; if (f.sigueTrasUnaSemana) c.siguen++; }
    semanas.set(s, c);
  }
  return {
    hoy,
    resumen: {
      usuarios: filas.length,
      porTipo,
      porEstado,
      activosHoy: cuenta(f => f.diasSinUsar === 0 && f.diasDeUso > 0),
      activos7: cuenta(f => f.dias7 > 0),
      activos30: cuenta(f => f.dias30 > 0),
      horas7: Math.round(filas.reduce((s, f) => s + f.minutos7, 0) / 6) / 10,
      // Retención: de los que se dieron de alta cada semana, cuántos la siguieron usando una semana después
      retencion: [...semanas.values()].sort((a, b) => a.semana.localeCompare(b.semana))
        .map(c => ({ ...c, porcentaje: c.conUnaSemana ? Math.round((c.siguen / c.conUnaSemana) * 100) : null })),
    },
    usuarios: filas,
  };
}

const COLUMNAS = ['n', 'email', 'tipo', 'proveedor', 'alta', 'ultimoDia', 'diasSinUsar', 'estado', 'frecuencia', 'porSemana', 'racha', 'diasDeUso', 'dias7', 'dias30', 'minutosTotales', 'minutos7'];
const celda = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };
/** El informe en CSV (separado por punto y coma, como lo abre Excel en España). */
export const aCsv = informe => [COLUMNAS.join(';'), ...informe.usuarios.map(f => COLUMNAS.map(c => celda(f[c])).join(';'))].join('\r\n');
