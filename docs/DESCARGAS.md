# Descargas y actualizaciones: descargas.aulapro.app

El código de Aula Pro está en un repositorio privado. Los instaladores y la
actualización automática de Windows se sirven desde **Cloudflare R2** (el
almacén de archivos de Cloudflare) con el dominio `descargas.aulapro.app`.
Cloudflare Pages no sirve: no admite archivos de más de 25 MB y los
instaladores pesan entre 100 y 220 MB.

`release.yml` compila cada versión, la publica en GitHub (archivo privado) y
en el último paso, `descargas`, la sube a R2.

## Qué hay en descargas.aulapro.app

| Archivo | Para qué |
|---|---|
| `latest.yml` | Lo lee la actualización automática de Windows |
| `AulaPro-<versión>-instalador-windows.exe` (+ `.blockmap`) | Instalador de esa versión |
| `AulaPro-instalador-windows.exe` | Siempre la última: para el botón de la web |
| `AulaPro-portable-windows.exe`, `AulaPro-mac.dmg`, `AulaPro-mac.zip`, `AulaPro-android.apk` | Igual, siempre la última |
| `version.json` | `{"version": "1.7.1", "fecha": "…"}` por si la web quiere enseñarla |

## Puesta en marcha (una sola vez)

1. Cloudflare → **R2** → activarlo (pide un método de pago aunque el uso
   gratuito —10 GB y descargas ilimitadas— sobra de largo).
2. **Create bucket**: `aulapro-descargas`.
3. En el bucket → **Settings** → **Custom Domains** → **Connect Domain** →
   `descargas.aulapro.app`.
4. R2 → **Manage R2 API Tokens** → **Create API Token** → permiso *Object
   Read & Write*, solo para ese bucket. Apuntar el *Access Key ID*, el
   *Secret Access Key* y el *Account ID*.
5. GitHub → repositorio `aulapro` → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**, cuatro veces:
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y
   `R2_BUCKET` (= `aulapro-descargas`).

Si faltan los secretos, el paso `descargas` falla con un aviso claro y la
versión se queda solo en GitHub; se arregla volviendo a lanzar ese paso.
