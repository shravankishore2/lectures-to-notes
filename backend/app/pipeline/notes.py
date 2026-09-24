from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed

from pydantic import ValidationError

from . import llm
from .chunking import chunk_lines, chunk_text
from .schema import ChunkOutput, NotesOutput, Transcript

PARALLEL_CHUNKS = 3  # concurrent LLM calls for long lectures; keep low to stay under free-tier rate limits

# Keep these schemas in sync with schema.py — the models are the source of truth.
CHUNK_PROMPT = """You are a study assistant. Given a {unit} transcript, produce Cornell-style study material.

Return ONLY a JSON object matching this exact schema (no markdown, no backticks, no commentary):
{{
  "topic": "short title of what this {unit} covers",
  "summary": "3-sentence summary of this {unit}, written for a student (do not refer to it as a section or transcript)",
  "cornell_notes": [
    {{"cue": "a question or key term a student would write in the cue column", "note": "the detailed answer/explanation for the notes column", "start": {start_hint}}}
  ],
  "mcqs": [
    {{"question": "...", "options": ["...", "...", "...", "..."], "answer": "the full text of the correct option, copied exactly from options"}}
  ]
}}

Guidelines:
- Produce {n_notes} cornell_notes entries covering every distinct idea in the {unit}, in the order they were taught.
- Notes should be substantive (2-4 sentences) and self-contained; cues should be phrased as questions where possible.
- Produce {n_mcqs} mcqs with exactly 4 options each. Distractors must be plausible. "answer" must match one option verbatim.
- Ignore small talk, housekeeping, and repetition. Do not invent facts that are not in the transcript.

Transcript{part_label}:
\"\"\"
{chunk}
\"\"\"
"""

START_HINT_MARKED = '"the [m:ss] marker of the line where this idea is first explained, copied from the transcript, e.g. \\"12:05\\""'
START_HINT_PLAIN = "null"

SYNTHESIS_PROMPT = """You are a study assistant. Below are summaries of consecutive sections of one lecture, in order.

Return ONLY a JSON object with this exact schema (no markdown, no backticks):
{{
  "topic": "one concise title for the whole lecture",
  "summary": "a summary of the entire lecture for a student: {summary_len}"
}}

Section summaries:
{summaries}
"""


class NotesGenerationError(RuntimeError):
    pass


def _notes_for_chunk(cl, models: list[str], chunk: str, part_label: str, n_notes: str, n_mcqs: str, marked: bool) -> ChunkOutput:
    unit = "lecture" if not part_label else "section of a lecture"
    prompt = CHUNK_PROMPT.format(
        chunk=chunk,
        part_label=part_label,
        n_notes=n_notes,
        n_mcqs=n_mcqs,
        unit=unit,
        start_hint=START_HINT_MARKED if marked else START_HINT_PLAIN,
    )
    last_error: Exception | None = None
    for _ in range(llm.MAX_JSON_ATTEMPTS):
        raw = llm.generate_json(cl, models, prompt)
        try:
            return ChunkOutput.model_validate(raw)
        except ValidationError as e:
            last_error = e
            prompt = prompt + f"\n\nYour previous reply failed validation: {e.errors()[0].get('msg')}. Fix it and reply again."
    raise NotesGenerationError(f"model output failed schema validation: {last_error}")


def generate_notes(
    transcript: Transcript | str,
    model: str | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> NotesOutput:
    """Turn a transcript into Cornell notes + summary + MCQs.

    Long transcripts are chunked; chunks are processed in parallel and their notes/MCQs concatenated
    in lecture order. A final synthesis call produces the overall topic and summary.
    `on_progress` is only ever called from the calling thread, so it may raise to abort (e.g. on cancel).
    """
    marked = isinstance(transcript, Transcript)
    chunks = chunk_lines(transcript.marked_lines()) if marked else chunk_text(transcript)
    if not chunks:
        raise NotesGenerationError("transcript is empty")

    models = llm.model_chain(model)
    try:
        cl = llm.client()
    except llm.LLMError as e:
        raise NotesGenerationError(str(e)) from e
    report = on_progress or (lambda _msg: None)

    single = len(chunks) == 1
    n_notes = "6-12" if single else "4-8"
    n_mcqs = "5-8" if single else "3-5"

    parts: list[ChunkOutput | None] = [None] * len(chunks)
    report(f"Writing notes (0/{len(chunks)} parts)" if not single else "Writing notes")
    with ThreadPoolExecutor(max_workers=PARALLEL_CHUNKS) as pool:
        futures = {
            pool.submit(_notes_for_chunk, cl, models, chunk, "" if single else f" (part {i + 1} of {len(chunks)})", n_notes, n_mcqs, marked): i
            for i, chunk in enumerate(chunks)
        }
        done = 0
        try:
            for fut in as_completed(futures):
                parts[futures[fut]] = fut.result()
                done += 1
                if not single:
                    report(f"Writing notes ({done}/{len(chunks)} parts)")
        except BaseException:
            for f in futures:
                f.cancel()
            raise

    if single:
        p = parts[0]
        return NotesOutput(topic=p.topic, summary=p.summary, cornell_notes=p.cornell_notes, mcqs=p.mcqs)

    report("Writing the overall summary")
    summaries = "\n".join(f"{i}. [{p.topic}] {p.summary}" for i, p in enumerate(parts, start=1))
    summary_len = "3 sentences" if len(parts) <= 3 else "one paragraph of 5-7 sentences covering the main arc"
    try:
        overall = llm.generate_json(cl, models, SYNTHESIS_PROMPT.format(summaries=summaries, summary_len=summary_len))
    except llm.LLMError:
        overall = {}
    return NotesOutput(
        topic=str(overall.get("topic") or parts[0].topic),
        summary=str(overall.get("summary") or " ".join(p.summary for p in parts[:2])),
        cornell_notes=[n for p in parts for n in p.cornell_notes],
        mcqs=[m for p in parts for m in p.mcqs],
    )
