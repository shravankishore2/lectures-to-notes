"""Lecture → notes pipeline. Each stage is a plain function so it can be run from the CLI or the API worker."""
from .audio import extract_audio
from .download import DownloadError, download_media, validate_url
from .transcribe import transcribe
from .notes import generate_notes
from .schema import NotesOutput, Transcript, TranscriptSegment
from .export import notes_to_anki, notes_to_markdown
from .ask import AskAnswer, AskTurn, answer_question

__all__ = [
    "extract_audio",
    "download_media",
    "validate_url",
    "DownloadError",
    "transcribe",
    "generate_notes",
    "NotesOutput",
    "Transcript",
    "TranscriptSegment",
    "notes_to_markdown",
    "notes_to_anki",
    "answer_question",
    "AskTurn",
    "AskAnswer",
]
