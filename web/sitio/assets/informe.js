// La página del informe de uso (informe.html, 10-11-2026): pide los registros a aulapro.app (Netlify) y a su respaldo
// (Cloudflare) con la contraseña USUARIOS_INFORME_SECRETO, los junta y los enseña. Lo mismo que `scripts/usuarios.mjs`,
// con el mismo cálculo (assets/informe-usuarios.js). La contraseña vive solo en la memoria de la página: no se guarda en
// el navegador ni va a ningún sitio que no sea /api/licencia/usuarios. Todo lo que llega se escribe como texto, nunca
// como HTML.
// Se pide sin esperar: los botones tienen que responder desde el primer instante (con `await` arriba, un clic
// temprano enviaba el formulario sin pasar por aquí)
const calculo = import(new URL('assets/informe-usuarios.js', document.baseURI).href);

const PRODUCCION = /^(www\.)?aulapro\.app$/.test(location.hostname);
const SERVIDORES = PRODUCCION
  ? [['aulapro.app (Netlify)', 'https://aulapro.app/api/licencia/usuarios'], ['Respaldo (Cloudflare)', 'https://aulapro-app.pages.dev/api/licencia/usuarios']]
  : [['Este servidor', '/api/licencia/usuarios']];

const $ = id => document.getElementById(id);
const el = (tag, texto, clase) => { const e = document.createElement(tag); if (texto != null) e.textContent = String(texto); if (clase) e.className = clase; return e; };
const horas = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`);
const NOMBRE_TIPO = { beta: 'Acceso gratuito', fundador: 'Fundador', pago: 'Suscripción', 'sin-licencia': 'Sin licencia', 'sin dato': 'Sin dato' };
const tipo = t => NOMBRE_TIPO[t] ?? t;

let clave = '';
let informe = null;

function avisar(texto) { $('aviso').textContent = texto; $('aviso').hidden = !texto; }

function motivo(status) {
  if (status === 401) return 'la contraseña no coincide con la que tiene este servidor (si acabas de cambiarla en el panel, hay que volver a publicar la web para que la lea)';
  if (status === 404) return 'este servidor no tiene puesta la contraseña del informe (USUARIOS_INFORME_SECRETO)';
  if (status === 429) return 'demasiadas peticiones; espera un minuto';
  return `no responde (${status})`;
}

async function pedir(metodo, cuerpo) {
  return Promise.all(SERVIDORES.map(async ([nombre, url]) => {
    try {
      const r = await fetch(url, {
        method: metodo, cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { Authorization: `Bearer ${clave}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
      return { nombre, ok: r.ok, status: r.status, datos: r.ok && metodo === 'GET' ? await r.json() : null };
    } catch {
      return { nombre, ok: false, status: 0, datos: null };
    }
  }));
}

function pintarServidores(respuestas) {
  const ul = $('servidores');
  ul.replaceChildren(...respuestas.map(r => {
    const li = el('li', null, r.ok ? 'ok' : 'mal');
    li.append(el('b', r.nombre), document.createTextNode(r.ok ? `: ${r.datos.usuarios.length} docentes` : `: ${r.status ? motivo(r.status) : 'no se pudo consultar'}`));
    return li;
  }));
  ul.hidden = false;
}

async function cargar() {
  avisar('Consultando…');
  const respuestas = await pedir('GET');
  pintarServidores(respuestas);
  const buenas = respuestas.filter(r => r.ok);
  if (!buenas.length) {
    informe = null;
    $('informe').hidden = true;
    avisar(respuestas.some(r => r.status === 401) ? 'La contraseña no es correcta.' : 'No se ha podido leer el informe.');
    return;
  }
  const hoy = buenas.map(r => r.datos.hoy).sort().pop();
  const { analizar, fusionar } = await calculo;
  informe = analizar(fusionar(...buenas.map(r => r.datos.usuarios)), hoy);
  avisar('');
  $('entrar').hidden = true;
  $('salir').hidden = false;
  pintar();
}

function cifra(valor, texto) {
  const d = el('div', null, 'cifra');
  d.append(el('b', valor), el('span', texto));
  return d;
}

