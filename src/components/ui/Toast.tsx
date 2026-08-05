import { useRef, useState, createContext, useContext, useCallback, type ReactNode } from 'react';

interface ToastCtx {
  toast: (msg: string) => void;
}
const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setShow(false), 3000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className={`toast${show ? ' show' : ''}`}>{msg}</div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
