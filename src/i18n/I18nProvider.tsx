import { useEffect, useMemo, useState } from 'react';
import { I18nContext, LOCALES, STORAGE_KEY, translate, type Ctx, type Lang } from './core';

/**
 * Proveedor del idioma. Vive aparte del diccionario (`core.ts`) para que este
 * archivo solo exporte un componente: así la recarga en caliente de Vite
 * funciona al editar cualquiera de los dos.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' ? 'en' : 'es';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    // El aviso de actualización lo escribe el proceso de Electron, que no ve
    // este diccionario: hay que decirle en qué idioma está la aplicación.
    window.electronAPI?.update?.setLanguage?.(lang);
  }, [lang]);

  const value = useMemo<Ctx>(() => ({
    lang,
    setLang: setLangState,
    t: (key, vars) => translate(lang, key, vars),
    locale: LOCALES[lang],
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

