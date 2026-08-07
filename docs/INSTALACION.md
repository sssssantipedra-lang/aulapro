# Instalar Aula Pro

Aula Pro funciona **entero en tu ordenador**. No hay que crear ninguna cuenta, no
necesita internet para funcionar y tus datos no salen de tu equipo.

---

## Cuál de los dos archivos descargo (Windows)

| | **Instalador** | **Portable** |
|---|---|---|
| Archivo | `AulaPro-1.0.2-instalador.exe` | `AulaPro-1.0.2-portable.exe` |
| Qué hace | Se instala y crea acceso directo | Se ejecuta sin instalar nada |
| ¿Pide permisos de administrador? | **No** | **No** |
| Para quién | Tu ordenador de casa o del centro | Ordenadores muy restringidos, o para llevarlo en un pendrive |

Si dudas, coge el **instalador**. Se instala en tu carpeta de usuario, así que no
necesita que nadie te dé permisos de administrador: funciona igual en los
ordenadores bloqueados de un centro.

## En Mac

Descarga `AulaPro-1.0.2-mac.dmg`, ábrelo y arrastra el icono de Aula Pro a la
carpeta **Aplicaciones**. Es una build **universal**: funciona igual en Mac con
chip Intel o Apple Silicon (M1/M2/M3…), no hay que elegir versión.

---

## Windows dice «Windows protegió su PC». ¿Qué hago?

Te va a salir una pantalla azul como esta:

> **Windows protegió su PC**
> Microsoft Defender SmartScreen impidió el inicio de una aplicación no reconocida.

**Es normal y no significa que el archivo tenga un virus.**

Windows muestra ese aviso a **todo** programa que no venga con un certificado de
firma digital, que es un trámite de pago que renuevan las empresas cada año. Aula
Pro es un proyecto pequeño y no lo tiene. El aviso dice literalmente «aplicación
no reconocida», no «aplicación peligrosa»: Windows no está diciendo que sea
dañina, está diciendo que no la ha visto antes.

### Para continuar

1. Pulsa en **Más información** (el enlace pequeño, debajo del texto).
2. Aparecerá un botón nuevo: **Ejecutar de todas formas**.
3. Púlsalo y sigue con la instalación normal.

Solo hay que hacerlo **la primera vez**. Conforme más gente descargue cada
versión, Windows deja de mostrar el aviso por sí solo.

### Si quieres comprobarlo antes

Es una desconfianza sana, y se puede resolver. Sube el archivo descargado a
[VirusTotal](https://www.virustotal.com/gui/home/upload): analiza el archivo con
unos setenta antivirus distintos a la vez y te da el resultado en un minuto.

---

## En Mac dice que no se puede abrir «porque es de un desarrollador no identificado». ¿Qué hago?

Es el equivalente en Mac del aviso de Windows de arriba: significa que la app no
lleva la firma digital de pago de Apple, no que tenga nada malo. Se resuelve
así, **solo la primera vez**:

1. En **Finder**, haz **clic derecho (o Ctrl+clic)** sobre Aula Pro, en vez de
   doble clic.
2. Elige **Abrir** en el menú.
3. Saldrá el mismo aviso, pero esta vez con un botón **Abrir** — púlsalo.

Las veces siguientes se abre con doble clic normal, como cualquier otra app.

---

## Dónde se guardan mis datos

En tu propio equipo, dentro de tu carpeta de usuario.

**Windows:**
```
C:\Users\<tu usuario>\AppData\Roaming\Aula Pro\AulaPro\
```

**Mac:**
```
~/Library/Application Support/Aula Pro/AulaPro/
```

Ahí dentro hay una carpeta por cada perfil de docente, con sus datos y sus copias
de seguridad automáticas. Puedes abrirla desde la propia aplicación, en
**Mi Perfil → Ver carpeta de datos**.

**Al desinstalar, esta carpeta NO se borra.** Es deliberado: nadie debería perder
las notas de un trimestre por desinstalar un programa. Si algún día quieres
borrarlas del todo, hazlo a mano desde esa ruta.

---

## Actualizar a una versión nueva

Descarga el instalador nuevo y ejecútalo encima del anterior. Tus datos se
conservan: viven en la carpeta de arriba, aparte del programa.

Antes de una actualización grande, si quieres dormir tranquilo, entra en
**Mi Perfil → Copia de seguridad → Descargar** y guarda ese archivo donde
quieras.

---

## Requisitos

**Windows:**
- Windows 10 o Windows 11, de 64 bits.
- Unos 300 MB de espacio libre.
- Para la **Sala de alumnos**: que tu ordenador y los móviles estén en la misma
  wifi. La primera vez que la abras, Windows pedirá permiso en el cortafuegos:
  hay que aceptarlo, o los móviles no podrán conectarse.

**Mac:**
- macOS reciente, Intel o Apple Silicon (build universal, no hay que elegir).
- Unos 300 MB de espacio libre.
- Para la **Sala de alumnos**: igual que en Windows, ordenador y móviles en la
  misma wifi. macOS también puede pedir permiso de red local la primera vez;
  hay que aceptarlo.
