import { useCallback, useEffect, useRef, useState } from 'react';
import { PeerLink, type LinkState } from '../services/p2p';
import {
  buildBundle, hashBundle, isSyncMessage,
  type MergeMode, type SharedBundle, type ShareScope, type SyncSource,
} from '../services/sync';

/** Espera antes de enviar cambios, para agrupar varias ediciones seguidas. */
const BROADCAST_DELAY_MS = 400;

export type PeerRole = 'host' | 'guest' | null;

interface Options {
  source: SyncSource;
  scope: ShareScope;
  userName: string;
  applyBundle: (bundle: SharedBundle, mode: MergeMode) => void;
}

/**
 * Mantiene viva la sesión compartida mientras el docente usa la app.
 * Vive en el componente raíz para que la sincronización siga funcionando
 * aunque se navegue a otra sección.
 */
export function useP2PSync({ source, scope, userName, applyBundle }: Options) {
  const [state, setState]       = useState<LinkState>('idle');
  const [role, setRole]         = useState<PeerRole>(null);
  const [code, setCode]         = useState('');
  const [peerName, setPeerName] = useState('');
  const [lastSyncAt, setLastSync] = useState<Date | null>(null);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const linkRef         = useRef<PeerLink | null>(null);
  const sentSnapshotRef = useRef(false);
  const justAppliedRef  = useRef(false);
  const lastSentHashRef = useRef('');
  const suppressHashRef = useRef('');

  // Copias vivas: los callbacks del canal se registran una sola vez, así que
  // deben leer siempre el estado actual y no el que había al conectar.
  const sourceRef = useRef(source);
  const scopeRef  = useRef(scope);
  const nameRef   = useRef(userName);
  const applyRef  = useRef(applyBundle);
  sourceRef.current = source;
  scopeRef.current  = scope;
  nameRef.current   = userName;
  applyRef.current  = applyBundle;

  const sendSnapshot = useCallback(() => {
    const link = linkRef.current;
    if (!link?.isOpen) return;
    link.send({ t: 'hello', name: nameRef.current });
    link.send({ t: 'snapshot', data: buildBundle(sourceRef.current, scopeRef.current) });
    sentSnapshotRef.current = true;
  }, []);

  const handlers = useCallback(() => ({
    onState: (s: LinkState) => {
      setState(s);
      if (s === 'connected' && !sentSnapshotRef.current) {
        // Pequeña espera para que el canal esté listo en los dos extremos
        setTimeout(sendSnapshot, 120);
      }
    },
    onError: (msg: string) => setError(msg),
    onMessage: (raw: unknown) => {
      if (!isSyncMessage(raw)) return;
      if (raw.t === 'hello') {
        setPeerName(raw.name || 'Compañero/a');
        return;
      }
      if (raw.t === 'snapshot') {
        applyRef.current(raw.data, 'reconcile');
        justAppliedRef.current = true;
        setLastSync(new Date());
        if (!sentSnapshotRef.current) setTimeout(sendSnapshot, 60);
        return;
      }
      if (raw.t === 'patch') {
        applyRef.current(raw.data, 'live');
        justAppliedRef.current = true;
        setLastSync(new Date());
      }
    },
  }), [sendSnapshot]);

  /* ── Envío de cambios locales mientras hay conexión ── */
  useEffect(() => {
    if (state !== 'connected') return;
    const timer = setTimeout(() => {
      const link = linkRef.current;
      if (!link?.isOpen) return;

      const bundle = buildBundle(sourceRef.current, scopeRef.current);
      const h = hashBundle(bundle);

      // Lo que acabamos de recibir no se reenvía: así la sincronización converge.
      if (justAppliedRef.current) {
        justAppliedRef.current = false;
        suppressHashRef.current = h;
        lastSentHashRef.current = h;
        return;
      }
      if (h === suppressHashRef.current || h === lastSentHashRef.current) return;

      if (link.send({ t: 'patch', data: bundle })) {
        lastSentHashRef.current = h;
        setLastSync(new Date());
      }
    }, BROADCAST_DELAY_MS);

    return () => clearTimeout(timer);
  }, [state, source, scope]);

  const reset = useCallback(() => {
    sentSnapshotRef.current = false;
    justAppliedRef.current  = false;
    lastSentHashRef.current = '';
    suppressHashRef.current = '';
    setCode('');
    setPeerName('');
    setError('');
  }, []);

  /** Anfitrión: reserva un código corto y queda a la espera. */
  const startHost = useCallback(async () => {
    linkRef.current?.close();
    reset();
    setRole('host');
    setBusy(true);
    try {
      const { link, code } = await PeerLink.host(handlers());
      linkRef.current = link;
      setCode(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la sesión.');
      setState('error');
      setRole(null);
    } finally {
      setBusy(false);
    }
  }, [handlers, reset]);

  /** Invitado: se une con el código que le han dado. */
  const startJoin = useCallback(async (input: string) => {
    linkRef.current?.close();
    reset();
    setRole('guest');
    setBusy(true);
    try {
      linkRef.current = await PeerLink.join(input, handlers());
      setCode(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar ese código.');
      setState('error');
      setRole(null);
    } finally {
      setBusy(false);
    }
  }, [handlers, reset]);

  const disconnect = useCallback(() => {
    linkRef.current?.close();
    linkRef.current = null;
    reset();
    setRole(null);
    setState('idle');
    setLastSync(null);
  }, [reset]);

  // Cierra la conexión si se cierra la app
  useEffect(() => () => { linkRef.current?.close(); }, []);

  return {
    state, role, code, peerName, lastSyncAt, error, busy,
    connected: state === 'connected',
    startHost, startJoin, disconnect,
  };
}
