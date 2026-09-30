import { describe, it, expect } from 'vitest';
import { createRoom, sortAddresses } from './classroomRoom';

const activity = { id: 'a1', type: 'poll' as const, title: '¿Qué prefieres?', options: ['Sí', 'No'] };
const roster = [{ n: 1, name: 'Ana' }, { n: 2, name: 'Luis' }];
const net = { port: 8080, addresses: [{ iface: 'wlan0', ip: '192.168.1.40' }] };

function openRoom() {
  const room = createRoom('<html>alumno</html>');
  const snap = room.open({ roster, activity, label: '3º ESO A' }, net);
  return { room, code: snap.code! };
}

describe('Sala de alumnos en Android (misma lógica que el escritorio)', () => {
  it('abre con un código de 6 letras sin caracteres confusos', () => {
    const { room, code } = openRoom();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(room.snapshot()).toMatchObject({ running: true, port: 8080, label: '3º ESO A', connected: 0 });
  });

  it('sirve la página del alumno en / y en /r/CÓDIGO', () => {
    const { room, code } = openRoom();
    for (const path of ['/', `/r/${code}`]) {
      const r = room.handle({ method: 'GET', path, query: '', body: '' });
      expect(r.status).toBe(200);
      expect(r.body).toContain('alumno');
    }
  });

  it('sin el código solo se ve el nombre de la sala', () => {
    const { room } = openRoom();
    expect(JSON.parse(room.handle({ method: 'GET', path: '/api/room', query: '', body: '' }).body)).toEqual({ label: '3º ESO A' });
    expect(room.handle({ method: 'GET', path: '/api/state', query: 'c=XXXXXX', body: '' }).status).toBe(403);
  });

  it('con el código: actividad, lista y respuestas (el código vale en minúsculas)', () => {
    const { room, code } = openRoom();
    const st = JSON.parse(room.handle({ method: 'GET', path: '/api/state', query: `c=${code.toLowerCase()}`, body: '' }).body);
    expect(st.activity.id).toBe('a1');
    expect(st.roster).toEqual(roster);

    const r = room.handle({ method: 'POST', path: '/api/submit', query: `c=${code}`, body: JSON.stringify({ n: 2, name: 'Luis', data: { choice: 1 } }) });
    expect(r.status).toBe(200);
    expect(r.changed).toBe(true);
    expect(room.snapshot().responses).toMatchObject([{ n: 2, activityId: 'a1', data: { choice: 1 } }]);
    // La última respuesta sustituye a la anterior
    room.handle({ method: 'POST', path: '/api/submit', query: `c=${code}`, body: JSON.stringify({ n: 2, data: { choice: 0 } }) });
    expect(room.snapshot().connected).toBe(1);
    expect(room.snapshot().responses[0].data).toEqual({ choice: 0 });
  });

  it('en lluvia de ideas se acumulan las aportaciones', () => {
    const { room, code } = openRoom();
    room.setActivity({ id: 'b1', type: 'brainstorm', title: 'Ideas' });
    const send = (ideas: string[]) => room.handle({ method: 'POST', path: '/api/submit', query: `c=${code}`, body: JSON.stringify({ n: 1, data: { ideas } }) });
    send(['agua']); send(['sol', 'luz']);
    expect(room.snapshot().responses[0].data).toEqual({ ideas: ['agua', 'sol', 'luz'] });
  });

  it('cambiar de actividad limpia las respuestas; cerrar deja de contestar', () => {
    const { room, code } = openRoom();
    room.handle({ method: 'POST', path: '/api/submit', query: `c=${code}`, body: '{"n":1,"data":{"choice":0}}' });
    room.setActivity({ ...activity, id: 'a2' });
    expect(room.snapshot().connected).toBe(0);
    room.close();
    expect(room.handle({ method: 'GET', path: '/', query: '', body: '' }).status).toBe(503);
    expect(room.snapshot().addresses).toEqual([]);
  });

  it('un envío que no es JSON se rechaza sin romper nada', () => {
    const { room, code } = openRoom();
    expect(room.handle({ method: 'POST', path: '/api/submit', query: `c=${code}`, body: '{roto' }).status).toBe(400);
  });

  it('la wifi de casa o del centro va antes que otras redes', () => {
    expect(sortAddresses([{ iface: 'x', ip: '10.0.0.5' }, { iface: 'wlan0', ip: '192.168.1.4' }]).map(a => a.ip)).toEqual(['192.168.1.4', '10.0.0.5']);
  });
});
