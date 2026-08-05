/**
 * Guardado en disco, con una carpeta por perfil de docente.
 *
 * Estructura dentro de la carpeta de datos de la aplicación:
 *
 *   AulaPro/
 *     perfiles.json            índice de docentes
 *     perfiles/
 *       <id>/
 *         datos.json           todo el trabajo del perfil
 *         copias/              copias de seguridad con fecha
 *
 * Se guarda el archivo entero en cada escritura (son unos pocos cientos de KB
 * como mucho) y siempre pasando por un archivo temporal, para que un corte de
 * luz a mitad no deje el fichero a medias.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const MAX_BACKUPS = 12;

class Storage {
  constructor(rootDir) {
    this.root = path.join(rootDir, 'AulaPro');
    this.profilesFile = path.join(this.root, 'perfiles.json');
    this.profilesDir = path.join(this.root, 'perfiles');
  }

  async ensure() {
    await fsp.mkdir(this.profilesDir, { recursive: true });
  }

  profileDir(id) {
    return path.join(this.profilesDir, String(id).replace(/[^a-zA-Z0-9_-]/g, ''));
  }

  dataFile(id)    { return path.join(this.profileDir(id), 'datos.json'); }
  backupsDir(id)  { return path.join(this.profileDir(id), 'copias'); }

  /** Escritura segura: primero a un temporal y luego se sustituye. */
  async writeJson(file, value) {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(value, null, 1), 'utf8');
    await fsp.rename(tmp, file);
  }

  async readJson(file, fallback) {
    try {
      return JSON.parse(await fsp.readFile(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  /* ── Perfiles ── */

  async listProfiles() {
    await this.ensure();
    const list = await this.readJson(this.profilesFile, []);
    return Array.isArray(list) ? list : [];
  }

  async saveProfiles(list) {
    await this.writeJson(this.profilesFile, list);
    return list;
  }

  async createProfile({ name, school, subject, course }) {
    const list = await this.listProfiles();
    const profile = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(name || 'Docente').slice(0, 80),
      school: String(school || '').slice(0, 120),
      subject: String(subject || '').slice(0, 120),
      course: String(course || '').slice(0, 20),
      createdAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };
    list.push(profile);
    await this.saveProfiles(list);
    await this.writeJson(this.dataFile(profile.id), {});
    return profile;
  }

  async updateProfile(id, patch) {
    const list = await this.listProfiles();
    const idx = list.findIndex(p => p.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], ...patch, id };
    await this.saveProfiles(list);
    return list[idx];
  }

  async touchProfile(id) {
    return this.updateProfile(id, { lastOpenedAt: new Date().toISOString() });
  }

  async deleteProfile(id) {
    const list = await this.listProfiles();
    await this.saveProfiles(list.filter(p => p.id !== id));
    try {
      await fsp.rm(this.profileDir(id), { recursive: true, force: true });
    } catch { /* la carpeta ya no estaba */ }
    return true;
  }

  /* ── Datos ── */

  async loadData(id) {
    return this.readJson(this.dataFile(id), {});
  }

  async saveData(id, data) {
    await this.writeJson(this.dataFile(id), data);
    return true;
  }

  /* ── Copias de seguridad ── */

  async backup(id) {
    const data = await this.loadData(id);
    if (!data || Object.keys(data).length === 0) return null;

    const dir = this.backupsDir(id);
    await fsp.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(dir, `copia-${stamp}.json`);
    await this.writeJson(file, data);

    // Solo se conservan las más recientes
    const files = (await fsp.readdir(dir)).filter(f => f.startsWith('copia-')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - MAX_BACKUPS))) {
      await fsp.rm(path.join(dir, old), { force: true });
    }
    return file;
  }

  async listBackups(id) {
    const dir = this.backupsDir(id);
    try {
      const files = (await fsp.readdir(dir)).filter(f => f.startsWith('copia-'));
      const out = [];
      for (const f of files) {
        const st = await fsp.stat(path.join(dir, f));
        out.push({ file: f, size: st.size, at: st.mtime.toISOString() });
      }
      return out.sort((a, b) => b.at.localeCompare(a.at));
    } catch {
      return [];
    }
  }

  async restoreBackup(id, file) {
    const safe = path.basename(String(file));
    const data = await this.readJson(path.join(this.backupsDir(id), safe), null);
    if (!data) return false;
    await this.saveData(id, data);
    return true;
  }

  async clearBackups(id) {
    try {
      await fsp.rm(this.backupsDir(id), { recursive: true, force: true });
    } catch { /* ya no existía */ }
    return true;
  }

  /* ── Información de la carpeta ── */

  async folderInfo(id) {
    const dir = this.profileDir(id);
    let bytes = 0;
    const walk = async d => {
      let entries;
      try { entries = await fsp.readdir(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) await walk(full);
        else {
          try { bytes += (await fsp.stat(full)).size; } catch { /* archivo volátil */ }
        }
      }
    };
    await walk(dir);
    return { path: dir, bytes, backups: await this.listBackups(id) };
  }
}

module.exports = { Storage, MAX_BACKUPS };
