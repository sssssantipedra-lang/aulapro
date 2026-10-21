/**
 * «Importar de un documento» en Material e instalaciones (petición del
 * dueño, 20-10-2026): se elige un archivo del centro con su inventario (hoja
 * de cálculo, CSV, texto o PDF), se ve lo que se ha leído y se vuelca al
 * catálogo lo que se marque. Las tablas y los textos por líneas se leen en el
 * equipo; el PDF, o lo que no se entiende así, lo lee la IA con la clave del
 * docente, y la pantalla avisa de ello antes de enviarlo.
 */
import { useRef, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { nuevoIdEF } from '../../lib/ef';
import { aplicarImportacion, prepararImportacion, type MaterialPorImportar } from '../../lib/importarMaterial';
import { EXTENSIONES_MATERIAL, MAX_BYTES_MATERIAL, leerDocumentoMaterial, type DocumentoLeido } from '../../lib/leerMaterial';
import { materialDesdeDocumento } from '../../services/efIA';
import { hasApiKey } from '../../services/gemini';
import type { EfData } from '../../types/ef';

interface Props {
  open: boolean;
  onClose: () => void;
  ef: EfData;
  onChangeEf: (f: (d: EfData) => EfData) => void;
}

export function ImportarMaterial({ open, onClose, ef, onChangeEf }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  /** Si hace falta la IA, lo que se le enviaría; hasta que el docente lo confirme, no sale nada. */
  const [pendienteIA, setPendienteIA] = useState<DocumentoLeido['paraIA'] | null>(null);
  const [filas, setFilas] = useState<MaterialPorImportar[]>([]);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());

  function reiniciar() {
    setArchivo(''); setError(''); setPendienteIA(null); setFilas([]); setMarcadas(new Set()); setLeyendo(false);
  }
  function cerrar() { reiniciar(); onClose(); }

  function ver(leidos: Parameters<typeof prepararImportacion>[0]) {
    const p = prepararImportacion(leidos, ef.material);
    setFilas(p);
    setMarcadas(new Set(p.map((_, i) => i)));
  }

  async function elegir(files: FileList | null) {
    const f = files?.[0];
    if (entrada.current) entrada.current.value = '';
    if (!f) return;
    reiniciar();
    if (f.size > MAX_BYTES_MATERIAL) { setError(t('El archivo supera el límite de 19 MB.')); return; }
    setArchivo(f.name);
    setLeyendo(true);
    try {
      const r = await leerDocumentoMaterial(f);
      if (r.leidos.length) ver(r.leidos);
      else if (r.paraIA) setPendienteIA(r.paraIA);
      else setError(t('No se ha encontrado material en el documento.'));
    } catch (e) {
      setError(e instanceof Error && e.message === 'formato'
        ? t('Ese formato no se puede leer. Prueba con Excel, CSV, texto, Word (.docx) o PDF.')
        : t('No se pudo leer el archivo. Prueba a guardarlo como CSV.'));
    }
    setLeyendo(false);
  }

  async function leerConIA() {
    if (!pendienteIA) return;
    const r = await materialDesdeDocumento(pendienteIA, {
      onStart: () => setLeyendo(true), onEnd: () => setLeyendo(false), onError: m => setError(m),
    });
    if (!r) { setError(prev => prev || t('La IA no pudo leer el documento. Vuelve a intentarlo.')); return; }
    setPendienteIA(null);
    if (r.length === 0) setError(t('No se ha encontrado material en el documento.'));
    else ver(r);
  }

  function volcar() {
    const elegidos = filas.filter((_, i) => marcadas.has(i));
    if (elegidos.length === 0) return;
    onChangeEf(d => ({ ...d, material: aplicarImportacion(d.material, elegidos, () => nuevoIdEF('mat')) }));
    const nuevos = elegidos.filter(e => !e.existente).length;
    const actualizados = elegidos.length - nuevos;
    toast(t('✅ Material importado: {nuevos} nuevos y {actualizados} actualizados', { nuevos, actualizados }));
    cerrar();
  }

  const alternar = (i: number) => setMarcadas(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <Modal open={open} onClose={cerrar} wide title={t('Importar material de un documento')}>
      <p className="ap-sub" style={{ marginBottom: 12 }}>
        {t('Sube el inventario del centro (Excel, CSV, texto, Word o PDF) y se añade al catálogo sin escribirlo a mano. Si un material ya está, se actualiza su cantidad.')}
      </p>
      <div className="ap-acciones" style={{ marginBottom: 12 }}>
        <button type="button" className="btn-ghost" onClick={() => entrada.current?.click()} disabled={leyendo}>
          <FileUp size={15} />{archivo ? t('Elegir otro documento') : t('Elegir un documento')}
        </button>
        {archivo && <span className="ap-sub">{archivo}</span>}
        <input ref={entrada} type="file" accept={EXTENSIONES_MATERIAL} hidden aria-label={t('Documento con el inventario')} onChange={e => elegir(e.target.files)} />
      </div>

      {leyendo && <p className="ap-aviso" role="status"><span className="spin" /> {t('Leyendo el documento…')}</p>}
      {error && <p className="ap-aviso" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}

      {pendienteIA && !leyendo && (
        <div className="ap-aviso" role="status">
          <p style={{ margin: '0 0 8px' }}>
            {t('Este documento no se puede leer en tu equipo (un PDF o un texto sin forma de lista). Se puede leer con la IA: el documento se envía a Google con tu clave, igual que el resto de funciones de IA. No lo uses si lleva datos personales del alumnado.')}
          </p>
          <button type="button" className="btn-accent" onClick={leerConIA} disabled={!hasApiKey()}
            title={hasApiKey() ? undefined : t('Configura tu clave API gratuita de Google en Configuración para usar la IA.')}>
            <Sparkles size={14} />{t('Leer con la IA')}
          </button>
        </div>
      )}

      {filas.length > 0 && (
        <>
          <div className="ef-tabla-wrap" style={{ marginTop: 0 }}>
            <table className="ef-tabla">
              <thead><tr>
                <th scope="col"><span className="sr-only">{t('Importar')}</span></th>
                <th scope="col">{t('Material')}</th><th scope="col">{t('Cantidad')}</th><th scope="col">{t('Estado')}</th><th scope="col">{t('Dónde está')}</th>
                <th scope="col">{t('Qué pasa')}</th>
              </tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={marcadas.has(i)} onChange={() => alternar(i)} aria-label={t('Importar «{nombre}»', { nombre: f.nombre })} /></td>
                    <th scope="row">{f.nombre}</th>
                    <td className="ef-num">{f.cantidad}</td>
                    <td>{f.estado ? t(f.estado === 'bien' ? 'Bien' : f.estado === 'regular' ? 'Regular' : 'Para reponer') : ''}</td>
                    <td>{f.ubicacion ?? ''}</td>
                    <td className="ap-sub">{f.existente ? t('Ya está ({n}): se actualiza', { n: f.existente.cantidad }) : t('Nuevo')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ap-acciones" style={{ marginTop: 12 }}>
            <button type="button" className="btn-accent" onClick={volcar} disabled={marcadas.size === 0}>
              {t(marcadas.size === 1 ? 'Añadir {n} material al catálogo' : 'Añadir {n} materiales al catálogo', { n: marcadas.size })}
            </button>
            <button type="button" className="btn-ghost" onClick={cerrar}>{t('Cancelar')}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
