/**
 * AulaPro en el navegador (aulapro.app/app/), instalable como aplicación en
 * Windows, Mac, Android, iPhone e iPad. Monta en `window.electronAPI` el mismo
 * contrato que Electron y Android, así el resto de la aplicación no necesita
 * saber en qué plataforma está:
 *
 *  - store:   perfiles y datos en el navegador (IndexedDB) y, si el docente
 *             elige una carpeta del ordenador, también ahí (`espejo.ts`).
 *             Nada sale hacia un servidor de AulaPro.
 *  - docs:    los PDF con el diálogo de imprimir del navegador, que ofrece
 *             «Guardar como PDF», con el mismo tamaño y márgenes que el
 *             escritorio.
 *  - license: la misma licencia que Android, por `/api/licencia/` (una
 *             función de Cloudflare Pages que solo pasa la clave a Lemon
 *             Squeezy: `web/funciones/`).
 *  - secrets: la clave de la IA, en el navegador.
 *  - update:  la versión nueva que trae el service worker (`web/app/sw.js`),
 *             que se pone sola al abrir la app, sin avisos.
 *
 * Lo que no hay: la Sala de alumnos (un navegador no puede abrir un servidor
 * en la wifi del aula) ni abrir carpetas del sistema. Solo se monta en la
 * compilación para la web (`vite build --mode web`): la app de escritorio, la
 * de Android y `npm run dev` siguen como antes.
 */
import { createProfileStore } from './profileStore';
import { idbFs, idbKv } from './webFs';
import { createEspejo } from './espejo';
import { abrirCarpetaGuardada, EVENTO_PDF, iniciarCarpeta, recargarCuandoSeAPuedeSinCortar } from './carpetaWeb';
import { createAndroidLicense, type LicensePost } from './androidLicense';
import { pedirApi } from './servidores';
import type { DocsBridge, DocsResult, StoreBridge, UpdateBridge } from '../types/electron';

/* ── Licencia ── */

