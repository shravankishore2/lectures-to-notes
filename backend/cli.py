"""Run the whole pipeline on one file without the API: python cli.py ../cfavid.mp4 [-o outputs/]"""

import argparse
import json
import sys
from pathlib import Path

from app import config
from app.pipeline import Transcript, extract_audio, generate_notes, notes_to_markdown, transcribe


def main() -> int:
    parser = argparse.ArgumentParser(description="Lecture audio/video → Cornell notes + MCQs")
    parser.add_argument("input", help="Path to a video or audio file")
    parser.add_argument("-o", "--out", default="outputs", help="Output directory (default: ./outputs)")
    parser.add_argument("--whisper-model", default=config.WHISPER_MODEL, help="Whisper model size (tiny/base/small/medium)")
    parser.add_argument("--skip-llm", action="store_true", help="Stop after transcription")
    parser.add_argument("--from-transcript", action="store_true", help="Reuse <out>/transcript.json instead of re-running ffmpeg + Whisper")
    args = parser.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    transcript_file = out / "transcript.json"

    if args.from_transcript:
        transcript = Transcript.model_validate_json(transcript_file.read_text(encoding="utf-8"))
        print(f"[1-2/3] Reusing transcript ({len(transcript.segments)} segments) from {transcript_file}")
    else:
        wav = extract_audio(args.input, out / "audio.wav")
        print(f"[1/3] Audio extracted → {wav}")

        transcript = transcribe(wav, model_name=args.whisper_model)
        transcript_file.write_text(transcript.model_dump_json(indent=2), encoding="utf-8")
        print(f"[2/3] Transcript ({len(transcript.segments)} segments, {transcript.duration:.0f}s) → {transcript_file}")

    if args.skip_llm:
        return 0

    notes = generate_notes(transcript, on_progress=lambda m: print(f"      {m}"))
    (out / "notes.json").write_text(json.dumps(notes.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "notes.md").write_text(notes_to_markdown(notes), encoding="utf-8")
    print(f"[3/3] Notes ({len(notes.cornell_notes)} cues, {len(notes.mcqs)} MCQs) → {out / 'notes.json'}, {out / 'notes.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