function pintar() {
  const r = informe.resumen;
  $('fecha').textContent = `Datos a ${informe.hoy}`;
  $('cifras').replaceChildren(
    cifra(r.usuarios, 'docentes registrados'),
    cifra(r.activosHoy, 'han entrado hoy'),
    cifra(r.activos7, 'en los últimos 7 días'),
    cifra(r.activos30, 'en los últimos 30 días'),
    cifra(`${String(r.horas7).replace('.', ',')} h`, 'de uso en 7 días'),
  );
  const chips = [...Object.entries(r.porEstado).map(([e, n]) => [`estado-${e.replace(' ', '-')}`, `${e}: ${n}`]),
    ...Object.entries(r.porTipo).map(([t, n]) => ['tipo', `${tipo(t)}: ${n}`])];
  $('estados').replaceChildren(...chips.map(([c, t]) => el('span', t, `chip ${c}`)));

  $('retencion').tBodies[0].replaceChildren(...r.retencion.map(c => {
    const tr = el('tr');
    tr.append(el('td', c.semana), el('td', c.altas), el('td', c.porcentaje == null ? 'aún no ha pasado una semana' : `${c.siguen} de ${c.conUnaSemana} (${c.porcentaje} %)`));
    return tr;
  }));

  const opciones = (sel, valores, nombre) => {
    const actual = sel.value;
    sel.replaceChildren(sel.options[0], ...valores.map(v => { const o = el('option', nombre(v)); o.value = v; return o; }));
    sel.value = valores.includes(actual) ? actual : '';
  };
  opciones($('f-estado'), Object.keys(r.porEstado), e => e);
  opciones($('f-tipo'), Object.keys(r.porTipo), tipo);
  pintarDocentes();
  $('informe').hidden = false;
}

const ORDEN = {
  n: (a, b) => a.n - b.n,
  ultimo: (a, b) => b.ultimoDia.localeCompare(a.ultimoDia) || a.n - b.n,
  uso7: (a, b) => b.minutos7 - a.minutos7 || a.n - b.n,
  total: (a, b) => b.minutosTotales - a.minutosTotales || a.n - b.n,
};

function pintarDocentes() {
  if (!informe) return;
  const q = $('buscar').value.trim().toLowerCase();
  const estado = $('f-estado').value;
  const t = $('f-tipo').value;
  const filas = informe.usuarios
    .filter(f => (!q || f.email.includes(q)) && (!estado || f.estado === estado) && (!t || (f.tipo || 'sin dato') === t))
    .sort(ORDEN[$('orden').value] ?? ORDEN.n);
  $('cuantos').textContent = filas.length === informe.usuarios.length ? `${filas.length} docentes` : `${filas.length} de ${informe.usuarios.length} docentes`;
  $('docentes').tBodies[0].replaceChildren(...filas.map(f => {
    const tr = el('tr');
    const estadoTd = el('td');
    estadoTd.append(el('span', f.estado, `chip estado-${f.estado.replace(' ', '-')}`));
    tr.append(el('td', f.n), el('td', f.email, 'correo'), el('td', tipo(f.tipo || 'sin dato')), el('td', f.alta), el('td', f.ultimoDia),
      estadoTd, el('td', f.frecuencia), el('td', f.diasDeUso, 'num'), el('td', f.racha, 'num'), el('td', horas(f.minutos7), 'num'),
      el('td', horas(f.minutosTotales), 'num'));
    return tr;
  }));
}

$('entrar').addEventListener('submit', e => {
  e.preventDefault();
  clave = $('clave').value.trim();
  if (clave) cargar();
});
$('salir').addEventListener('click', () => {
  clave = '';
  informe = null;
  $('clave').value = '';
  $('informe').hidden = true;
  $('servidores').hidden = true;
  $('salir').hidden = true;
  $('entrar').hidden = false;
  avisar('');
});
for (const id of ['buscar', 'f-estado', 'f-tipo', 'orden']) $(id).addEventListener('input', pintarDocentes);

$('csv').addEventListener('click', async () => {
  if (!informe) return;
  const { aCsv } = await calculo;
  const blob = new Blob(['﻿' + aCsv(informe) + '\r\n'], { type: 'text/csv;charset=utf-8' });   // con BOM: Excel lee bien las tildes
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = `usuarios-aulapro-${informe.hoy}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('borrar').addEventListener('submit', async e => {
  e.preventDefault();
  const accion = e.submitter?.value === 'excluir' ? 'excluir' : 'borrar';
  const correo = $('correo-borrar').value.trim().toLowerCase();
  if (!correo) return;
  const texto = accion === 'excluir'
    ? `Se borrarán los datos de ${correo} y no se le volverá a registrar. ¿Seguir?`
    : `Se borrarán los datos de ${correo}. Si vuelve a usar AulaPro, se le registrará de nuevo. ¿Seguir?`;
  if (!confirm(texto)) return;
  const res = await pedir('POST', { accion, correo });
  const mal = res.filter(r => !r.ok);
  $('borrar-resultado').textContent = mal.length
    ? `No se pudo en: ${mal.map(r => `${r.nombre} (${r.status ? motivo(r.status) : 'no responde'})`).join('; ')}. Vuelve a intentarlo cuando respondan.`
    : 'Hecho en todos los servidores.';
  if (!mal.length) $('correo-borrar').value = '';
  cargar();
});
