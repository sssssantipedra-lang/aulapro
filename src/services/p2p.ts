import Peer, { type DataConnection } from 'peerjs';

/**
 * Conexión entre dos equipos mediante un código corto.
 *
 * El anfitrión reserva un código de 6 caracteres en un punto de encuentro
 * público y el invitado lo teclea. Ese servicio solo sirve para que los dos
 * equipos se localicen: en cuanto se dan la mano, **los datos viajan
 * directamente de un ordenador a otro** (WebRTC, cifrado de extremo a extremo)
 * sin volver a pasar por él.
 */

/** Sin caracteres que se confundan al dictarlos: 0/O, 1/I/L. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ID_PREFIX = 'aulapro-v1-';

/** Intentos si el código sorteado ya está cogido por otra pareja. */
const MAX_CODE_ATTEMPTS = 6;
const OPEN_TIMEOUT_MS = 15000;

export function generateCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** Deja el código en mayúsculas y sin espacios ni guiones. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export function isCompleteCode(input: string): boolean {
  return normalizeCode(input).length === CODE_LENGTH;
}

/**
 * Valida el contenido leído de un QR. A diferencia de `normalizeCode`, que
 * recorta lo que sobra (útil al teclear), aquí el texto debe ser exactamente
 * un código: si no, cualquier QR ajeno pasaría por bueno al truncarse.
 */
export function parseScannedCode(raw: string): string | null {
  const clean = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  const valid = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(clean);
  return valid ? clean : null;
}

/** Lo separa en dos mitades para que sea más fácil de leer y dictar. */
export function formatCode(code: string): string {
  const c = normalizeCode(code);
  return c.length === CODE_LENGTH ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
}

export type LinkState =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface PeerLinkHandlers {
  onState?: (state: LinkState) => void;
  onMessage?: (msg: unknown) => void;
  onError?: (message: string) => void;
}

/** Traduce los códigos de error a algo que entienda un docente. */
function friendlyError(type: string): string {
  switch (type) {
    case 'peer-unavailable':
      return 'No hay ninguna sesión con ese código. Comprueba que esté bien escrito y que tu compañero/a la tenga abierta.';
    case 'unavailable-id':
      return 'Ese código acaba de ocuparse. Genera uno nuevo.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed':
      return 'No se pudo contactar con el servicio de conexión. Comprueba tu conexión a internet.';
    case 'browser-incompatible':
      return 'Este navegador no admite conexiones directas.';
    case 'webrtc':
      return 'La red no permite la conexión directa. Puede que el cortafuegos del centro la esté bloqueando.';
    default:
      return 'No se pudo establecer la conexión. Inténtalo de nuevo.';
  }
}

export class PeerLink {
  private peer: Peer;
  private conn: DataConnection | null = null;
  private handlers: PeerLinkHandlers;
  private closed = false;

  private constructor(peer: Peer, handlers: PeerLinkHandlers) {
    this.peer = peer;
    this.handlers = handlers;

    // El punto de encuentro cierra la sesión si está inactiva; se recupera
    // para que el código siga siendo válido mientras la ventana esté abierta.
    peer.on('disconnected', () => {
      if (!this.closed && !this.conn) {
        try { peer.reconnect(); } catch { /* ya cerrado */ }
      }
    });

    peer.on('error', err => {
      if (this.closed) return;
      const type = (err as { type?: string }).type ?? '';
      // Si ya hay conexión establecida, un fallo del punto de encuentro es irrelevante
      if (this.conn?.open) return;
      this.handlers.onError?.(friendlyError(type));
      this.handlers.onState?.('error');
    });
  }

  private bind(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => { if (!this.closed) this.handlers.onState?.('connected'); });
    conn.on('data', data => {
      try {
        this.handlers.onMessage?.(typeof data === 'string' ? JSON.parse(data) : data);
      } catch {
        // Mensaje ilegible: se ignora en lugar de romper la sesión.
      }
    });
    conn.on('close', () => { if (!this.closed) this.handlers.onState?.('disconnected'); });
    conn.on('error', () => {
      if (!this.closed) this.handlers.onError?.('Se perdió la conexión con tu compañero/a.');
    });
  }

  /** Crea un `Peer` con el id indicado y espera a que quede registrado. */
  private static open(id: string | undefined): Promise<Peer> {
    return new Promise((resolve, reject) => {
      const peer = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
      const timer = setTimeout(() => {
        try { peer.destroy(); } catch { /* noop */ }
        reject(new Error('timeout'));
      }, OPEN_TIMEOUT_MS);

      peer.once('open', () => { clearTimeout(timer); resolve(peer); });
      peer.once('error', err => {
        clearTimeout(timer);
        try { peer.destroy(); } catch { /* noop */ }
        reject(err);
      });
    });
  }

  /**
   * Anfitrión: reserva un código libre y queda a la espera.
   * Si el código sorteado ya existe, prueba con otro.
   */
  static async host(handlers: PeerLinkHandlers): Promise<{ link: PeerLink; code: string }> {
    handlers.onState?.('creating');

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      try {
        const peer = await PeerLink.open(ID_PREFIX + code);
        const link = new PeerLink(peer, handlers);
        peer.on('connection', conn => {
          // Solo se atiende a un compañero por sesión
          if (link.conn) { conn.close(); return; }
          handlers.onState?.('connecting');
          link.bind(conn);
        });
        handlers.onState?.('waiting');
        return { link, code };
      } catch (err) {
        const type = (err as { type?: string }).type ?? '';
        if (type === 'unavailable-id') continue; // código pillado, se prueba otro
        handlers.onState?.('error');
        throw new Error(err instanceof Error && err.message === 'timeout'
          ? 'El servicio de conexión no responde. Comprueba tu conexión a internet.'
          : friendlyError(type));
      }
    }

    handlers.onState?.('error');
    throw new Error('No se pudo reservar un código libre. Inténtalo de nuevo.');
  }

  /** Invitado: se conecta al código que le han dado. */
  static async join(rawCode: string, handlers: PeerLinkHandlers): Promise<PeerLink> {
    const code = normalizeCode(rawCode);
    if (code.length !== CODE_LENGTH) {
      throw new Error(`El código debe tener ${CODE_LENGTH} caracteres.`);
    }

    handlers.onState?.('connecting');
    let peer: Peer;
    try {
      peer = await PeerLink.open(undefined);
    } catch (err) {
      handlers.onState?.('error');
      throw new Error(err instanceof Error && err.message === 'timeout'
        ? 'El servicio de conexión no responde. Comprueba tu conexión a internet.'
        : friendlyError((err as { type?: string }).type ?? ''));
    }

    const link = new PeerLink(peer, handlers);
    const conn = peer.connect(ID_PREFIX + code, { reliable: true });
    link.bind(conn);

    // Si el código no existe, PeerJS avisa por 'error' en lugar de abrir el canal
    return link;
  }

  get isOpen(): boolean {
    return this.conn?.open === true;
  }

  send(msg: unknown): boolean {
    if (!this.isOpen) return false;
    try {
      this.conn!.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  close() {
    this.closed = true;
    try { this.conn?.close(); } catch { /* ya cerrado */ }
    try { this.peer.destroy(); } catch { /* ya cerrado */ }
    this.conn = null;
    this.handlers.onState?.('idle');
  }
}
