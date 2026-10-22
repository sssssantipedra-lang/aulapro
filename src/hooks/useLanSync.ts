import { useEffect, useRef, useState } from 'react';
import { buildBundle, hashBundle, type SharedBundle, type ShareScope, type SyncSource } from '../services/sync';
import { buildLanUrl, lanPullBundle, lanPushBundle, type LanTarget } from '../services/lan';

/** Cada cuánto comprueba el invitado si el anfitrión tiene algo nuevo (ms). */
const POLL_MS = 1500;

interface Options {
  source: SyncSource;
  scope: ShareScope;
  applyBundle: (bundle: SharedBundle, mode: 'reconcile' | 'live') => void;
}

/**
 * Canal local de «Trabajo compartido», sin internet: el anfitrión abre un
 * servidor en su equipo (electron/syncserver.cjs) y el invitado lee el paquete
 * por HTTP directo, en la misma wifi. Es el plan B para cuando PeerJS no puede
 * llegar a su punto de encuentro (redes sin salida a internet).
 *
 * Por ahora es **unidireccional**: «Mandar datos» sirve su paquete y «Recibir
 * datos» lo va trayendo y mezclando. El intercambio vivo en los dos sentidos
 * sigue por PeerJS cuando hay internet.
 */
export function useLanSync({ source, scope, applyBundle }: Options) {
  const lan = window.electronAPI?.lan;

  const [serving, setServing] = useState(false);
  const [code, setCode] = useState('');
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  /** Invitado: conectado a la dirección del anfitrión. */
  const [target, setTarget] = useState<LanTarget | null>(null);
  const [peer, setPeer] = useState(false);

  const sourceRef = useRef(source);
  const scopeRef = useRef(scope);
  const applyRef = useRef(applyBundle);
  const lastHashRef = useRef('');

  useEffect(() => {
    sourceRef.current = source;
    scopeRef.current = scope;
    applyRef.current = applyBundle;
  });

  const localBundle = () => buildBundle(sourceRef.current, scopeRef.current);

  /* ── Anfitrión: mantiene el paquete del servidor al día ── */
  useEffect(() => {
    if (!lan || !serving) return;
    const timer = setInterval(() => {
      const b = localBundle();
      const h = hashBundle(b);
      if (h !== lastHashRef.current) {
        lastHashRef.current = h;
        void lan.setBundle(b);
      }
    }, 800);
    return () => clearInterval(timer);
  }, [lan, serving]);

  async function startHost() {
    if (!lan) return null;
    const snap = await lan.start({ bundle: localBundle() });
    const ip = snap.addresses[0]?.ip;
    const url = ip && snap.port && snap.code ? buildLanUrl(ip, snap.port, snap.code) : null;
    setCode(snap.code ?? '');
    setLanUrl(url);
    setServing(snap.running);
    return url;
  }

  // El anfitrión se entera cuando un invitado se conecta (hace un POST de saludo).
  useEffect(() => {
    if (!lan) return;
    return lan.onPeer(() => setPeer(true));
  }, [lan]);

  async function stop() {
    if (lan) await lan.stop();
    setServing(false);
    setCode('');
    setLanUrl(null);
    setTarget(null);
    setPeer(false);
    lastHashRef.current = '';
  }

  /* ── Invitado: trae el paquete del anfitrión, en bucle ── */
  async function join(t: LanTarget) {
    setTarget(t);
    setPeer(true);
    lastHashRef.current = '';
    const first = await lanPullBundle(t);
    if (first) {
      applyRef.current(first, 'reconcile');
      lastHashRef.current = hashBundle(first);
    }
    // Saludo al anfitrión: con este POST se entera de que ya hay alguien conectado.
    void lanPushBundle(t, localBundle());
  }

  useEffect(() => {
    if (!target || !peer) return;
    const timer = setInterval(async () => {
      const remote = await lanPullBundle(target);
      if (!remote) return;
      const h = hashBundle(remote);
      if (h === lastHashRef.current) return;
      lastHashRef.current = h;
      applyRef.current(remote, 'reconcile');
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [target, peer]);

  return {
    available: !!lan,
    serving, code, lanUrl, peer,
    startHost, join, stop,
  };
}
