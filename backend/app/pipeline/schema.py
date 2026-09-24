from pydantic import BaseModel, Field, field_validator


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class Transcript(BaseModel):
    language: str | None = None
    duration: float = 0.0
    segments: list[TranscriptSegment]

    @property
    def text(self) -> str:
        return " ".join(s.text for s in self.segments)

    def marked_lines(self) -> list[str]:
        """One line per segment, prefixed with its start time, e.g. "[12:05] and so the ..."."""
        return [f"[{format_clock(s.start)}] {s.text}" for s in self.segments]


def format_clock(seconds: float) -> str:
    total = int(seconds)
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


class MCQ(BaseModel):
    question: str
    options: list[str] = Field(min_length=2)
    answer: str

    @field_validator("answer")
    @classmethod
    def answer_must_be_an_option(cls, v: str, info):
        options = info.data.get("options") or []
        if options and v not in options:
            # Tolerate "A"/"B" style answers by mapping to the option text.
            letters = {chr(65 + i): o for i, o in enumerate(options)}
            if v.strip().upper() in letters:
                return letters[v.strip().upper()]
            raise ValueError(f"answer {v!r} is not one of the options")
        return v


def parse_timestamp(v) -> float | None:
    """Accept seconds (int/float/"93") or clock strings ("1:33", "01:02:03", "[12:05]"); anything else → None."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v) if v >= 0 else None
    text = str(v).strip().strip("[]() ")
    if not text:
        return None
    try:
        parts = [float(p) for p in text.split(":")]
    except ValueError:
        return None
    if len(parts) > 3 or any(p < 0 for p in parts):
        return None
    seconds = 0.0
    for p in parts:
        seconds = seconds * 60 + p
    return seconds


class CornellNote(BaseModel):
    cue: str
    note: str
    start: float | None = None  # seconds into the lecture where this idea is taught, when known

    @field_validator("start", mode="before")
    @classmethod
    def _parse_start(cls, v):
        return parse_timestamp(v)


class NotesOutput(BaseModel):
    """The contract between the pipeline and the frontend. Keep in sync with the prompt in notes.py."""

    topic: str
    summary: str
    cornell_notes: list[CornellNote]
    mcqs: list[MCQ]


class ChunkOutput(BaseModel):
    """What the LLM returns for a single transcript chunk."""

    topic: str
    summary: str
    cornell_notes: list[CornellNote]
    mcqs: list[MCQ]
