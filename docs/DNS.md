# DNS de aulapro.app

Copia de los registros del dominio, leída del panel de Cloudflare el 18-10-2026. Sirve para reconstruir el DNS si se pierde la cuenta, si alguien lo cambia por error o si hay que mover el dominio. Todo esto es información pública (cualquiera puede consultarla con `nslookup`): no hay contraseñas ni claves.

- Registro del dominio: Cloudflare Registrar, cuenta del dueño. Activo, caduca el **30-9-2027**; renovación automática programada para el 31-8-2027 (14,20 $ al año). Hace falta una tarjeta válida en Cloudflare en esa fecha.
- DNS: el de Cloudflare («Full»). Servidores de nombres de Cloudflare.
- Cuenta de Cloudflare (id): `15cc637555cb2850a712cd9cf9dd60cf`.

## Registros (9 de 200)

| Nombre | Tipo | Contenido | Proxy | Para qué |
|---|---|---|---|---|
| `aulapro.app` | CNAME | `aulapro-app.pages.dev` | sí (naranja) | La web (Cloudflare Pages, proyecto `aulapro-app`) |
| `www.aulapro.app` | CNAME | `aulapro-app.pages.dev` | sí | La web con `www` |
| `descargas.aulapro.app` | R2 | bucket `aulapro-descargas` | sí | Instaladores y `version.json` (docs/DESCARGAS.md) |
| `aulapro.app` | MX | `route1.mx.cloudflare.net` (prioridad 47) | no | Correo entrante: Cloudflare Email Routing (`contacto@aulapro.app`) |
| `aulapro.app` | MX | `route2.mx.cloudflare.net` (93) | no | idem |
| `aulapro.app` | MX | `route3.mx.cloudflare.net` (92) | no | idem |
| `aulapro.app` | TXT | `v=spf1 include:_spf.mx.cloudflare.net ~all` | no | SPF del correo |
| `cf2024-1._domainkey.aulapro.app` | TXT | `v=DKIM1; h=sha256; k=rsa; p=…` (clave pública larga, la crea Cloudflare con Email Routing) | no | DKIM del correo |
| `aulapro.app` | TXT | `google-site-verification=En5JugPI1RFbxLClbqu27oMpK9TBlc5gXc8YBrRudUg` | no | Verificación de Google Search Console. **No borrar.** |

El registro DKIM y los MX los gestiona Cloudflare al activar Email Routing: si faltan, se vuelven a crear desde Email, Email Routing, Settings.

## Cómo cambiar de copia de la web

Está en `docs/WEB.md`, apartado 4c (GitHub Pages y vuelta a Cloudflare Pages). Solo cambian los registros `aulapro.app` y `www`; el correo, la verificación de Google y `descargas` no se tocan.

## Pendiente

- DMARC: Cloudflare recomienda un registro `_dmarc` (TXT) para que nadie pueda enviar correos haciéndose pasar por `@aulapro.app`. Empezar con `v=DMARC1; p=none; rua=mailto:<dirección de informes>`. Antes de pasar a `quarantine` o `reject`, comprobar desde dónde se envía correo como `@aulapro.app` (por ejemplo, «Enviar como» desde Gmail), porque si ese envío no pasa por el SPF y la firma del dominio, se marcaría como falso.
