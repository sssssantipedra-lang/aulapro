/** Las copias de los perfiles de este navegador, para «Descargar mis datos» (`components/DescargarMisDatos.tsx`). */
import * as store from '../services/storage';
import { perfilVacio } from './contenidoPerfil';
import { isoDate } from './utils';

export interface Copia { nombre: string; archivo: string; blob: Blob }

/** Un nombre de perfil apto para un archivo: sin tildes ni signos. */
const paraArchivo = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

/** Los perfiles de este navegador que tienen trabajo, ya como archivos. Vacío si no hay ninguno o no se pueden leer. */
export async function copiasDeEsteNavegador(): Promise<Copia[]> {
  try {
    const out: Copia[] = [];
    for (const p of await store.listProfiles()) {
      const data = await store.loadData(p.id);
      if (!data || perfilVacio(data)) continue;
      const copia = {
        _app: 'AulaPro', _version: 2, _date: new Date().toISOString(),
        _profile: { name: p.name, school: p.school, subject: p.subject, course: p.course },
        data,
      };
      const sufijo = paraArchivo(p.name);
      out.push({
        nombre: p.name,
        archivo: `aulapro-copia-${sufijo ? sufijo + '-' : ''}${isoDate()}.json`,
        blob: new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }),
      });
    }
    return out;
  } catch {
    return [];
  }
}
