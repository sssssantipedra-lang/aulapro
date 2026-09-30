/**
 * Sala de alumnos en Android: qué contesta la tableta a cada móvil. Es la
 * misma lógica que `electron/classroom.cjs` en el escritorio (mismas rutas,
 * mismo código de 6 letras, misma página del alumno), para que la sala se
 * comporte igual abra quien la abra. El servidor HTTP es nativo
 * (RoomServer.java) y solo pasa las peticiones aquí.
 */
import type { ClassroomActivity, ClassroomResponse, ClassroomSnapshot } from '../types/electron';

export interface RoomRequest { method: string; path: string; query: string; body: string }
export interface RoomReply { status: number; type: string; body: string }

/** Sin caracteres que se confundan al dictarlos. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const HTML = 'text/html; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';
const TEXT = 'text/plain; charset=utf-8';

function randomCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Redes domésticas y escolares típicas primero, como en el escritorio. */
export function sortAddresses(list: { iface: string; ip: string }[]) {
  const score = (ip: string) => ip.startsWith('192.168.') ? 0 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 1 : ip.startsWith('10.') ? 2 : 3;
  return [...list].sort((a, b) => score(a.ip) - score(b.ip));
}

type Roster = { n: number; name: string }[];

export function createRoom(studentPage: string) {
  let running = false;
  let port: number | null = null;
  let code: string | null = null;
  let label = '';
  let activity: ClassroomActivity | null = null;
  let roster: Roster = [];
  let addresses: { iface: string; ip: string }[] = [];
  const responses = new Map<string, ClassroomResponse>();

  const snapshot = (): ClassroomSnapshot => ({
    running, port, code, label,
    addresses: running ? addresses : [],
    activity,
    responses: [...responses.values()],
    connected: responses.size,
  });

  const json = (status: number, obj: unknown): RoomReply => ({ status, type: JSON_TYPE, body: JSON.stringify(obj) });

  return {
    snapshot,

    open(opts: { roster?: Roster; activity?: ClassroomActivity | null; label?: string }, net: { port: number; addresses: { iface: string; ip: string }[] }) {
      if (!running) {
        code = randomCode();
        responses.clear();
      }
      running = true;
      port = net.port;
      addresses = sortAddresses(net.addresses);
      label = String(opts.label || '').slice(0, 60);
      roster = opts.roster ?? [];
      activity = opts.activity ?? null;
      return snapshot();
    },

    close() {
      running = false;
      port = null;
      code = null;
      label = '';
      activity = null;
      responses.clear();
      return snapshot();
    },

    setAddresses(list: { iface: string; ip: string }[]) { addresses = sortAddresses(list); },

    setActivity(a: ClassroomActivity | null) {
      activity = a;
      // Cambiar de actividad limpia las respuestas de la anterior
      responses.clear();
      return snapshot();
    },

    setRoster(r: Roster, l?: string) {
      roster = r || [];
      if (typeof l === 'string' && l) label = l.slice(0, 60);
      return snapshot();
    },

    /** Contesta a un móvil. `changed`: ha llegado una respuesta nueva. */
    handle(req: RoomRequest): RoomReply & { changed?: boolean } {
      if (!running) return { status: 503, type: TEXT, body: 'Sala cerrada' };
      const params = new URLSearchParams(req.query);

      // La página se sirve en cualquier ruta: el código se valida en la API
      if (req.method === 'GET' && (req.path === '/' || req.path.startsWith('/r/'))) {
        return { status: 200, type: HTML, body: studentPage };
      }
      // De quién es la sala: sin código, solo el nombre (ver classroom.cjs)
      if (req.method === 'GET' && req.path === '/api/room') return json(200, { label: label || null });

      const c = params.get('c');
      const validCode = typeof c === 'string' && c.toUpperCase() === code;

      if (req.method === 'GET' && req.path === '/api/state') {
        if (!validCode) return json(403, { error: 'codigo' });
        return json(200, {
          activity,
          roster: roster.map(s => ({ n: s.n, name: s.name })),
          answered: [...responses.values()].map(r => r.n),
        });
      }

      if (req.method === 'POST' && req.path === '/api/submit') {
        if (!validCode) return json(403, { error: 'codigo' });
        let payload: { n?: unknown; name?: unknown; data?: ClassroomResponse['data'] };
        try { payload = JSON.parse(req.body); } catch { return json(400, { error: 'formato' }); }
        const entry: ClassroomResponse = {
          n: Number(payload.n) || null,
          name: String(payload.name || '').slice(0, 80),
          activityId: activity?.id ?? null,
          type: activity?.type ?? null,
          data: payload.data ?? null,
          at: new Date().toISOString(),
        };
        // Una respuesta por alumno y actividad; la última sustituye a la anterior
        const key = `${entry.activityId}:${entry.n ?? entry.name}`;
        // En lluvia de ideas se acumulan varias aportaciones
        if (entry.type === 'brainstorm') {
          const prev = responses.get(key);
          entry.data = { ideas: [...(prev?.data?.ideas ?? []), ...(entry.data?.ideas ?? [])].slice(-20) };
        }
        responses.set(key, entry);
        return { ...json(200, { ok: true }), changed: true };
      }

      return { status: 404, type: TEXT, body: 'No encontrado' };
    },
  };
}
