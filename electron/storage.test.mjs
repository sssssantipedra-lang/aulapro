import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import storageModule from './storage.cjs';

const { Storage } = storageModule;

describe('guardado en disco', () => {
  let dir;
  let storage;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aulapro-storage-'));
    storage = new Storage(dir);
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('borrar un perfil deja intactos los demás', async () => {
    const a = await storage.createProfile({ name: 'Profesor' });
    const b = await storage.createProfile({ name: 'Profesor' });
    await storage.saveData(b.id, { clases: [1] });
    await storage.deleteProfile(a.id);
    expect(await storage.loadData(b.id)).toEqual({ clases: [1] });
  });

  it('un identificador vacío o que se queda en nada no borra la carpeta de todos los perfiles', async () => {
    const p = await storage.createProfile({ name: 'Profesor' });
    await storage.saveData(p.id, { clases: [1] });
    for (const id of ['', '../', '..', '/', undefined]) {
      await storage.deleteProfile(id).catch(() => {});
    }
    expect(await storage.loadData(p.id)).toEqual({ clases: [1] });
  });

  it('una ruta con «..» no sale de la carpeta del perfil', async () => {
    const p = await storage.createProfile({ name: 'Profesor' });
    expect(storage.profileDir(`../../${p.id}`)).toBe(storage.profileDir(p.id));
  });
});
