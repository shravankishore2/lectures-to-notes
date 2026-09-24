import re
import subprocess
import tempfile
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path

from .schema import Transcript, TranscriptSegment, format_clock

FILLERS = ["um", "uh", "er", "ah", "you know", "basically", "literally"]
_FILLER_RE = re.compile(r"\b(?:" + "|".join(re.escape(f) for f in FILLERS) + r")\b[,]?\s*", re.IGNORECASE)
MIN_SEGMENT_SECONDS = 2.0
PIECE_SECONDS = 600  # long recordings are transcribed 10 minutes at a time: bounded memory, progress, cancel points


def remove_filler(text: str) -> str:
    return " ".join(_FILLER_RE.sub("", text).split())


def clean_segments(raw_segments: list[dict]) -> list[TranscriptSegment]:
    """Strip fillers, drop empty/duplicate lines, and merge very short segments into their predecessor."""
    cleaned: list[TranscriptSegment] = []
    last_text = None
    for seg in raw_segments:
        text = remove_filler(seg["text"])
        if not text or text == last_text:
            continue
        last_text = text
        if cleaned and (cleaned[-1].end - cleaned[-1].start) < MIN_SEGMENT_SECONDS:
            prev = cleaned[-1]
            cleaned[-1] = TranscriptSegment(start=prev.start, end=float(seg["end"]), text=f"{prev.text} {text}")
        else:
            cleaned.append(TranscriptSegment(start=float(seg["start"]), end=float(seg["end"]), text=text))
    return cleaned


@lru_cache(maxsize=1)
def _load_model(name: str):
    import whisper  # imported lazily: slow and pulls in torch

    return whisper.load_model(name)


def audio_duration(path: str | Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True,
        text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        return 0.0


def transcribe(
    audio_path: str | Path,
    model_name: str = "base",
    on_progress: Callable[[str], None] | None = None,
) -> Transcript:
    """Whisper transcription. `on_progress` is called between pieces and may raise to abort."""
    model = _load_model(model_name)
    total = audio_duration(audio_path)
    report = on_progress or (lambda _m: None)

    if total <= PIECE_SECONDS * 1.5:
        result = model.transcribe(str(audio_path), fp16=False)
        raw, language = result.get("segments", []), result.get("language")
    else:
        raw, language = [], None
        with tempfile.TemporaryDirectory() as tmp:
            offset = 0.0
            while offset < total:
                report(f"Transcribing {format_clock(offset)} / {format_clock(total)}")
                piece = Path(tmp) / "piece.wav"
                subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(offset), "-t", str(PIECE_SECONDS),
                     "-i", str(audio_path), "-c", "copy", str(piece)],
                    check=True,
                )
                result = model.transcribe(str(piece), fp16=False, language=language)
                language = language or result.get("language")
                for seg in result.get("segments", []):
                    raw.append({"start": seg["start"] + offset, "end": seg["end"] + offset, "text": seg["text"]})
                offset += PIECE_SECONDS

    segments = clean_segments(raw)
    duration = segments[-1].end if segments else 0.0
    return Transcript(language=language, duration=duration, segments=segments)
