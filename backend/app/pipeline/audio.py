import shutil
import subprocess
from pathlib import Path

SUPPORTED_EXTENSIONS = {".mp3", ".mp4", ".wav", ".m4a", ".webm", ".mkv", ".mov", ".ogg", ".opus", ".flac", ".aac"}


class AudioExtractionError(RuntimeError):
    pass


def extract_audio(input_path: str | Path, output_path: str | Path) -> Path:
    """Extract/normalise audio to 16 kHz mono PCM WAV (Whisper's preferred input)."""
    if shutil.which("ffmpeg") is None:
        raise AudioExtractionError("ffmpeg not found on PATH")

    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(input_path),
            "-vn", "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AudioExtractionError(result.stderr.strip() or "ffmpeg failed")
    return output_path


def compress_audio(wav_path: str | Path, output_path: str | Path) -> Path:
    """Small AAC copy (~20 MB/hour) kept for in-app playback so the original upload can be deleted."""
    output_path = Path(output_path)
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(wav_path),
            "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart",
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AudioExtractionError(result.stderr.strip() or "ffmpeg failed to compress audio")
    return output_path
