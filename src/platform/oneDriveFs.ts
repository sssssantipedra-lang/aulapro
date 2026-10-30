/**
 * Versión web: el OneDrive del docente como si fuera una carpeta (`Fs`), igual que `driveFs.ts` con Google
 * Drive. Todo va en la carpeta de la aplicación de su OneDrive («Aplicaciones › AulaPro»), a la que da acceso
 * el permiso `Files.ReadWrite.AppFolder`: AulaPro solo ve lo que ella misma crea, nada más de su OneDrive.
 * Como en Drive, no hay carpetas dentro de carpetas: cada ruta de `profileStore` es un archivo con la ruta en
 * el nombre (`AulaPro/perfiles/p1/datos.json` → `perfiles~p1~datos.json`), las copias con fecha no se suben
 * (salvo la de antes de vaciar el curso) y borrar manda el archivo a la papelera de OneDrive.
 *
 * El navegador habla con Microsoft Graph directamente (admite CORS). Para bajar un archivo, Graph da una
 * dirección temporal que ya lleva el permiso dentro: se pide sin `Authorization`.
 */
import { hijosDe } from './webFs';
import type { Fs, FsEntry } from './profileStore';
import { ErrorDrive, nombreDe, rutaDe, vaADrive } from './driveFs';

const GRAPH = 'https://graph.microsoft.com/v1.0/me/drive';
const CARPETA = `${GRAPH}/special/approot`;
/** Hasta aquí, una sola petición; por encima, una sesión de subida por trozos (Graph pide menos de 4 MB en la sencilla). */
const SUBIDA_SENCILLA = 3_500_000;
/** Múltiplo de 320 KiB, como exige Graph para los trozos. */
const TROZO = 32 * 320 * 1024;
/** Cuánto vale un listado de la carpeta sin volver a pedirlo (ms), igual que en Drive. */
const VIGENCIA_LISTADO = 5000;

interface ArchivoOneDrive {
  id: string; name: string; size?: number; lastModifiedDateTime?: string;
  '@microsoft.graph.downloadUrl'?: string;
}

export function createOneDriveFs(token: () => Promise<string>, fetcher: typeof fetch = (...a) => fetch(...a)): Fs {
  let carpeta: Promise<string> | null = null;
  let indice: Map<string, ArchivoOneDrive> | null = null;
  let listadoEn = 0;
  let listando: Promise<Map<string, ArchivoOneDrive>> | null = null;

  /** Una petición a Graph con el acceso. 401 y 403 salen como `NotAllowedError` (falta permiso); 507, como «lleno». */
  async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
    const r = await fetcher(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await token()}` } });
    if (!r.ok && r.status !== 404) throw new ErrorDrive(r.status, `OneDrive ${r.status}`, r.status === 507);
    return r;
  }

  /** La carpeta de la aplicación (Graph la crea la primera vez que se pide). */
  function idCarpeta(): Promise<string> {
    return (carpeta ??= (async () => {
      const r = await (await pedir(`${CARPETA}?$select=id`)).json();
      return r.id as string;
    })().catch(err => { carpeta = null; throw err; }));
  }

  const rutaArchivo = async (nombre: string) => `${GRAPH}/items/${await idCarpeta()}:/${encodeURIComponent(nombre)}:`;

  function listar(): Promise<Map<string, ArchivoOneDrive>> {
    if (indice && Date.now() - listadoEn < VIGENCIA_LISTADO) return Promise.resolve(indice);
    return (listando ??= listarDeVerdad().finally(() => { listando = null; }));
  }

  async function listarDeVerdad(): Promise<Map<string, ArchivoOneDrive>> {
    const out = new Map<string, ArchivoOneDrive>();
    let url: string | undefined = `${GRAPH}/items/${await idCarpeta()}/children?$select=id,name,size,lastModifiedDateTime,@microsoft.graph.downloadUrl&$top=200`;
    while (url) {
      const r = await (await pedir(url)).json();
      for (const f of (r.value ?? []) as ArchivoOneDrive[]) out.set(f.name, f);
      url = r['@odata.nextLink'];
    }
    indice = out;
    listadoEn = Date.now();
    return out;
  }

  const buscar = async (nombre: string) => (indice ?? await listar()).get(nombre) ?? (await listar()).get(nombre);

  const papelera = (id: string) => pedir(`${GRAPH}/items/${id}`, { method: 'DELETE' });

  /** Un archivo de menos de 4 MB, en una petición; más grande, por trozos con una sesión de subida. */
  async function subir(nombre: string, data: string): Promise<ArchivoOneDrive> {
    const bytes = new TextEncoder().encode(data);
    if (bytes.length <= SUBIDA_SENCILLA) {
      return (await pedir(`${await rutaArchivo(nombre)}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: data })).json();
    }
    const sesion = await (await pedir(`${await rutaArchivo(nombre)}/createUploadSession`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
    })).json();
    let ultimo: Response | null = null;
    for (let desde = 0; desde < bytes.length; desde += TROZO) {
      const hasta = Math.min(desde + TROZO, bytes.length);
      // La dirección de subida ya lleva el permiso: con `Authorization` Microsoft la rechaza
      ultimo = await fetcher(sesion.uploadUrl, {
        method: 'PUT', headers: { 'Content-Range': `bytes ${desde}-${hasta - 1}/${bytes.length}` }, body: bytes.slice(desde, hasta),
      });
      if (!ultimo.ok && ultimo.status !== 202) throw new ErrorDrive(ultimo.status, `OneDrive ${ultimo.status}`, ultimo.status === 507);
    }
    return ultimo!.json();
  }

  const fs: Fs = {
    async read(ruta) {
      const nombre = nombreDe(ruta);
      let f = await buscar(nombre);
      if (!f) return null;
      // Un archivo recién escrito no trae su dirección de bajada: se vuelve a listar para tenerla
      if (!f['@microsoft.graph.downloadUrl']) { listadoEn = 0; f = (await listar()).get(nombre); if (!f) return null; }
      const directa = f['@microsoft.graph.downloadUrl'];
      const r = directa ? await fetcher(directa) : await pedir(`${GRAPH}/items/${f.id}/content`);
      if (r.status === 404) return null;
      if (!r.ok) throw new ErrorDrive(r.status, `OneDrive ${r.status}`);
      return r.text();
    },
    async write(ruta, data) {
      if (!vaADrive(ruta)) return;
      const nombre = nombreDe(ruta);
      const f = await subir(nombre, data);
      // Sin la dirección de bajada: la de antes ya no vale, y se vuelve a pedir en el siguiente listado
      indice?.set(nombre, { ...f, '@microsoft.graph.downloadUrl': undefined });
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
        mtime: f.lastModifiedDateTime ? Date.parse(f.lastModifiedDateTime) : 0,
      }] as [string, { data: string; mtime: number }]);
      return hijosDe(ruta, todos);
    },
  };
  return fs;
}
