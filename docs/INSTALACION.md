# Instalar Aula Pro

Aula Pro guarda los datos de tu alumnado **en tu propio equipo**. No hay que
crear ninguna cuenta. Se activa una vez con una **licencia** (la compras en
https://aulapro.app, la misma sirve para Windows y Android) y después funciona sin
conexión; solo las funciones de IA, el trabajo compartido y la comprobación
semanal de la licencia necesitan internet.

---

## Windows

Hay tres maneras de conseguirla. Todas valen la misma licencia.

| | **Microsoft Store** | **Instalador** | **Portable** |
|---|---|---|---|
| Dónde | Ficha de AulaPro en Microsoft Store | `AulaPro-<versión>-instalador-windows.exe`, en https://aulapro.app/descargar | `AulaPro-<versión>-portable-windows.exe`, igual |
| Qué hace | Se instala y se actualiza por la tienda | Se instala y crea acceso directo | Se ejecuta sin instalar nada |
| ¿Pide permisos de administrador? | No | **No** | **No** |
| Aviso «Windows protegió su PC» | No: la firma Microsoft | Sí, la primera vez (abajo) | Sí, la primera vez |
| Para quién | Lo más cómodo | Tu ordenador de casa o del centro | Equipos muy restringidos, o para llevarlo en un pendrive |

Si dudas, coge la **Microsoft Store**. Si el equipo del centro no la tiene, el
**instalador**: se instala en tu carpeta de usuario, así que no necesita que nadie
te dé permisos de administrador.

## Android

Descárgala gratis en **Google Play** (Android 7.0 o más reciente) y actívala con
tu licencia. Los documentos que guardas (PDF, Word, copias de seguridad) quedan
en **Documentos › AulaPro** de tu dispositivo, en una carpeta por tipo. La
primera vez que uses el medidor de ruido o el lector de QR, Android te pedirá el
permiso de micrófono o de cámara; solo se usan en ese momento.

## Activar la licencia

La primera vez, la app te pide la clave que recibiste por correo al comprar.
Pégala tal cual y pulsa **Activar**; hace falta internet solo ese momento. Puedes
activarla en hasta 2 dispositivos a la vez (con un pack para grupos, 2 por
docente). Para cambiar de dispositivo, desactívala en el antiguo desde
**Configuración › Licencia** y actívala en el nuevo.

## En Mac

Todavía no hay versión de Mac a la venta: la web la anuncia como «próximamente».

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

**Android:** dentro del almacenamiento privado de la app (no se puede abrir a mano).
Lo que guardas como documento va a Documentos › AulaPro.

Ahí dentro hay una carpeta por cada perfil de docente, con sus datos y sus copias
de seguridad automáticas. Puedes abrirla desde la propia aplicación, en
**Mi Perfil → Ver carpeta de datos**.

**Al desinstalar, esta carpeta NO se borra.** Es deliberado: nadie debería perder
las notas de un trimestre por desinstalar un programa. Si algún día quieres
borrarlas del todo, hazlo a mano desde esa ruta.

---

## Actualizar a una versión nueva

**Si la instalaste desde Microsoft Store o Google Play, las actualiza la propia tienda.**

**Con el instalador de Windows, la app se actualiza sola.** Al abrirla comprueba si hay una
versión más nueva y, si la hay, la descarga en segundo plano; cuando termina,
aparece un aviso abajo a la derecha con un botón para reiniciar e instalar.
Si lo cierras sin pulsarlo, se instala igualmente la próxima vez que cierres
la aplicación.

**Con el portable**, la actualización es manual: descarga el nuevo y sustituye al anterior.

**En Mac**, por ahora, sigue siendo manual: descarga el instalador nuevo y
ejecútalo encima del anterior.

En cualquier caso, tus datos se conservan siempre: viven en la carpeta de
arriba, aparte del programa. Antes de una actualización grande, si quieres
dormir tranquilo, entra en **Mi Perfil → Copia de seguridad → Descargar** y
guarda ese archivo donde quieras.

---

## Requisitos

**Windows:**
- Windows 10 o Windows 11, de 64 bits.
- Unos 300 MB de espacio libre.
- Para las **Actividades con móviles**: que tu ordenador y los móviles estén en la misma
  wifi. La primera vez que la abras, Windows pedirá permiso en el cortafuegos:
  hay que aceptarlo, o los móviles no podrán conectarse.

**Android:**
- Android 7.0 o más reciente.
- Para las **Actividades con móviles** y el **trabajo compartido por la wifi**: dispositivos en la misma red. Algunas wifis de centro aíslan los dispositivos entre sí y lo impiden; la zona wifi de un móvil lo sortea.

**Mac:**
- macOS reciente, Intel o Apple Silicon (build universal, no hay que elegir).
- Unos 300 MB de espacio libre.
- Para las **Actividades con móviles**: igual que en Windows, ordenador y móviles en la
  misma wifi. macOS también puede pedir permiso de red local la primera vez;
  hay que aceptarlo.
