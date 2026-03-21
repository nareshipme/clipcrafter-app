"""
ClipCrafter — Modal faster-whisper transcription service
Deploy: modal deploy modal/transcribe.py
Invoke: POST https://<workspace>--clipcrafter-transcribe-transcribe.modal.run
"""

import modal
import os
import tempfile
import urllib.request

app = modal.App("clipcrafter-transcribe")

# CUDA-enabled image with faster-whisper + ffmpeg
# Must use from_registry with a CUDA base — debian_slim doesn't have libcublas
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04",
        add_python="3.11",
    )
    .apt_install("ffmpeg")
    .pip_install(
        "faster-whisper==1.1.1",
        "numpy",
        "requests",
    )
)

@app.function(
    image=image,
    gpu="T4",                    # T4 = cheapest GPU, plenty for Whisper
    timeout=600,                 # 10 min max — handles long videos
    scaledown_window=60,         # keep warm 60s between requests
    single_use_containers=True,  # fresh container per request (GPU cleanup)
)
def transcribe(
    audio_url: str,
    model_size: str = "large-v3",
    language: str | None = None,
) -> dict:
    """
    Transcribe audio from a URL using faster-whisper.
    
    Args:
        audio_url: HTTP URL or base64 data URI of the audio file
        model_size: Whisper model size (tiny/base/small/medium/large-v3)
        language: ISO language code or None for auto-detect
    
    Returns:
        { text, segments: [{id, start, end, text}], language, duration }
    """
    from faster_whisper import WhisperModel
    import time

    start = time.time()

    # Download audio to temp file
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name
        if audio_url.startswith("http"):
            urllib.request.urlretrieve(audio_url, tmp_path)
        else:
            # base64 data URI
            import base64
            header, data = audio_url.split(",", 1)
            tmp.write(base64.b64decode(data))

    try:
        # Load model (cached in container between invocations)
        model = WhisperModel(
            model_size,
            device="cuda",
            compute_type="float16",   # half precision — faster, same quality
        )

        segments_iter, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,           # skip silent sections
            vad_parameters={"min_silence_duration_ms": 500},
        )

        segments = []
        full_text_parts = []
        for i, seg in enumerate(segments_iter):
            segments.append({
                "id": i,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
            })
            full_text_parts.append(seg.text.strip())

        elapsed = round(time.time() - start, 2)
        realtime_factor = round(info.duration / elapsed, 1) if elapsed > 0 else 0

        print(f"Transcribed {info.duration:.1f}s audio in {elapsed}s ({realtime_factor}x realtime) using {model_size}")

        return {
            "text": " ".join(full_text_parts),
            "segments": segments,
            "language": info.language,
            "duration": round(info.duration, 2),
            "elapsed_sec": elapsed,
            "realtime_factor": realtime_factor,
            "model": model_size,
        }
    finally:
        os.unlink(tmp_path)


# Web endpoint — callable from Node.js via simple fetch
endpoint_image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")

@app.function(image=endpoint_image)
@modal.fastapi_endpoint(method="POST")
def transcribe_endpoint(body: dict) -> dict:
    """
    HTTP POST endpoint for Node.js integration.
    Body: { audio_url, model_size?, language? }
    """
    audio_url = body.get("audio_url")
    if not audio_url:
        return {"error": "audio_url is required"}, 400

    model_size = body.get("model_size", "large-v3")
    language = body.get("language", None)

    result = transcribe.remote(audio_url, model_size=model_size, language=language)
    return result


if __name__ == "__main__":
    # Local test
    with app.run():
        result = transcribe.local(
            "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            model_size="tiny",
        )
        print(result)
