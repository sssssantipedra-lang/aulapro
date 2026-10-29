// Antes de publicar, la portada en català e inglés pasa a ser una página de verdad: ca.html y en.html
// (Cloudflare las sirve en https://aulapro.app/ca y /en), con el texto ya traducido en el HTML, su
// título, su descripción y su dirección. Así Google indexa cada idioma por separado y cada docente
// llega a su versión. Los textos salen de index.html (castellano) y de assets/i18n.js (català e inglés):
// se escribe solo en esos dos archivos y estas páginas se generan; el repositorio no las guarda.
//   node web/idiomas.mjs web/sitio
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const root = process.argv[2] || 'web/sitio';
const SITE = 'https://aulapro.app/';
const LANGS = { ca: 'ca_ES', en: 'en_GB' };

const html = readFileSync(join(root, 'index.html'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'assets/i18n.js'), 'utf8'), ctx);
const DICT = ctx.window.AULA_I18N;

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// The content of the element that carries data-i18n="key", up to its own closing tag (nested tags of the
// same name included).
function translateTexts(src, dict, missing) {
  const re = /\sdata-i18n="([^"]+)"/g;
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    const key = m[1];
    const open = src.lastIndexOf('<', m.index);
    const name = /^<([a-zA-Z][\w-]*)/.exec(src.slice(open))[1].toLowerCase();
    const startEnd = src.indexOf('>', m.index) + 1;
    if (VOID.has(name)) continue;
    let depth = 1, i = startEnd;
    const tag = new RegExp(`<(/?)${name}(?=[\\s>/])`, 'gi');
    tag.lastIndex = startEnd;
    let t;
    while ((t = tag.exec(src))) {
      depth += t[1] ? -1 : 1;
      if (!depth) { i = t.index; break; }
    }
    if (depth) throw new Error(`sin cierre para ${key}`);
    if (!(key in dict)) { missing.push(key); continue; }
    out += src.slice(last, startEnd) + dict[key];
    last = i;
    re.lastIndex = i;
  }
  return out + src.slice(last);
}

// data-i18n-attr="placeholder:key;aria-label:key2"
function translateAttrs(src, dict, missing) {
  return src.replace(/<[a-zA-Z][^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, (tag, spec) => {
    for (const pair of spec.split(';')) {
      const [attr, key] = pair.split(':');
      if (!(key in dict)) { missing.push(key); continue; }
      const val = esc(dict[key]);
      const re = new RegExp(`(\\s${attr}=")[^"]*(")`);
      tag = re.test(tag) ? tag.replace(re, `$1${val}$2`) : tag.replace(/\s*\/?>$/, m => ` ${attr}="${val}"${m}`);
    }
    return tag;
  });
}

function setMeta(src, re, value, what) {
  if (!re.test(src)) throw new Error(`no encuentro ${what}`);
  return src.replace(re, (m, a, b) => a + value + b);
}

for (const [lang, locale] of Object.entries(LANGS)) {
  const d = DICT[lang], missing = [];
  const url = SITE + lang;
  let out = translateAttrs(translateTexts(html, d, missing), d, missing);
  out = setMeta(out, /(<html lang=")es(">)/, lang, 'html lang');
  // the checklist counter, which JavaScript keeps up to date (the checklist left the homepage on 29-10-2026)
  if (out.includes('id="count"')) out = setMeta(out, /(<span id="count" aria-live="polite">)[^<]*(<\/span>)/, d['s2.count'].replace('{n}', '0'), 'count');
  out = setMeta(out, /(<title>)[^<]*(<\/title>)/, esc(d['meta.title']), 'title');
  out = setMeta(out, /(<meta name="description" content=")[^"]*(">)/, esc(d['meta.desc']), 'description');
  out = setMeta(out, /(<meta property="og:title" content=")[^"]*(">)/, esc(d['meta.title']), 'og:title');
  out = setMeta(out, /(<meta property="og:description" content=")[^"]*(">)/, esc(d['meta.desc']), 'og:description');
  out = setMeta(out, /(<meta property="og:locale" content=")[^"]*(">)/, locale, 'og:locale');
  out = setMeta(out, /(<meta property="og:url" content=")[^"]*(">)/, url, 'og:url');
  out = setMeta(out, /(<link rel="canonical" href=")[^"]*(">)/, url, 'canonical');
  // the castellano page sends a visitor who chose another language to it; this one is that language
  out = out.replace(/<script id="lang-go">[\s\S]*?<\/script>\n?/, '');
  // the app's card for Google: same app, this page's address and description
  out = out.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (m, a, json, b) => {
    const data = JSON.parse(json);
    data.url = url;
    data.description = d['meta.desc'];
    data.offers.url = url + '#precio';
    return a + '\n' + JSON.stringify(data, null, 2) + '\n' + b;
  });
  if (missing.length) console.log(`${lang}: sin traducir, se queda en castellano: ${[...new Set(missing)].join(', ')}`);
  writeFileSync(join(root, `${lang}.html`), out);
  console.log(`${lang}.html: ${url}`);
}
