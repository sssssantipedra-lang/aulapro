import { createContext, useContext } from 'react';

export interface ToastCtx {
  toast: (msg: string) => void;
}

export const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}
