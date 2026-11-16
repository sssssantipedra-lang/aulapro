// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { ToastProvider } from './ToastProvider';
import { useToast } from './Toast';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function Avisa() {
  const { toast } = useToast();
  useEffect(() => { toast('Hola'); }, [toast]);
  return null;
}

describe('ToastProvider', () => {
  it('al desmontarse no deja el temporizador del aviso en marcha', () => {
    vi.useFakeTimers();
    const { unmount } = render(<ToastProvider><Avisa /></ToastProvider>);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
