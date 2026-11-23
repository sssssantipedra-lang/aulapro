"""
Genera las voces de los vídeos de ayuda en el propio equipo, gratis y sin enviar nada fuera.

    python3 -m venv .venv-voces && .venv-voces/bin/pip install kokoro-onnx soundfile
    .venv-voces/bin/python scripts/videos/voces.py <id> [<id>…]        # o «todos»
    .venv-voces/bin/python scripts/videos/voces.py --comprobar <id>    # además, transcribe y compara (pip install faster-whisper)

Lee las frases de `guiones/<id>.mjs` (con node) y deja `audio/<id>/01.mp3`, 02… (MP3 mono de 64 kbit/s, sin silencios en
los extremos), y borra los que sobren. Necesita node, ffmpeg y espeak-ng (`apt-get install espeak-ng`).

La voz es Kokoro 82M (licencia Apache 2.0, uso comercial permitido; https://huggingface.co/hexgrad/Kokoro-82M) con la voz
española «ef_dora» y la fonética de espeak-ng para el castellano de España (la c y la z, como «z»). El modelo (unos 350 MB) se
descarga la primera vez en `scripts/videos/.modelos/`, que no va al repositorio.

Lo que se dice no es siempre lo que se lee en el subtítulo: `PRONUNCIA` cambia siglas y nombres extranjeros por cómo suenan.
Si una frase nueva lleva una sigla o una marca, se añade ahí y se comprueba con --comprobar.
"""
import json
import os
import re
import subprocess
import sys
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
MODELOS = os.path.join(AQUI, '.modelos')
ORIGEN = 'https://huggingface.co/fastrtc/kokoro-onnx/resolve/main/'
VOZ, VELOCIDAD = 'ef_dora', 0.92

# Cómo suena lo que no es castellano corriente (palabra entera, distinguiendo mayúsculas)
PRONUNCIA = [
    (r'\bAulaPro\b', 'Aula Pro'),
    (r'\bIA\b', 'i a'),
    (r'\bPDF\b', 'pe de efe'),
    (r'\bCSV\b', 'ce ese uve'),
    (r'\bAPI\b', 'a pe i'),
    (r'\bGet API key\b', 'guet, ei, pi, ai, qui'),
    (r'\bAI Studio\b', 'ei ai estudio'),
    (r'\bGoogle\b', 'gúgel'),
    (r'\bOneDrive\b', 'uan draif'),
    (r'\bDrive\b', 'draif'),
    (r'\bWord\b', 'guord'),
    (r'\bExcel\b', 'éksel'),
    (r'\bescape rooms?\b', 'escape rums'),
    (r'\bIntro\b', 'intro'),
    (r'\bapp\b', 'ap'),
]


def para_decir(texto):
    t = texto.replace('«', '').replace('»', '').replace('“', '').replace('”', '')
    for patron, dicho in PRONUNCIA:
        t = re.sub(patron, dicho, t)
    return t


def frases(ident):
    js = ('import(process.argv[1]).then(m => process.stdout.write(JSON.stringify(m.default.escenas.map(e => e.texto))))')
    ruta = 'file://' + os.path.join(AQUI, 'guiones', ident + '.mjs')
    return json.loads(subprocess.run(['node', '-e', js, ruta], capture_output=True, text=True, check=True).stdout)


def modelo():
    os.makedirs(MODELOS, exist_ok=True)
    for f in ('kokoro-v1.0.onnx', 'voices-v1.0.bin'):
        destino = os.path.join(MODELOS, f)
        if not os.path.exists(destino):
            print('Descargando', f)
            urllib.request.urlretrieve(ORIGEN + f, destino + '.parcial')
            os.replace(destino + '.parcial', destino)
    from kokoro_onnx import Kokoro
    return Kokoro(os.path.join(MODELOS, 'kokoro-v1.0.onnx'), os.path.join(MODELOS, 'voices-v1.0.bin'))


def a_mp3(wav, mp3):
    filtro = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,'
              'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-af', filtro, '-ac', '1', '-ar', '44100', '-b:a', '64k', mp3], check=True)


def duracion(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True, check=True).stdout)


def main():
    args = sys.argv[1:]
    comprobar = '--comprobar' in args
    ids = [a for a in args if not a.startswith('--')]
    if ids == ['todos']:
        ids = sorted(f[:-4] for f in os.listdir(os.path.join(AQUI, 'guiones')) if f.endswith('.mjs') and not f.startswith('_'))
    if not ids:
        print(__doc__)
        sys.exit(1)
    import soundfile as sf
    k = modelo()
    oido = None
    if comprobar:
        from faster_whisper import WhisperModel
        oido = WhisperModel('small', device='cpu', compute_type='int8')
    for ident in ids:
        carpeta = os.path.join(AQUI, 'audio', ident)
        os.makedirs(carpeta, exist_ok=True)
        lista = frases(ident)
        for i, texto in enumerate(lista, 1):
            wav = os.path.join(carpeta, f'{i:02d}.wav')
            mp3 = os.path.join(carpeta, f'{i:02d}.mp3')
            muestras, sr = k.create(para_decir(texto), voice=VOZ, speed=VELOCIDAD, lang='es')
            sf.write(wav, muestras, sr)
            a_mp3(wav, mp3)
            os.remove(wav)
            d = duracion(mp3)
            linea = f'{ident} {i:02d}: {d:5.1f} s, {len(texto) / d:4.1f} car/s'
            if oido:
                import numpy as np
                crudo = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                                       capture_output=True, check=True).stdout
                segs, _ = oido.transcribe(np.frombuffer(crudo, dtype=np.float32), language='es', beam_size=5)
                linea += ' | ' + ' '.join(s.text.strip() for s in segs)
            print(linea, flush=True)
        # Las que sobran, si el guion tiene ahora menos escenas
        for f in os.listdir(carpeta):
            m = re.fullmatch(r'(\d\d)\.mp3', f)
            if m and int(m.group(1)) > len(lista):
                os.remove(os.path.join(carpeta, f))


if __name__ == '__main__':
    main()
