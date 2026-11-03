/**
 * Recibir en la ficha de un alumno de «Mis clases» las adaptaciones que envía el especialista de PT y AL
 * (`services/acsCompartir.ts`): se elige el archivo, se escribe la contraseña y se añaden a este alumno. Nunca se
 * borra ni se sustituye nada: si ya tiene una del mismo área, la recibida se añade al lado.
 */
import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { useI18n } from '../../i18n';
import { descifrarCopia, esCopiaCifrada } from '../../services/copiaCifrada';
import { acsDelArchivo } from '../../services/acsCompartir';
import { nuevoIdApoyo } from '../../lib/apoyo';
import type { ApoyoData } from '../../types/apoyo';

export function RecibirAcs({ alumnoId, onApoyo }: { alumnoId: string; onApoyo: (f: (d: ApoyoData) => ApoyoData) => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const x = await f.text();
    setError('');
    setClave('');
    if (!esCopiaCifrada(x)) { toast(t('Este archivo no es una copia cifrada de AulaPro, o está dañado.')); return; }
    setTexto(x);
  }

  async function abrir() {
    if (!texto) return;
    setAbriendo(true);
    setError('');
    try {
      const lista = acsDelArchivo(await descifrarCopia(texto, clave), alumnoId, nuevoIdApoyo);
      if (!lista.length) { setError(t('El archivo se ha abierto, pero no trae ninguna adaptación curricular.')); return; }
      onApoyo(d => ({ ...d, acsAula: [...d.acsAula, ...lista] }));
      toast(t('Adaptaciones recibidas: {n}.', { n: lista.length }));
      setTexto(null);
    } catch {
      setError(t('La contraseña no es correcta, o el archivo se ha modificado. Comprueba que la has escrito igual que te la dieron.'));
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => ref.current?.click()}><Download size={14} />{t('Recibir del especialista de PT')}</button>
      <input ref={ref} type="file" accept=".json,application/json" hidden onChange={elegir} />
      <Modal open={texto !== null} onClose={() => setTexto(null)} title={t('Recibir adaptaciones del especialista')}>
        <p className="ap-sub" style={{ marginTop: 0 }}>{t('Escribe la contraseña que te ha dado el especialista. Se añaden a este alumno; no se borra nada.')}</p>
        <div className="fgroup">
          <label className="flabel" htmlFor="acs-recibir-clave">{t('Contraseña del archivo')}</label>
          <input id="acs-recibir-clave" className="finput" value={clave} onChange={e => setClave(e.target.value)} autoComplete="off" spellCheck={false} />
        </div>
        {error && <p className="ap-aviso" role="alert">{error}</p>}
        <div className="ap-acciones">
          <button className="btn-accent" type="button" disabled={!clave.trim() || abriendo} onClick={abrir}>{abriendo ? t('Abriendo…') : t('Abrir y añadir')}</button>
          <button className="btn-ghost" type="button" onClick={() => setTexto(null)}>{t('Cancelar')}</button>
        </div>
      </Modal>
    </>
  );
}