const postLicencia: LicensePost = async (action, data) => {
  try {
    const res = await pedirApi(`/api/licencia/${action}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(data),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  } catch {
    return null; // sin conexión
  }
};

const secretos = {
  get: async (name: string) => (await idbKv.get<string>(`secreto:${name}`)) ?? '',
  set: async (name: string, value: string) => {
    if (value) await idbKv.set(`secreto:${name}`, value);
    else await idbKv.del(`secreto:${name}`);
    return true;
  },
};

/* ── PDF ── */

/** Los márgenes de `electron/main.cjs` (0,5 y 0,55 pulgadas), para los documentos que no traen su `@page`. */
const MARGENES = '12.7mm 13.97mm';

const escapar = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * El documento listo para imprimir: A4 con los márgenes del escritorio (el
 * `@page` propio del documento va después y manda), los fondos de color y el
 * título, que el navegador propone como nombre del PDF.
 */
export function htmlParaImprimir(html: string, titulo: string, apaisado: boolean): string {
  const base = `<style>@page{size:A4 ${apaisado ? 'landscape' : 'portrait'};margin:${MARGENES}}`
    + 'html{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>';
  const t = `<title>${escapar(titulo)}</title>`;
  const sinTitulo = html.replace(/<title>[\s\S]*?<\/title>/gi, '');
  if (/<head[^>]*>/i.test(sinTitulo)) return sinTitulo.replace(/<head[^>]*>/i, m => m + t + base);
  return `<!doctype html><html><head><meta charset="utf-8">${t}${base}</head><body>${sinTitulo}</body></html>`;
}

const espera = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function imprimir(html: string, nombre: string, apaisado: boolean): Promise<DocsResult> {
  const titulo = nombre.replace(/\.pdf$/i, '') || 'AulaPro';
  const marco = document.createElement('iframe');
  // Sin scripts, como la ventana del escritorio (javascript: false)
  marco.setAttribute('sandbox', 'allow-same-origin allow-modals');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;left:-12000px;top:0;width:1123px;height:794px;border:0;';
  const cargado = new Promise<void>(r => { marco.onload = () => r(); });
  marco.srcdoc = htmlParaImprimir(html, titulo, apaisado);
  document.body.appendChild(marco);
  await Promise.race([cargado, espera(15_000)]);

  const w = marco.contentWindow;
  const d = marco.contentDocument;
  if (!w || !d) { marco.remove(); return { error: 'print' }; }
  // Que estén las letras y los dibujos antes de abrir la vista de impresión
  await Promise.race([
    Promise.all([
      d.fonts?.ready,
      ...Array.from(d.images).map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r; }))),
    ]),
    espera(5_000),
  ]);

  // Un aviso de cómo guardarlo (components/CarpetaWeb.tsx, `AvisoPdfWeb`), y un momento para leerlo
  window.dispatchEvent(new Event(EVENTO_PDF));
  await espera(700);

  // Chrome propone como nombre del PDF el título de la página
  const antes = document.title;
  document.title = titulo;
  let hecho = false;
  const quitar = () => {
    if (hecho) return;
    hecho = true;
    document.title = antes;
    marco.remove();
  };
  w.addEventListener('afterprint', () => setTimeout(quitar, 500));
  setTimeout(quitar, 5 * 60_000);
  w.focus();
  w.print();
  // El diálogo es del navegador: la app no sabe si se guardó, se imprimió o se canceló
  return { canceled: true };
}

const docs: DocsBridge = {
  savePdf: (html, suggestedName, opts) => imprimir(html, suggestedName || 'AulaPro', opts?.landscape ?? true),
  print: html => imprimir(html, 'AulaPro', true),
  async reveal() { /* el navegador no abre carpetas */ },
};

/* ── Versión nueva ── */

function createUpdate(): UpdateBridge {
  let registro: ServiceWorkerRegistration | null = null;
  // Sin avisos (decisión del dueño, 29-10-2026): una versión nueva se descarga sola mientras se
  // trabaja y se pone la próxima vez que se abre la app, antes de que el docente haga nada.
  // Cambiarla a mitad de sesión rompería las pantallas que aún no se habían abierto.
  let pedido = false;
  if ('serviceWorker' in navigator) {
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!pedido || recargando) return;
      recargando = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(r => {
      registro = r;
      if (r.waiting && navigator.serviceWorker.controller) { pedido = true; r.waiting.postMessage('activar'); }
      // Quien deja la app abierta días enteros también la descarga
      setInterval(() => { r.update().catch(() => {}); }, 60 * 60 * 1000);
    }).catch(() => { /* sin service worker la app funciona igual, solo que no sin conexión */ });
  }

  return {
    onStatus: () => () => {},
    async installNow() {
      pedido = true;
      if (registro?.waiting) registro.waiting.postMessage('activar');
      else location.reload();
    },
    async setLanguage() { /* sin avisos en la web */ },
  };
}

/* ── Montaje ── */

async function idDeDispositivo(): Promise<string> {
  const actual = await idbKv.get<string>('dispositivo');
  if (actual) return actual;
  const nuevo = crypto.randomUUID();
  await idbKv.set('dispositivo', nuevo);
  return nuevo;
}

export async function installWebBridge() {
  // Que el navegador no borre los datos por falta de espacio (en Chrome, sobre todo si la app está instalada)
  navigator.storage?.persist?.().catch(() => false);

  const espejo = createEspejo({ local: idbFs, kv: idbKv, dispositivo: await idDeDispositivo() });
  iniciarCarpeta(espejo);
  // Antes de pintar: si otro ordenador dejó algo más nuevo en la carpeta, se trae ya
  await abrirCarpetaGuardada();
  const vaciar = () => { espejo.vaciar(); };
  // Lo de otro dispositivo llega solo: cada 30 s con la app a la vista y al volver a ella
  const revisar = async () => {
    if (document.visibilityState !== 'visible' || espejo.estado().tipo !== 'activa' || espejo.congelado()) return;
    if ((await espejo.comprobar({ congelar: true })) > 0) recargarCuandoSeAPuedeSinCortar();
  };
  setInterval(revisar, 30_000);
  window.addEventListener('focus', revisar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') vaciar(); else revisar(); });
  window.addEventListener('pagehide', vaciar);

  window.electronAPI = {
    isDesktop: false,
    platform: 'web',
    version: '',
    store: createProfileStore(espejo.fs) as unknown as StoreBridge,
    docs,
    update: createUpdate(),
    license: createAndroidLicense(secretos, { post: postLicencia, instanceName: 'AulaPro · Navegador' }),
    secrets: secretos,
  };
}
