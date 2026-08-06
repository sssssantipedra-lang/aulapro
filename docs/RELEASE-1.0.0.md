# Aula Pro 1.0.0

Primera versión pública. Gestión de aula para docentes: cuaderno de notas,
evaluación por rúbricas y dianas, asistencia, informes competenciales, actas y
actividades en directo con los móviles de los alumnos.

**Todo funciona en tu ordenador.** No hay que crear ninguna cuenta, no necesita
internet para funcionar y los datos de tus alumnos no salen de tu equipo.

---

## Qué descargar

| | **Instalador** | **Portable** |
|---|---|---|
| Archivo | `AulaPro-1.0.0-instalador.exe` | `AulaPro-1.0.0-portable.exe` |
| Qué hace | Se instala y crea acceso directo | Se ejecuta sin instalar nada |
| ¿Pide permisos de administrador? | **No** | **No** |
| Para quién | Tu ordenador de casa o del centro | Equipos muy restringidos, o para llevarlo en un pendrive |

Si dudas, coge el **instalador**. Se instala en tu carpeta de usuario, así que
funciona igual en los ordenadores bloqueados de un centro.

> **Windows dirá «Windows protegió su PC».** Es normal: el programa no lleva
> certificado de firma digital, que es un trámite de pago. Pulsa
> **Más información → Ejecutar de todas formas**. Solo hace falta la primera vez.
> Lo tienes explicado con detalle en [docs/INSTALACION.md](docs/INSTALACION.md),
> incluido cómo comprobar el archivo en VirusTotal si prefieres asegurarte.

---

## Qué trae

**Cuaderno de notas**
Categorías con su peso, media ponderada y columnas agrupadas por categoría.
Exportación a CSV que Excel en español abre en columnas sin tocar nada.

**Una clase, varias asignaturas**
Un maestro que da cinco asignaturas a 5ºA no tiene que crear cinco clases. Se
pone la lista de asignaturas en el grupo y se elige cuál se evalúa en cada
momento. Los pesos suman 100 % por asignatura.

**Rúbricas y dianas**
Con niveles de logro configurables: pon los que quieras y llámalos como
quieras. La nota se calcula sobre el nivel más alto que hayas definido. Al
evaluar, la nota entra sola en el cuaderno.

**Actas de calificaciones**
Documento formal en A4 horizontal con la escala oficial (IN/SU/BI/NT/SB), listo
para guardar en PDF directamente, sin pasar por el diálogo de impresora.

**Asistencia** con cuatro estados y porcentajes.

**Informes competenciales** redactados con IA a partir de datos reales,
centrados en las competencias clave LOMLOE. Si un alumno no tiene datos, se
niega a inventar. Necesita tu propia clave gratuita de Google, que se guarda
solo en tu equipo.

**Sala de alumnos**
La aplicación abre una sala en tu propio ordenador y los alumnos entran desde
el navegador del móvil escaneando un QR. Sin instalar nada y sin publicar
ninguna web. Requiere estar todos en la misma wifi.

**Trabajo compartido entre docentes**
Sincronización directa entre dos equipos por WebRTC, sin servidor. Cada lista
de alumnos tiene un dueño, así que un compañero no puede sobrescribir la tuya.

**Registro de cambios**
Quién cambió qué, cuándo y cuál era el valor anterior.

---

## Tus datos

Se guardan en tu equipo, en `%APPDATA%\Aula Pro\AulaPro\`, con una carpeta por
perfil de docente y copias de seguridad automáticas cada 10 minutos.

**Al desinstalar no se borran.** Es deliberado: nadie debería perder las notas
de un trimestre por desinstalar un programa.

---

## Requisitos

Windows 10 u 11 de 64 bits y unos 300 MB libres. Para la Sala de alumnos, que
tu ordenador y los móviles estén en la misma wifi; la primera vez Windows
pedirá permiso en el cortafuegos y hay que aceptarlo.
