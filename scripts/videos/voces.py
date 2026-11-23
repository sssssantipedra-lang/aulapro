"""
Genera las voces de los vídeos de ayuda en el propio equipo, gratis y sin enviar nada fuera.

    python3.11 -m venv .venv-voces && .venv-voces/bin/pip install chatterbox-tts faster-whisper soundfile
    .venv-voces/bin/python scripts/videos/voces.py <id> [<id>…]          # o «todos»
    .venv-voces/bin/python scripts/videos/voces.py --frase 3 <id>        # solo la escena 3 de ese vídeo

Lee las frases de `guiones/<id>.mjs` (con node) y deja `audio/<id>/01.mp3`, 02… (MP3 mono de 64 kbit/s, sin silencios en
los extremos), y borra los que sobren. Necesita node y ffmpeg.

La voz (elegida por el dueño el 23-11-2026 entre ocho gratuitas) es Chatterbox multilingüe de Resemble AI (licencia MIT, uso
comercial permitido; https://huggingface.co/ResembleAI/chatterbox) en castellano, con su voz de serie y los ajustes de serie.
El modelo se descarga la primera vez en la caché de Hugging Face. Va lento sin tarjeta gráfica (un minuto por frase, más o
menos) y no es exacto: a veces se come o repite palabras. Por eso cada frase se transcribe con Whisper y, si no se parece lo
bastante a lo que tenía que decir, se repite con otra semilla (hasta `INTENTOS` veces); la que más se parezca es la que queda.
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
import unicodedata
import urllib.request

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


def a_mp3(wav, mp3):
    filtro = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,'
              'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,loudnorm=I=-18:TP=-2')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', filtro, '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3], check=True)


def duracion(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True, check=True).stdout)


def palabras(t):
    t = unicodedata.normalize('NFKD', t.lower())
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return re.findall(r'[a-zñ0-9]+', t)


def parecido(oido, dicho):
    return difflib.SequenceMatcher(None, palabras(oido), palabras(dicho)).ratio()


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
    import numpy as np
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
            for intento in range(INTENTOS if oido else 1):
                wav = os.path.join(carpeta, f'{n:02d}-{intento}.wav')
                voz.decir(dicho, wav, base + intento)
                p, oyo = 1.0, ''
                if oido:
                    crudo = subprocess.run(['ffmpeg', '-v', 'error', '-i', wav, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                                           capture_output=True, check=True).stdout
                    segs, _ = oido.transcribe(np.frombuffer(crudo, dtype=np.float32), language='es', beam_size=5)
                    oyo = ' '.join(s.text.strip() for s in segs)
                    p = max(parecido(oyo, dicho), parecido(oyo, texto))
                if mejor is None or p > mejor[0]:
                    if mejor:
                        os.remove(mejor[1])
                    mejor = (p, wav, oyo, intento)
                else:
                    os.remove(wav)
                if p >= PARECIDO:
                    break
            a_mp3(mejor[1], mp3)
            os.remove(mejor[1])
            aviso = '' if mejor[0] >= PARECIDO else '  <-- REVISAR'
            print(f'{ident} {n:02d}: {duracion(mp3):5.1f} s, parecido {mejor[0]:.2f} (intento {mejor[3] + 1}){aviso} | {mejor[2]}', flush=True)
        if not solo:
            for f in os.listdir(carpeta):
                m = re.fullmatch(r'(\d\d)\.mp3', f)
                if m and int(m.group(1)) > len(lista):
                    os.remove(os.path.join(carpeta, f))


if __name__ == '__main__':
    main()
