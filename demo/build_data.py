"""Bundle CLI outputs into the demo's data files.

    # 1. process each lecture once with the real pipeline (from backend/), timing it:
    ../.venv/bin/python cli.py <lecture.mp4> -o <runs>/<slug>
    # 2. bundle (from the repo root); timings.txt holds lines like "qp1 rc=0 seconds=660"
    .venv/bin/python demo/build_data.py <runs> --whisper-model base

Writes frontend/src/demo/data/<slug>.json = {notes, transcript, markdown, anki, processing}.
"""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.pipeline import NotesOutput, Transcript, notes_to_anki, notes_to_markdown  # noqa: E402

SLUGS = ["qp1", "alg1", "la1"]
OUT = ROOT / "frontend" / "src" / "demo" / "data"


def read_timings(path: Path) -> dict[str, int]:
    timings = {}
    if path.exists():
        for line in path.read_text().splitlines():
            m = re.match(r"(\S+) rc=0 seconds=(\d+)", line)
            if m:
                timings[m[1]] = int(m[2])
    return timings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", type=Path, help="Directory holding <slug>/notes.json + transcript.json and timings.txt")
    parser.add_argument("--whisper-model", default="base")
    args = parser.parse_args()

    timings = read_timings(args.runs / "timings.txt")
    OUT.mkdir(parents=True, exist_ok=True)
    for slug in SLUGS:
        run = args.runs / slug
        notes = NotesOutput.model_validate_json((run / "notes.json").read_text(encoding="utf-8"))
        transcript = Transcript.model_validate_json((run / "transcript.json").read_text(encoding="utf-8"))
        processing = {"date": date.today().isoformat(), "whisper_model": args.whisper_model, "audio_seconds": round(transcript.duration)}
        if slug in timings:
            processing["seconds"] = timings[slug]
        data = {
            "notes": notes.model_dump(),
            "transcript": {
                "duration": transcript.duration,
                "segments": [{"start": round(s.start, 2), "text": s.text} for s in transcript.segments],
            },
            "markdown": notes_to_markdown(notes),
            "anki": notes_to_anki(notes, tag=f"mit-ocw-{slug}"),
            "processing": processing,
        }
        (OUT / f"{slug}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{slug}: {len(notes.cornell_notes)} cues, {len(notes.mcqs)} MCQs, {transcript.duration / 60:.1f} min audio, processed in {processing.get('seconds', '?')} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
