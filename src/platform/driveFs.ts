/**
 * Versión web: el Google Drive del docente como si fuera una carpeta (`Fs`),
 * para que `espejo.ts` copie ahí el trabajo igual que en una carpeta del
 * ordenador (decisión del dueño, 29-10-2026: los datos en la cuenta del
 * docente, nunca en un servidor de AulaPro).
 *
 * Todo va en una carpeta «AulaPro» de su Drive, visible para él. Con el
 * permiso `drive.file`, AulaPro solo ve lo que ella misma ha creado: nada más
 * de su Drive. Drive no tiene carpetas dentro de carpetas aquí: cada ruta de
 * `profileStore` es un archivo de esa carpeta con la ruta en el nombre
 * (`AulaPro/perfiles/p1/datos.json` → `perfiles~p1~datos.json`). Las copias
 * con fecha no se suben (Drive ya guarda versiones anteriores de cada archivo),
 * salvo la de antes de vaciar el curso. Borrar manda a la papelera de Drive:
 * se puede recuperar durante 30 días.
 *
 * El navegador habla con Drive directamente (googleapis.com admite CORS).
 */
import { hijosDe } from './webFs';
import type { Fs, FsEntry } from './profileStore';

const API = 'https://www.googleapis.com/drive/v3/files';
const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files';
const CARPETA = 'application/vnd.google-apps.folder';
export const NOMBRE_CARPETA = 'AulaPro';
const RAIZ = 'AulaPro/';

/** Ruta de `profileStore` → nombre del archivo en la carpeta de Drive, y al revés. */
export const nombreDe = (ruta: string) => (ruta.startsWith(RAIZ) ? ruta.slice(RAIZ.length) : ruta).split('/').join('~');
export const rutaDe = (nombre: string) => RAIZ + nombre.split('~').join('/');

