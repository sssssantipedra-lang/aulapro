/**
 * Dónde se guarda lo que genera la app en el ordenador (Windows y Mac), como
 * en Android (`src/lib/carpetas.ts`): Documentos › AulaPro › una carpeta por
 * tipo de documento. Es la carpeta que se propone al guardar y la que abre el
 * botón «Documentos descargados»; el docente puede elegir otra en el diálogo.
 */
const path = require('path');

const RAIZ = 'AulaPro';

/** El nombre de una carpeta sin lo que Windows no admite en una ruta; vacío o raro, «Otros». */
function nombreDeCarpeta(carpeta) {
  const sinRaros = [...String(carpeta ?? '')].map(c => (c.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(c) ? ' ' : c)).join('');
  const limpio = sinRaros.replace(/\s+/g, ' ').replace(/^[.\s]+/, '').slice(0, 60).trim();
  return limpio || 'Otros';
}

/** Documentos › AulaPro, o con `carpeta`, Documentos › AulaPro › carpeta. */
function carpetaDeAulaPro(documentos, carpeta) {
  const raiz = path.join(documentos, RAIZ);
  return carpeta === undefined || carpeta === '' ? raiz : path.join(raiz, nombreDeCarpeta(carpeta));
}

/** Un nombre de archivo sin lo que Windows no admite. */
function nombreDeArchivo(nombre) {
  return String(nombre ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'documento';
}

module.exports = { RAIZ, nombreDeCarpeta, carpetaDeAulaPro, nombreDeArchivo };
