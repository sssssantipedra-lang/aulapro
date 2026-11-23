"""
Genera las voces de los vídeos de ayuda en el propio equipo, gratis y sin enviar nada fuera.

    python3.11 -m venv .venv-voces && .venv-voces/bin/pip install chatterbox-tts faster-whisper soundfile
    .venv-voces/bin/python scripts/videos/voces.py <id> [<id>…]          # o «todos»
    .venv-voces/bin/python scripts/videos/voces.py --frase 3 <id>        # solo la escena 3 de ese vídeo

Lee las frases de `guiones/<id>.mjs` (con node) y deja `audio/<id>/01.mp3`, 02… (MP3 mono de 64 kbit/s, sin silencios en
los extremos), y borra los que sobren. Necesita node y ffmpeg. Cada frase dice en el registro cuánto ha tardado.

La voz (elegida por el dueño el 23-11-2026 entre ocho gratuitas) es Chatterbox multilingüe de Resemble AI (licencia MIT, uso
comercial permitido; https://huggingface.co/ResembleAI/chatterbox) en castellano, con su voz de serie y los ajustes de serie.
El modelo se descarga la primera vez en la caché de Hugging Face. Va lento sin tarjeta gráfica (un minuto por frase, más o
menos con la comprobación) y no es exacto: a veces se come o repite palabras, y a menudo, al acabar la frase, tras un
silencio corto suelta un «eh» o un «mm». Por eso cada frase se transcribe con Whisper, palabra a palabra y con sus tiempos:
- se corta en el primer silencio después de su última palabra (y antes de la primera), con un fundido corto: así no queda el
  «eh» del final (`limites`);
- se puntúa lo que se oye dentro de ese corte contra lo que tenía que decir, restando por cada palabra de más (un
  tartamudeo, un «eh» que Whisper escriba) y por cada sonido fuerte en una pausa de dentro de la frase (`puntuar`);
- si no llega a `PARECIDO`, se repite con otra semilla (hasta `INTENTOS` veces) y se queda la que mejor puntúe.
La semilla de cada frase sale de su texto, así que la misma frase sale igual cada vez.

Chatterbox lleva una marca de agua inaudible (Perth); aquí se usa sin ella porque su librería no funciona en este equipo.

Lo que se dice no es siempre lo que se lee en el subtítulo: `PRONUNCIA` cambia siglas y nombres extranjeros por cómo suenan.
Si una frase nueva lleva una sigla o una marca, se añade ahí y se escucha.

`--motor kokoro` usa la voz de antes (Kokoro 82M, Apache 2.0, «ef_dora»; `pip install kokoro-onnx`, y espeak-ng).
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.request

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
MODELOS = os.path.join(AQUI, '.modelos')
INTENTOS = 4
PARECIDO = 0.88   # lo que tiene que parecerse lo oído a lo escrito (0 a 1)

# Cómo suena lo que no es castellano corriente (palabra entera, distinguiendo mayúsculas). El orden importa: lo largo, antes.
PRONUNCIA = [
    (r'\bGet API key\b', 'guet, ei pi ai, qui'),
    (r'\bAI Studio\b', 'ei ai estudio'),
    (r'\bAulaPro\b', 'Aula Pro'),
    (r'\bIA\b', 'i a'),
    (r'\bPDF\b', 'pe de efe'),
    (r'\bCSV\b', 'ce ese uve'),
    (r'\bAPI\b', 'a pe i'),
    (r'\bOneDrive\b', 'uan draif'),
    (r'\bescape rooms?\b', 'escape rums'),
    (r'\bapp\b', 'ap'),
]


def para_decir(texto):
    t = texto.replace('«', '').replace('»', '').replace('“', '').replace('”', '')
    for patron, dicho in PRONUNCIA:
        t = re.sub(patron, dicho, t)
    return t


def frases(ident):
    js = 'import(process.argv[1]).then(m => process.stdout.write(JSON.stringify(m.default.escenas.map(e => e.texto))))'
    ruta = 'file://' + os.path.join(AQUI, 'guiones', ident + '.mjs')
    return json.loads(subprocess.run(['node', '-e', js, ruta], capture_output=True, text=True, check=True).stdout)


def a_mp3(wav, mp3, ini, fin):
    """El trozo de ini a fin (s), con un fundido corto en cada extremo y el volumen normalizado, en MP3 mono de 64 kbit/s.

    El recorte se hace aquí y no con los filtros de ffmpeg: `silenceremove` y `areverse` seguidos de `loudnorm` dejaban a
    ffmpeg 6.1 parado, sin error, con algunas frases."""
    sr = 44100
    x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'],
                                     capture_output=True, check=True, timeout=120).stdout, dtype=np.float32)
    x = x[int(ini * sr):int(fin * sr)].copy()
    a, b = min(int(0.02 * sr), len(x)), min(int(0.06 * sr), len(x))
    x[:a] *= np.linspace(0, 1, a, dtype=np.float32)
    x[len(x) - b:] *= np.linspace(1, 0, b, dtype=np.float32)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-18:TP=-2',
                    '-ar', str(sr), '-b:a', '64k', mp3], input=x.tobytes(), check=True, timeout=120)


def duracion(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True, check=True).stdout)


NUMEROS = dict(enumerate('cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis '
                         'diecisiete dieciocho diecinueve veinte'.split()))


def palabras(t):
    """Las palabras de un texto, sin mayúsculas ni tildes, y los números como se dicen («1 a 4» = «uno a cuatro»)."""
    t = unicodedata.normalize('NFKD', t.lower())
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return [NUMEROS.get(int(w), w) if w.isdigit() else w for w in re.findall(r'[a-zñ0-9]+', t)]


def parecido(oido, dicho):
    """De 0 a 1, cuánto se parece lo oído a lo escrito, y cuántas palabras de más se oyen."""
    sm = difflib.SequenceMatcher(None, palabras(oido), palabras(dicho))
    de_mas = sum(max(0, (i2 - i1) - (j2 - j1)) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag in ('insert', 'replace'))
    return sm.ratio(), de_mas


PASO = 0.02          # s de cada trozo al medir el volumen
SILENCIO = 30        # dB por debajo de la voz que cuentan como silencio
RUIDO_EN_PAUSA = 22  # dB por debajo de la voz a partir de los que un sonido en una pausa es un «eh»


def niveles(x, sr):
    n = int(sr * PASO)
    trozos = x[:len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((trozos ** 2).mean(axis=1)) + 1e-9)


def limites(x, sr, ws):
    """Dónde empieza y acaba la frase (s) y cuántos sonidos fuertes hay en sus pausas.

    El final es el primer silencio (4 trozos seguidos, 80 ms) desde un poco antes del final de la última palabra según Whisper,
    que a veces la da por acabada antes de tiempo; si no lo hay en 0,7 s, 0,2 s después de ella. El principio, el último
    silencio antes de la primera palabra, o el principio del audio."""
    db = niveles(x, sr)
    dur = len(db) * PASO
    if not ws:
        return 0.0, dur, 0
    voz = np.percentile(db, 95)
    callado = db < voz - SILENCIO

    def silencio_desde(i):
        return i + 4 <= len(callado) and callado[i:i + 4].all()

    desde, hasta = int((ws[-1].end - 0.1) / PASO), int((ws[-1].end + 0.7) / PASO)
    fin = next((i * PASO + 0.04 for i in range(max(desde, 0), min(hasta, len(db))) if silencio_desde(i)), ws[-1].end + 0.2)
    ini = next((i * PASO for i in range(int((ws[0].start + 0.05) / PASO), 3, -1) if silencio_desde(i - 4)), 0.0)
    fuerte = db > voz - RUIDO_EN_PAUSA
    ruidos = 0
    for a, b in zip(ws, ws[1:]):
        i, j = int((a.end + 0.06) / PASO), int((b.start - 0.06) / PASO)
        if j - i >= 5 and any(fuerte[k:k + 5].all() for k in range(i, j - 4)):
            ruidos += 1
    return ini, min(fin, dur), ruidos


def puntuar(ws, ini, fin, ruidos, dicho, texto):
    """Lo que se oye entre ini y fin contra lo que tenía que decir (con lo dicho o con el texto, lo que mejor salga),
    menos 0,08 por palabra de más y 0,15 por sonido fuerte en una pausa."""
    oido = ' '.join(w.word for w in ws if w.start < fin and w.end > ini)
    p, de_mas = max(parecido(oido, dicho), parecido(oido, texto))
    return p - 0.08 * de_mas - 0.15 * ruidos, oido, de_mas


class Chatterbox:
    def __init__(self):
        import perth
        perth.PerthImplicitWatermarker = perth.DummyWatermarker   # ver arriba
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        self.m = ChatterboxMultilingualTTS.from_pretrained(device='cpu')

    def decir(self, texto, wav, semilla):
        import torch
        import torchaudio
        torch.manual_seed(semilla)
        torchaudio.save(wav, self.m.generate(texto, language_id='es'), self.m.sr)


class KokoroVoz:
    def __init__(self):
        os.makedirs(MODELOS, exist_ok=True)
        origen = 'https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/'
        for f in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
            destino = os.path.join(MODELOS, f)
            if not os.path.exists(destino):
                urllib.request.urlretrieve(origen + f, destino + '.parcial')
                os.replace(destino + '.parcial', destino)
        from kokoro_onnx import Kokoro
        self.k = Kokoro(os.path.join(MODELOS, 'kokoro-v1.0.onnx'), os.path.join(MODELOS, 'voices-v1.0.bin'))

    def decir(self, texto, wav, semilla):
        import soundfile as sf
        muestras, sr = self.k.create(texto, voice='ef_dora', speed=0.92, lang='es')
        sf.write(wav, muestras, sr)


def main():
    args = sys.argv[1:]
    motor = 'chatterbox'
    if '--motor' in args:
        i = args.index('--motor'); motor = args[i + 1]; del args[i:i + 2]
    solo = None
    if '--frase' in args:
        i = args.index('--frase'); solo = int(args[i + 1]); del args[i:i + 2]
    ids = [a for a in args if not a.startswith('--')]
    if ids == ['todos']:
        ids = sorted(f[:-4] for f in os.listdir(os.path.join(AQUI, 'guiones')) if f.endswith('.mjs') and not f.startswith('_'))
    if not ids:
        print(__doc__)
        sys.exit(1)
    voz = Chatterbox() if motor == 'chatterbox' else KokoroVoz()
    oido = None
    try:
        from faster_whisper import WhisperModel
        oido = WhisperModel('small', device='cpu', compute_type='int8')
    except ImportError:
        print('Sin faster-whisper: no se comprueba lo que se oye.')
    for ident in ids:
        carpeta = os.path.join(AQUI, 'audio', ident)
        os.makedirs(carpeta, exist_ok=True)
        lista = frases(ident)
        for n, texto in enumerate(lista, 1):
            if solo and n != solo:
                continue
            dicho = para_decir(texto)
            mp3 = os.path.join(carpeta, f'{n:02d}.mp3')
            base = int(hashlib.sha256(texto.encode()).hexdigest()[:8], 16)
            mejor = None
            empieza = time.time()
            for intento in range(INTENTOS if oido else 1):
                wav = os.path.join(carpeta, f'{n:02d}-{intento}.wav')
                voz.decir(dicho, wav, base + intento)
                x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                                                 capture_output=True, check=True, timeout=120).stdout, dtype=np.float32)
                ws = []
                if oido:
                    segs, _ = oido.transcribe(x, language='es', beam_size=5, word_timestamps=True)
                    ws = [w for s in segs for w in s.words]
                ini, fin, ruidos = limites(x, 16000, ws)
                p, oyo, de_mas = puntuar(ws, ini, fin, ruidos, dicho, texto) if oido else (1.0, '', 0)
                if mejor is None or p > mejor['p']:
                    if mejor:
                        os.remove(mejor['wav'])
                    mejor = dict(p=p, wav=wav, oyo=oyo, intento=intento, ini=ini, fin=fin, ruidos=ruidos, de_mas=de_mas,
                                 cola=len(x) / 16000 - fin)
                else:
                    os.remove(wav)
                if p >= PARECIDO:
                    break
            a_mp3(mejor['wav'], mp3, mejor['ini'], mejor['fin'])
            os.remove(mejor['wav'])
            aviso = '' if mejor['p'] >= PARECIDO else '  <-- REVISAR'
            notas = ''.join([f', {mejor["de_mas"]} de más' if mejor['de_mas'] else '',
                             f', {mejor["ruidos"]} ruido en pausa' if mejor['ruidos'] else '',
                             f', cola quitada {mejor["cola"]:.1f} s' if mejor['cola'] > 0.3 else ''])
            print(f'{ident} {n:02d}: {duracion(mp3):5.1f} s, nota {mejor["p"]:.2f} (intento {mejor["intento"] + 1}{notas}, '
                  f'{time.time() - empieza:.0f} s){aviso} | {mejor["oyo"].strip()}', flush=True)
        if not solo:
            for f in os.listdir(carpeta):
                m = re.fullmatch(r'(\d\d)\.mp3', f)
                if m and int(m.group(1)) > len(lista):
                    os.remove(os.path.join(carpeta, f))


if __name__ == '__main__':
    main()
