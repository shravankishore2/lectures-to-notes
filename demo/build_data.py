"""Bundle CLI outputs into the demo's data files.

    # 1. process each lecture once with the real pipeline, timed, with its prompt + corrections:
    demo/process.sh <media_dir> <runs> base qp1 alg1 la1
    # 2. bundle; timings.txt holds lines like "qp1 rc=0 seconds=159 model=base"
    .venv/bin/python demo/build_data.py <runs>

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
HINTS = json.loads((ROOT / "demo" / "prompts.json").read_text(encoding="utf-8"))


def read_timings(path: Path) -> dict[str, dict]:
    """Last successful run per slug: {"seconds": int, "model": str | None, "prompt": bool}."""
    timings = {}
    if path.exists():
        for line in path.read_text().splitlines():
            m = re.match(r"(\S+) rc=0 seconds=(\d+)(?: model=(\S+))?(?: prompt=(\d))?", line)
            if m:
                timings[m[1]] = {"seconds": int(m[2]), "model": m[3], "prompt": m[4] == "1"}
    return timings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("runs", type=Path, help="Directory holding <slug>/notes.json + transcript.json and timings.txt")
    parser.add_argument("--whisper-model", default="base", help="Recorded when timings.txt has no model= field")
    args = parser.parse_args()

    timings = read_timings(args.runs / "timings.txt")
    OUT.mkdir(parents=True, exist_ok=True)
    for slug in SLUGS:
        run = args.runs / slug
        notes = NotesOutput.model_validate_json((run / "notes.json").read_text(encoding="utf-8"))
        transcript = Transcript.model_validate_json((run / "transcript.json").read_text(encoding="utf-8"))
        run_info = timings.get(slug, {})
        processing = {
            "date": date.today().isoformat(),
            "whisper_model": run_info.get("model") or args.whisper_model,
            "whisper_prompt": HINTS.get(slug, {}).get("prompt") if run_info.get("prompt") else None,
            "corrections": HINTS.get(slug, {}).get("corrections", {}),
            "audio_seconds": round(transcript.duration),
        }
        if "seconds" in run_info:
            processing["seconds"] = run_info["seconds"]
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
