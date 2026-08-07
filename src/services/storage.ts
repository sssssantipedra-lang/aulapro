/**
 * Guardado de datos, con una carpeta por perfil de docente.
 *
 * En la aplicación de escritorio los datos van a disco, dentro de la carpeta
 * de la aplicación. En el navegador se usa localStorage como respaldo, para
 * que la versión web siga siendo utilizable.
 */

export interface TeacherProfile {
  id: string;
  name: string;
  school: string;
  subject: string;
  /** Curso escolar, por ejemplo «2025-2026». */
  course: string;
  createdAt: string;
  lastOpenedAt: string;
  /**
   * Contraseña opcional del perfil (ver src/lib/password.ts). Sin ella, el
   * perfil se abre igual que siempre. Solo se guarda el hash, nunca la
   * contraseña en claro.
   */
  passwordSalt?: string;
  passwordHash?: string;
}

export interface BackupInfo {
  file: string;
  size: number;
  at: string;
}

export interface FolderInfo {
  path: string;
  bytes: number;
  backups: BackupInfo[];
}

export type ProfileData = Record<string, unknown>;

const ACTIVE_KEY = 'aulapro_active_profile';
const WEB_PROFILES_KEY = 'aulapro_web_profiles';
const WEB_DATA_PREFIX = 'aulapro_web_data_';

const bridge = () => (typeof window !== 'undefined' ? window.electronAPI?.store : undefined);

export const isDesktop = () => bridge() !== undefined;

/* ── Perfil activo (siempre local: es solo una preferencia de este equipo) ── */

export function getActiveProfileId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function setActiveProfileId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* almacenamiento no disponible */ }
}

/* ── Respaldo para navegador ── */

function webProfiles(): TeacherProfile[] {
  try {
    const raw = localStorage.getItem(WEB_PROFILES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveWebProfiles(list: TeacherProfile[]) {
  try { localStorage.setItem(WEB_PROFILES_KEY, JSON.stringify(list)); } catch { /* lleno */ }
}

/* ── API ── */

export async function listProfiles(): Promise<TeacherProfile[]> {
  const b = bridge();
  if (b) return (await b.listProfiles()) as TeacherProfile[];
  return webProfiles();
}

export async function createProfile(
  input: { name: string; school: string; subject: string; course: string },
): Promise<TeacherProfile> {
  const b = bridge();
  if (b) return (await b.createProfile(input)) as TeacherProfile;

  const profile: TeacherProfile = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: input.name, school: input.school, subject: input.subject, course: input.course,
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
  };
  saveWebProfiles([...webProfiles(), profile]);
  return profile;
}

export async function updateProfile(id: string, patch: Partial<TeacherProfile>): Promise<void> {
  const b = bridge();
  if (b) { await b.updateProfile(id, patch); return; }
  saveWebProfiles(webProfiles().map(p => (p.id === id ? { ...p, ...patch, id } : p)));
}

export async function touchProfile(id: string): Promise<void> {
  await updateProfile(id, { lastOpenedAt: new Date().toISOString() });
}

export async function deleteProfile(id: string): Promise<void> {
  const b = bridge();
  if (b) { await b.deleteProfile(id); return; }
  saveWebProfiles(webProfiles().filter(p => p.id !== id));
  try { localStorage.removeItem(WEB_DATA_PREFIX + id); } catch { /* noop */ }
}

export async function loadData(profileId: string): Promise<ProfileData> {
  const b = bridge();
  if (b) return (await b.loadData(profileId)) as ProfileData;
  try {
    const raw = localStorage.getItem(WEB_DATA_PREFIX + profileId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveData(profileId: string, data: ProfileData): Promise<void> {
  const b = bridge();
  if (b) { await b.saveData(profileId, data); return; }
  try { localStorage.setItem(WEB_DATA_PREFIX + profileId, JSON.stringify(data)); } catch { /* lleno */ }
}

export async function backup(profileId: string): Promise<string | null> {
  const b = bridge();
  if (!b) return null;
  return (await b.backup(profileId)) as string | null;
}

export async function listBackups(profileId: string): Promise<BackupInfo[]> {
  const b = bridge();
  if (!b) return [];
  return (await b.listBackups(profileId)) as BackupInfo[];
}

export async function restoreBackup(profileId: string, file: string): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  return (await b.restoreBackup(profileId, file)) as boolean;
}

export async function clearBackups(profileId: string): Promise<void> {
  const b = bridge();
  if (b) await b.clearBackups(profileId);
}

export async function folderInfo(profileId: string): Promise<FolderInfo | null> {
  const b = bridge();
  if (!b) return null;
  return (await b.folderInfo(profileId)) as FolderInfo;
}

export async function openFolder(profileId: string): Promise<void> {
  const b = bridge();
  if (b) await b.openFolder(profileId);
}

/** Tamaño legible para mostrar en pantalla. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
