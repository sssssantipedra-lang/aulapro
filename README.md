# Aula Pro

Copyright © 2026 Santiago Pedra. Todos los derechos reservados.
Uso gratuito para docentes; **no se permite redistribuir, vender ni modificar**
sin permiso escrito. Ver [LICENSE](LICENSE).

Gestión de aula para docentes: cuaderno de notas, evaluación por rúbricas y
dianas, asistencia, informes competenciales LOMLOE, actas y actividades en
directo con los móviles de los alumnos.

**Todo funciona en el ordenador del docente.** No hay cuentas, no hay servidor y
los datos de los alumnos no salen del equipo.

> ¿Solo quieres usarla? Ve a **[docs/INSTALACION.md](docs/INSTALACION.md)**.

---

## Qué hace

| Sección | Qué resuelve |
|---|---|
| **Cuaderno** | Categorías ponderadas, media ponderada, exportación CSV para Excel español |
| **Evaluación** | Rúbricas y dianas con niveles de logro y nota automática |
| **Asistencia** | Cuatro estados, porcentajes y exportación |
| **Informes** | Redactados por IA sobre las competencias clave LOMLOE, a partir de datos reales |
| **Actas** | Documento formal imprimible con la escala oficial (IN/SU/BI/NT/SB) |
| **Sala de alumnos** | La app abre un servidor local; los alumnos entran por wifi escaneando un QR |
| **Trabajo compartido** | Sincronización entre docentes por WebRTC, sin servidor |
| **Registro de cambios** | Quién cambió qué, cuándo y cuál era el valor anterior |

## Cómo está montado

- **Interfaz**: React 19 + TypeScript, empaquetada con Vite.
- **Escritorio**: Electron. El proceso principal (`electron/`) solo usa módulos
  nativos de Node, sin ninguna dependencia de terceros.
- **Datos**: una carpeta por perfil de docente en `userData`, con escritura
  atómica y copia de seguridad automática cada 10 minutos.
- **IA**: Google Gemini con la clave del propio docente, guardada en su equipo.

## Desarrollo

```bash
npm install
npm run dev          # interfaz en el navegador
npm run electron     # aplicación de escritorio
npm test             # tests de las funciones críticas
npm run build        # compila la interfaz
npm run dist         # genera el instalador y el portable de Windows
npm run dist:mac     # genera el .dmg y el .zip de Mac (solo funciona en macOS)
```

### Build de Mac

`electron-builder` no puede firmar ni empaquetar un `.dmg` real desde Windows,
así que la build de Mac se genera en un runner de macOS mediante el workflow
[`.github/workflows/build-mac.yml`](.github/workflows/build-mac.yml): en la
pestaña **Actions** de GitHub, «Build macOS» → **Run workflow**. Al terminar,
el `.dmg` y el `.zip` (build universal, Intel + Apple Silicon) quedan como
artefacto descargable de esa ejecución.

No hay cuenta de Apple Developer, así que la app sale **sin firmar**: la
primera vez que un docente la abra en su Mac, Gatekeeper bloqueará el doble
clic normal y hará falta clic derecho → «Abrir» → «Abrir» para confirmar que
se confía en ella. Es solo la primera vez.

### Si el empaquetado falla en Windows

Con `EPERM: operation not permitted, rename ... win-unpacked.tmp`: algún proceso
`node.exe` de un intento anterior sigue reteniendo la carpeta de salida. Se
resuelve generando en una carpeta limpia:

```bash
npx electron-builder --win --publish never "-c.directories.output=C:/Users/<usuario>/Downloads/AulaPro-instaladores"
```

## Decisiones que conviene no deshacer sin querer

Cada una viene de un fallo real que costó encontrar:

- **Fechas de día**: usar siempre `isoDate()` de `src/lib/utils.ts`, nunca
  `toISOString()`. En España el segundo devuelve el día anterior de madrugada.
  Para *instantes* (marcas de tiempo) `toISOString()` sí es correcto.
- **CSV**: siempre con BOM y `;`. Excel en español no abre en columnas un CSV
  separado por comas.
- **Puertos** (`electron/classroom.cjs`): se comprueba el puerto conectándose
  antes de ocuparlo. Windows permite enlazar un puerto ya ocupado sin devolver
  `EADDRINUSE`, así que confiar en ese error no funciona.
- **`GET /api/room`** es el único punto sin código de sala. Devuelve solo el
  nombre de la clase. No añadir ahí datos personales.
- **Repintado en `electron/student.html`**: solo se repinta si cambia algo
  visible. Repintar rehace el DOM y borraría lo que el alumno esté escribiendo.
- **Desinstalar no borra los datos** (`deleteAppDataOnUninstall: false`). Nadie
  debería perder un trimestre de notas por desinstalar un programa.
- **La escala de calificación** de las actas se calcula sobre la nota ya
  redondeada. Si no, un 4,95 se imprimiría como «5,0 — Insuficiente».

## Tests

```bash
npm test
```

Cubren lo que puede provocar pérdida de datos: la fusión entre docentes
(`src/services/sync.test.ts`, incluidas las lápidas que impiden que un borrado
resucite) y el registro de cambios (`src/services/audit.test.ts`, con la trampa
de la zona horaria española).
