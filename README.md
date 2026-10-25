# Aula Pro

Copyright © 2026 Santiago Pedra. Todos los derechos reservados.
Programa de pago, con una licencia por docente; **no se permite redistribuir,
vender ni modificar** sin permiso escrito. Ver [LICENSE](LICENSE).

App para docentes de Educación Primaria y Secundaria (currículo LOMLOE) para
Windows (Electron) y Android (Capacitor); Mac queda para más adelante. Prepara
con IA situaciones de aprendizaje, rúbricas, dianas, informes y fichas, y reúne
el cuaderno, la asistencia y la evaluación en un solo sitio. La web es
https://aulapro.app.

**Los datos del alumnado se quedan en el dispositivo del docente.** No hay
cuentas ni servidor propio. Las funciones de IA envían a Google (API de Gemini,
con la clave del propio docente) lo necesario, con los nombres del alumnado
cambiados por códigos; el detalle de lo que sale de la app está en
[docs/TIENDAS.md](docs/TIENDAS.md) y en la política de privacidad de la web.

> ¿Solo quieres usarla? Ve a **[docs/INSTALACION.md](docs/INSTALACION.md)**.
> Memoria del proyecto y decisiones: **[CLAUDE.md](CLAUDE.md)**.

---

## Qué hace

| Sección | Qué resuelve |
|---|---|
| **Inicio, Mis clases, Agenda** | La jornada del día, las clases y el horario semanal |
| **Cuaderno** | Categorías ponderadas, peso de cada nota, media ponderada y exportación a Excel |
| **Evaluar** | Rúbricas, dianas y escalas de registro con nota automática; evaluar por foto; diana competencial |
| **Asistencia y Anotar actitud** | Estados y porcentajes; toda la clase en una lista |
| **Recursos con IA** | Situaciones de aprendizaje, fichas «Cuaderno» de menos a más, comprensión lectora, escape rooms y tarjetas |
| **Informes y Actas** | Informes de competencias clave con tabla de competencias; actas con la escala IN/SU/BI/NT/SB y evaluación por competencias |
| **PT y AL, Educación Física** | Los perfiles de apoyo y de EF (`docs/PTAL.md`, `docs/EF.md`) |
| **Pizarra y herramientas** | Pizarra, temporizador, ruleta, grupos y más (`docs/PIZARRA.md`) |
| **Actividades con móviles** | La app abre un servidor local; el alumnado entra por la wifi del aula escaneando un QR |
| **Trabajo compartido** | Pasar clases y notas a otro docente en un archivo cifrado con contraseña (`docs/COMPARTIR.md`) |
| **Registro de cambios** | Cuándo se cambió qué y cuál era el valor anterior |

## Cómo está montado

- **Interfaz**: React 19 + TypeScript, empaquetada con Vite (`src/`).
- **Escritorio**: Electron (`electron/`). El proceso principal usa casi solo
  módulos nativos de Node; las excepciones son `electron-updater` (solo en el
  instalador de Windows) y lo que trae Electron.
- **Android**: Capacitor (`android/`), con un plugin nativo propio
  (`AulaNativePlugin`).
- **Web**: `web/sitio/`, HTML, CSS y JavaScript sin compilar.
- **Datos**: una carpeta por perfil de docente, con escritura atómica y copia de
  seguridad automática cada 10 minutos.
- **IA**: Google Gemini con la clave del propio docente, guardada cifrada en su
  equipo. Los nombres se enmascaran en un único punto (`src/services/privacy.ts`).
- **Venta**: Lemon Squeezy, en la web; las tiendas llevan la app gratuita, que se
  activa con la clave (`docs/WEB.md`, `docs/TIENDAS.md`).

## Desarrollo

```bash
npm install
npm run dev          # interfaz en el navegador
npm run electron     # aplicación de escritorio
npm test             # tests de las funciones críticas
npm run build        # compila la interfaz
npm run lint         # eslint
npm run android      # compila la web y la copia al proyecto de Android
npm run dist         # genera el instalador, el portable y el .appx de Windows
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
resucite), el registro de cambios (`src/services/audit.test.ts`, con la trampa
de la zona horaria española) y el resto de la app. No hay todavía una prueba de
extremo a extremo del archivo cifrado en un móvil real (`docs/COMPARTIR.md`).
