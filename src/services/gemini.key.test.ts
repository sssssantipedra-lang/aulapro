/**
 * En escritorio la clave se guarda cifrada por el sistema. La que dejaron las
 * versiones anteriores en claro (localStorage) se migra sola y se borra.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initApiKey, getApiKey, setApiKey } from './gemini';

let local: Map<string, string>;
let cifrado: Map<string, string>;
let cifradoDisponible: boolean;

beforeEach(() => {
  local = new Map();
  cifrado = new Map();
  cifradoDisponible = true;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k),
  });
  vi.stubGlobal('window', {
    electronAPI: {
      secrets: {
        get: async (n: string) => cifrado.get(n) ?? '',
        set: async (n: string, v: string) => {
          if (!cifradoDisponible) return false;
          if (v) cifrado.set(n, v); else cifrado.delete(n);
          return true;
        },
      },
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

const flush = () => new Promise(r => setTimeout(r, 0));

describe('clave de la IA en escritorio', () => {
  it('migra la clave en claro al almacén cifrado y borra la copia en claro', async () => {
    local.set('aulapro_gemini_key', 'AIzaAntigua');
    await initApiKey();
    expect(getApiKey()).toBe('AIzaAntigua');
    expect(cifrado.get('gemini')).toBe('AIzaAntigua');
    expect(local.has('aulapro_gemini_key')).toBe(false);
  });

  it('una clave nueva se guarda cifrada, nunca en claro', async () => {
    await initApiKey();
    setApiKey('  AIzaNueva  ');
    await flush();
    expect(getApiKey()).toBe('AIzaNueva');
    expect(cifrado.get('gemini')).toBe('AIzaNueva');
    expect(local.has('aulapro_gemini_key')).toBe(false);
  });

  it('si el sistema no puede cifrar, sigue funcionando como antes', async () => {
    cifradoDisponible = false;
    await initApiKey();
    setApiKey('AIzaSinCifrado');
    await flush();
    expect(getApiKey()).toBe('AIzaSinCifrado');
    expect(local.get('aulapro_gemini_key')).toBe('AIzaSinCifrado');
  });

  it('borrar la clave la quita de todas partes', async () => {
    cifrado.set('gemini', 'AIzaX');
    await initApiKey();
    setApiKey('');
    await flush();
    expect(getApiKey()).toBe('');
    expect(cifrado.has('gemini')).toBe(false);
  });
});
