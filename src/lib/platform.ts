/** La app de Android (Capacitor), para lo poco que cambia en la interfaz. Ver platform/android.ts. */
export const isAndroidApp = () => typeof window !== 'undefined' && window.electronAPI?.platform === 'android';
