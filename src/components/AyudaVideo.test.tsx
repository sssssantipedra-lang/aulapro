// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AyudaVideo } from './AyudaVideo';
import { baseVideos, urlVideo } from '../lib/videosAyuda';
import { I18nProvider } from '../i18n/I18nProvider';

afterEach(cleanup);

const montar = () => render(<I18nProvider><AyudaVideo id="cuaderno-notas" /></I18nProvider>);

describe('AyudaVideo', () => {
  it('no pide el vídeo hasta que se abre la ventana', () => {
    montar();
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByRole('button', { name: /Ver el vídeo: El cuaderno de notas/ })).toBeTruthy();
  });

  it('al pulsar el «?» abre el vídeo desde aulapro.app, sin terceros', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Ver el vídeo/ }));
    const v = document.querySelector('video') as HTMLVideoElement;
    expect(v.getAttribute('src')).toBe('https://aulapro.app/assets/videos/cuaderno-notas.mp4');
    expect(v.getAttribute('poster')).toBe(urlVideo('cuaderno-notas', 'jpg'));
  });

  it('si el vídeo no carga, lo dice', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Ver el vídeo/ }));
    fireEvent.error(document.querySelector('video')!);
    expect(screen.getByText(/No se ha podido cargar el vídeo/)).toBeTruthy();
  });

  it('abierta desde un sitio de AulaPro pide los vídeos a ese mismo sitio; desde cualquier otro, a aulapro.app', () => {
    const o = (hostname: string, protocol = 'https:') => ({ protocol, hostname, origin: `${protocol}//${hostname}` });
    expect(baseVideos(o('prueba.aulapro-app.pages.dev'))).toBe('https://prueba.aulapro-app.pages.dev/assets/videos/');
    expect(baseVideos(o('aulapro-app.pages.dev'))).toBe('https://aulapro-app.pages.dev/assets/videos/');
    expect(baseVideos(o('aulapro.app'))).toBe('https://aulapro.app/assets/videos/');
    expect(baseVideos(o('aulapro.app.otro.com'))).toBe('https://aulapro.app/assets/videos/');
    expect(baseVideos(o('localhost', 'http:'))).toBe('https://aulapro.app/assets/videos/');
    expect(baseVideos(undefined)).toBe('https://aulapro.app/assets/videos/');
  });
});