/** Lo que no va a Drive: las copias con fecha (salvo la de antes de vaciar el curso) y los temporales. */
export const vaADrive = (ruta: string) => (!/\/copias\//.test(ruta) || ruta.endsWith('-antes-de-vaciar.json')) && !ruta.endsWith('.tmp');

/** Cuánto vale un listado de la carpeta sin volver a pedirlo (ms). */
const VIGENCIA_LISTADO = 5000;

interface ArchivoDrive { id: string; name: string; size?: string; modifiedTime?: string }

/** El mensaje del error cuando el Drive del docente no tiene sitio (lo traduce `components/CarpetaWeb.tsx`). */
export const DRIVE_LLENO = 'drive-lleno';

/**
 * Un 401 o 403 de Drive sale como `NotAllowedError`: `espejo.ts` lo entiende
 * como «falta permiso». Salvo el Drive lleno (también 403): eso no se arregla
 * dando permiso, y el trabajo sigue a salvo en el navegador.
 */
export class ErrorDrive extends Error {
  status: number;
  constructor(status: number, mensaje: string, lleno = false) {
    super(lleno ? DRIVE_LLENO : mensaje);
    this.status = status;
    this.name = !lleno && (status === 401 || status === 403) ? 'NotAllowedError' : 'ErrorDrive';
  }
}

export function createDriveFs(token: () => Promise<string>, fetcher: typeof fetch = (...a) => fetch(...a)): Fs {
  let carpeta: Promise<string> | null = null;
  /** nombre → archivo, de la última vez que se listó. */
  let indice: Map<string, ArchivoDrive> | null = null;
  let listadoEn = 0;
  let listando: Promise<Map<string, ArchivoDrive>> | null = null;

  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await fetcher(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await token()}` } });
    if (!r.ok && r.status !== 404) {
      const motivo = r.status === 403 ? await r.clone().text().catch(() => '') : '';
      throw new ErrorDrive(r.status, `Drive ${r.status}`, /storageQuotaExceeded|quotaExceeded/.test(motivo));
    }
    return r;
  }

  function idCarpeta(): Promise<string> {
    return (carpeta ??= (async () => {
      const q = encodeURIComponent(`name='${NOMBRE_CARPETA}' and mimeType='${CARPETA}' and trashed=false and 'root' in parents`);
      const r = await (await pedir(`${API}?q=${q}&fields=files(id)&spaces=drive`)).json();
      if (r.files?.[0]?.id) return r.files[0].id as string;
      const nueva = await (await pedir(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: CARPETA }),
      })).json();
      return nueva.id as string;
    })().catch(err => { carpeta = null; throw err; }));
  }

  /**
   * El listado de la carpeta. Cada lectura y cada «¿hay carpeta de este perfil?» lo pedían de nuevo (de 3 a 5
   * llamadas seguidas al abrir): dentro de unos segundos se reutiliza el último, y varias peticiones a la vez
   * comparten una. Quien mira si hay novedades de otro dispositivo (cada 30 s) siempre ve un listado nuevo.
   */
  function listar(): Promise<Map<string, ArchivoDrive>> {
    if (indice && Date.now() - listadoEn < VIGENCIA_LISTADO) return Promise.resolve(indice);
    return (listando ??= listarDeVerdad().finally(() => { listando = null; }));
  }

  async function listarDeVerdad(): Promise<Map<string, ArchivoDrive>> {
    const padre = await idCarpeta();
    const out = new Map<string, ArchivoDrive>();
    let pagina = '';
    do {
      const q = encodeURIComponent(`'${padre}' in parents and trashed=false`);
      const r = await (await pedir(`${API}?q=${q}&fields=nextPageToken,files(id,name,size,modifiedTime)&pageSize=1000${pagina ? `&pageToken=${pagina}` : ''}`)).json();
      for (const f of r.files ?? []) out.set(f.name, f);
      pagina = r.nextPageToken ?? '';
    } while (pagina);
    indice = out;
    listadoEn = Date.now();
    return out;
  }

  const buscar = async (nombre: string) => (indice ?? await listar()).get(nombre) ?? (await listar()).get(nombre);

  const papelera = (id: string) => pedir(`${API}/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
  });

  const fs: Fs = {
    async read(ruta) {
      const f = await buscar(nombreDe(ruta));
      if (!f) return null;
      const r = await pedir(`${API}/${f.id}?alt=media`);
      return r.status === 404 ? null : r.text();
    },
    async write(ruta, data) {
      if (!vaADrive(ruta)) return;
      const nombre = nombreDe(ruta);
      const f = await buscar(nombre);
      if (f) {
        const r = await pedir(`${SUBIR}/${f.id}?uploadType=media&fields=id,name,size,modifiedTime`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: data,
        });
        if (r.status === 404) { indice?.delete(nombre); return fs.write(ruta, data); }
        indice?.set(nombre, await r.json());
        return;
      }
      const limite = 'aulapro' + Math.random().toString(36).slice(2);
      const cuerpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [await idCarpeta()] })}\r\n`
        + `--${limite}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${limite}--`;
      const r = await pedir(`${SUBIR}?uploadType=multipart&fields=id,name,size,modifiedTime`, {
        method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
      });
      indice?.set(nombre, await r.json());
    },
    async rename(from, to) {
      const data = await fs.read(from);
      if (data == null) return;
      await fs.write(to, data);
      await fs.remove(from);
    },
    async remove(ruta) {
      const nombre = nombreDe(ruta);
      const f = await buscar(nombre);
      if (!f) return;
      await papelera(f.id);
      indice?.delete(nombre);
    },
    async removeDir(ruta) {
      const prefijo = nombreDe(ruta) + '~';
      for (const [nombre, f] of await listar()) {
        if (!nombre.startsWith(prefijo)) continue;
        await papelera(f.id);
        indice?.delete(nombre);
      }
    },
    async list(ruta): Promise<FsEntry[]> {
      const todos = [...(await listar()).values()].map(f => [rutaDe(f.name), {
        data: { length: Number(f.size ?? 0) } as unknown as string,
        mtime: f.modifiedTime ? Date.parse(f.modifiedTime) : 0,
      }] as [string, { data: string; mtime: number }]);
      return hijosDe(ruta, todos);
    },
  };
  return fs;
}
