import sys
import threading
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture
def sample_notes() -> dict:
    return {
        "topic": "Memory palaces",
        "summary": "One. Two. Three.",
        "cornell_notes": [{"cue": "What is a memory palace?", "note": "A spatial mnemonic.", "start": 12.0}],
        "mcqs": [
            {"question": "Which is a mnemonic?", "options": ["Palace", "Chair", "Cat", "Dog"], "answer": "Palace"},
        ],
    }


@pytest.fixture
def gate():
    """Tests can clear() this to make the fake transcriber block until set() — used to test cancelling a running job."""
    ev = threading.Event()
    ev.set()
    yield ev
    ev.set()


@pytest.fixture
def app_client(tmp_path, monkeypatch, sample_notes, gate):
    """Unauthenticated FastAPI test client with a temp data dir and the slow pipeline stages replaced by fakes."""
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.delenv("JWT_SECRET", raising=False)
    for m in [k for k in sys.modules if k == "app" or k.startswith("app.")]:
        del sys.modules[m]

    from app import config, jobs
    from app.pipeline import DownloadError, NotesOutput, Transcript, TranscriptSegment

    assert config.DATA_DIR == tmp_path.resolve()

    def fake_download(url, dest_stem, max_mb=None, on_progress=None):
        if "bad" in url:
            raise DownloadError("Unsupported URL: " + url)
        if on_progress:
            on_progress("Downloading 100%")
        path = Path(f"{dest_stem}.webm")
        path.write_bytes(b"webm")
        return path, "Great Lecture.webm"

    def fake_extract(src, dst):
        Path(dst).write_bytes(b"RIFF")
        return Path(dst)

    def fake_transcribe(wav, model_name="base", on_progress=None):
        gate.wait(5)
        return Transcript(language="en", duration=3.0, segments=[TranscriptSegment(start=0, end=3, text="hello world")])

    def fake_compress(wav, out):
        Path(out).write_bytes(b"m4a-bytes")
        return Path(out)

    def fake_generate(transcript, on_progress=None, **_):
        if on_progress:
            on_progress("Writing notes")
        return NotesOutput.model_validate(sample_notes)

    monkeypatch.setattr(jobs, "download_media", fake_download)
    monkeypatch.setattr(jobs, "extract_audio", fake_extract)
    monkeypatch.setattr(jobs, "transcribe", fake_transcribe)
    monkeypatch.setattr(jobs, "compress_audio", fake_compress)
    monkeypatch.setattr(jobs, "generate_notes", fake_generate)
    # Tests use example hostnames; skip real DNS in validate_url but keep the scheme/port checks.
    import app.main as main_mod
    from app.pipeline import download as dl

    monkeypatch.setattr(main_mod, "validate_url", lambda url: dl.validate_url(url, resolve=False))

    from fastapi.testclient import TestClient

    with TestClient(main_mod.app) as c:
        yield c


def _signup(c, email):
    r = c.post("/auth/signup", json={"email": email, "password": "correct horse"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def client(app_client):
    """Authenticated as alice@example.com."""
    app_client.headers.update(_signup(app_client, "alice@example.com"))
    return app_client


@pytest.fixture
def bob_headers(app_client):
    return _signup(app_client, "bob@example.com")
