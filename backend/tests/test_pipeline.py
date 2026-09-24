import pytest
from pydantic import ValidationError

from app.pipeline.chunking import chunk_lines, chunk_text
from app.pipeline.download import DownloadError, format_progress, is_direct_media, validate_url, youtube_id
from app.pipeline.export import notes_to_anki, notes_to_markdown
from app.pipeline.schema import CornellNote, NotesOutput, Transcript, TranscriptSegment, parse_timestamp
from app.pipeline.transcribe import clean_segments, remove_filler


def test_remove_filler_strips_words_and_whitespace():
    assert remove_filler("So, um, this is, uh, basically the idea") == "So, this is, the idea"


def test_remove_filler_does_not_strip_inside_words():
    assert remove_filler("The umbrella era ahead") == "The umbrella era ahead"


def test_clean_segments_merges_short_and_drops_duplicates():
    raw = [
        {"start": 0.0, "end": 1.0, "text": "Hi"},
        {"start": 1.0, "end": 4.0, "text": "there everyone"},
        {"start": 4.0, "end": 6.0, "text": "there everyone"},
        {"start": 6.0, "end": 9.0, "text": "um so"},
    ]
    segs = clean_segments(raw)
    assert [s.text for s in segs] == ["Hi there everyone", "so"]
    assert segs[0].start == 0.0 and segs[0].end == 4.0


def test_chunk_text_short_is_single_chunk():
    assert chunk_text("a b c", chunk_words=10, overlap_words=2) == ["a b c"]
    assert chunk_text("") == []


def test_chunk_text_overlaps_and_covers_everything():
    words = [f"w{i}" for i in range(100)]
    chunks = chunk_text(" ".join(words), chunk_words=30, overlap_words=5)
    assert len(chunks) == 4
    assert chunks[0].split()[-5:] == chunks[1].split()[:5]
    assert chunks[-1].split()[-1] == "w99"


def test_mcq_answer_letter_is_mapped_to_option(sample_notes):
    sample_notes["mcqs"][0]["answer"] = "b"
    notes = NotesOutput.model_validate(sample_notes)
    assert notes.mcqs[0].answer == "Chair"


def test_mcq_answer_not_in_options_fails(sample_notes):
    sample_notes["mcqs"][0]["answer"] = "Elephant"
    with pytest.raises(ValidationError):
        NotesOutput.model_validate(sample_notes)


def test_markdown_export(sample_notes):
    md = notes_to_markdown(NotesOutput.model_validate(sample_notes))
    assert md.startswith("# Memory palaces")
    assert "| What is a memory palace? *(0:12)* | A spatial mnemonic. |" in md
    assert "1. A — Palace" in md


def test_validate_url():
    assert validate_url("  https://youtu.be/xyz ", resolve=False) == "https://youtu.be/xyz"
    for bad in ["", "youtube.com/watch", "file:///etc/passwd", "javascript:alert(1)", "http://a.com:22/x", "http://u:p@a.com/"]:
        with pytest.raises(DownloadError):
            validate_url(bad, resolve=False)


@pytest.mark.parametrize("host", ["127.0.0.1", "localhost", "10.1.2.3", "192.168.0.10", "169.254.169.254", "[::1]", "0.0.0.0", "[::ffff:127.0.0.1]"])
def test_validate_url_blocks_private_addresses(host):
    with pytest.raises(DownloadError, match="private or local"):
        validate_url(f"http://{host}/lecture.mp4")


def test_youtube_helpers():
    assert youtube_id("https://www.youtube.com/watch?v=abc&t=5") == "abc"
    assert youtube_id("https://youtu.be/xyz?si=1") == "xyz"
    assert youtube_id("https://m.youtube.com/shorts/sh0rt") == "sh0rt"
    assert youtube_id("https://vimeo.com/123") is None
    assert is_direct_media("https://cdn.example.com/a/Lecture.MP4?sig=1")
    assert not is_direct_media("https://www.youtube.com/watch?v=abc")


def test_parse_timestamp():
    assert parse_timestamp("1:05") == 65
    assert parse_timestamp("[01:02:03]") == 3723
    assert parse_timestamp(90) == 90
    assert parse_timestamp("soon") is None
    assert parse_timestamp(None) is None
    assert CornellNote(cue="c", note="n", start="2:00").start == 120


def test_chunk_lines_keeps_lines_whole_with_overlap():
    lines = [f"[0:{i:02d}] " + " ".join(["w"] * 10) for i in range(20)]  # 11 words each
    chunks = chunk_lines(lines, chunk_words=50, overlap_words=12)
    assert all(c.split("\n")[0].startswith("[") for c in chunks)
    assert chunks[0].split("\n")[-1] in chunks[1]
    assert chunks[-1].endswith(lines[-1])
    assert chunk_lines([]) == []


def test_transcript_marked_lines():
    t = Transcript(segments=[TranscriptSegment(start=65, end=70, text="hi"), TranscriptSegment(start=3725, end=3730, text="late")])
    assert t.marked_lines() == ["[1:05] hi", "[1:02:05] late"]


def test_anki_export_escapes_and_includes_mcqs(sample_notes):
    sample_notes["cornell_notes"][0]["note"] = "a\tb <i>\nline2"
    out = notes_to_anki(NotesOutput.model_validate(sample_notes))
    row = [l for l in out.splitlines() if l.startswith("What is a memory palace?")][0]
    assert row.split("\t")[1].startswith("a b &lt;i&gt;<br>line2")
    assert "A. Palace<br>B. Chair" in out


def test_format_progress_uses_raw_numbers_not_ansi_strings():
    d = {"downloaded_bytes": 5 * 1_048_576, "total_bytes": 10 * 1_048_576, "eta": 75,
         "_percent_str": "\x1b[0;94m 50.0%\x1b[0m", "_eta_str": "\x1b[0;33m01:15\x1b[0m"}
    assert format_progress(d) == "Downloading 50% (5.0 / 10.0 MB) · 1m 15s left"
    assert format_progress({"downloaded_bytes": 1_048_576}) == "Downloading 1.0 MB"
    assert format_progress({"downloaded_bytes": 0, "total_bytes_estimate": 2 * 1_048_576, "eta": 5}) == "Downloading 0% (0.0 / 2.0 MB) · 5s left"
