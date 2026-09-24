import time


def _wait(client, job_id, statuses=("done", "error", "cancelled"), timeout=5):
    deadline = time.time() + timeout
    body = None
    while time.time() < deadline:
        body = client.get(f"/status/{job_id}").json()
        if body["status"] in statuses:
            return body
        time.sleep(0.05)
    raise AssertionError(f"job {job_id} did not reach {statuses}: {body}")


def _upload(client, name="lecture.mp4", data=b"fake-bytes"):
    return client.post("/upload", files={"file": (name, data, "video/mp4")})


# ---------------------------------------------------------------- auth

def test_health_is_public(app_client):
    assert app_client.get("/health").json()["status"] == "ok"


def test_job_routes_require_auth(app_client):
    for method, path in [("get", "/jobs"), ("get", "/status/x"), ("post", "/upload-url"), ("get", "/notes/x")]:
        assert getattr(app_client, method)(path).status_code == 401, path


def test_signup_login_me(app_client):
    r = app_client.post("/auth/signup", json={"email": "  Carol@Example.com ", "password": "longenough"})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "carol@example.com"
    assert app_client.post("/auth/signup", json={"email": "carol@example.com", "password": "longenough"}).status_code == 409
    assert app_client.post("/auth/login", json={"email": "carol@example.com", "password": "wrong-pass"}).status_code == 401
    token = app_client.post("/auth/login", json={"email": "CAROL@example.com", "password": "longenough"}).json()["token"]
    assert app_client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["email"] == "carol@example.com"
    assert app_client.get("/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_signup_validation(app_client):
    assert app_client.post("/auth/signup", json={"email": "not-an-email", "password": "longenough"}).status_code == 400
    assert app_client.post("/auth/signup", json={"email": "d@example.com", "password": "short"}).status_code == 400


def test_login_is_throttled(app_client):
    codes = [app_client.post("/auth/login", json={"email": "x@example.com", "password": "nopenope"}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10
    assert codes[-1] == 429


def test_users_cannot_see_each_others_lectures(client, bob_headers):
    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id)
    assert client.get("/jobs").json()[0]["job_id"] == job_id
    assert client.get("/jobs", headers=bob_headers).json() == []
    for path in [f"/status/{job_id}", f"/notes/{job_id}", f"/transcript/{job_id}", f"/media-token/{job_id}"]:
        assert client.get(path, headers=bob_headers).status_code == 404, path
    assert client.delete(f"/jobs/{job_id}", headers=bob_headers).status_code == 404
    assert client.get(f"/status/{job_id}").status_code == 200


def test_timestamps_are_timezone_aware(client):
    job = _upload(client).json()
    assert job["created_at"].endswith("+00:00")


# ---------------------------------------------------------------- upload flows

def test_upload_rejects_unsupported_type(client):
    assert client.post("/upload", files={"file": ("notes.txt", b"hello", "text/plain")}).status_code == 415


def test_upload_rejects_empty_file(client):
    assert _upload(client, data=b"").status_code == 400
    assert client.get("/jobs").json() == []


def test_full_flow_and_cleanup(client, sample_notes, tmp_path):
    r = _upload(client)
    assert r.status_code == 202
    job_id = r.json()["job_id"]

    status = _wait(client, job_id)
    assert status["status"] == "done", status
    assert status["topic"] == "Memory palaces"
    assert status["has_audio"] is True

    assert client.get(f"/notes/{job_id}").json() == sample_notes

    md = client.get(f"/notes/{job_id}/markdown")
    assert md.status_code == 200 and md.text.startswith("# Memory palaces")
    assert "*(0:12)*" in md.text

    anki = client.get(f"/notes/{job_id}/anki")
    assert anki.status_code == 200
    assert "#separator:tab" in anki.text and "What is a memory palace?\tA spatial mnemonic." in anki.text

    assert client.get(f"/transcript/{job_id}").json()["segments"][0]["text"] == "hello world"

    # the original upload and working WAV are gone; transcript, notes and the compact audio remain
    assert list((tmp_path / "uploads").iterdir()) == []
    assert sorted(p.name for p in (tmp_path / "outputs" / job_id).iterdir()) == ["audio.m4a", "notes.json", "transcript.json"]

    assert client.delete(f"/jobs/{job_id}").status_code == 204
    assert client.get(f"/status/{job_id}").status_code == 404
    assert not (tmp_path / "outputs" / job_id).exists()


def test_media_requires_job_scoped_token(client, bob_headers):
    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id)
    url = client.get(f"/media-token/{job_id}").json()["url"]
    r = client.get(url, headers={"Authorization": ""})
    assert r.status_code == 200 and r.content == b"m4a-bytes"
    assert client.get(f"/media/{job_id}?token=nope").status_code == 401
    other = _upload(client).json()["job_id"]
    _wait(client, other)
    assert client.get(url.replace(job_id, other)).status_code == 403  # token is bound to one lecture


def test_upload_url_flow(client, sample_notes):
    r = client.post("/upload-url", json={"url": "https://www.youtube.com/watch?v=abc123"})
    assert r.status_code == 202, r.text
    assert r.json()["youtube_id"] == "abc123"
    status = _wait(client, r.json()["job_id"])
    assert status["status"] == "done", status
    assert status["filename"] == "Great Lecture.webm"
    assert status["has_audio"] is False  # YouTube lectures are played via embed, no local copy


def test_upload_url_download_error_lands_in_job(client):
    r = client.post("/upload-url", json={"url": "https://example.com/bad"})
    status = _wait(client, r.json()["job_id"])
    assert status["status"] == "error"
    assert "Unsupported URL" in status["error"]


def test_upload_url_rejects_non_http(client):
    for bad in ["ftp://x/y", "not a url", "http://example.com:8080/a.mp4", "http://u:p@example.com/a.mp4"]:
        assert client.post("/upload-url", json={"url": bad}).status_code == 400, bad


def test_active_job_limit(client, gate):
    gate.clear()  # hold the first job in "transcribing" so the others stay queued
    ids = [_upload(client).json()["job_id"] for _ in range(3)]
    r = _upload(client)
    assert r.status_code == 429
    gate.set()
    for i in ids:
        _wait(client, i)


# ---------------------------------------------------------------- cancel

def test_cancel_queued_job(client, gate):
    gate.clear()
    first = _upload(client).json()["job_id"]
    second = _upload(client).json()["job_id"]
    r = client.post(f"/jobs/{second}/cancel")
    assert r.json()["status"] == "cancelled"
    gate.set()
    assert _wait(client, first)["status"] == "done"
    assert client.get(f"/status/{second}").json()["status"] == "cancelled"


def test_cancel_running_job(client, gate, tmp_path):
    gate.clear()
    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id, statuses=("transcribing",))
    assert client.post(f"/jobs/{job_id}/cancel").json()["cancel_requested"] is True
    gate.set()
    assert _wait(client, job_id)["status"] == "cancelled"
    assert list((tmp_path / "uploads").iterdir()) == []
    assert client.post(f"/jobs/{job_id}/cancel").status_code == 409


def test_delete_running_job(client, gate, tmp_path):
    gate.clear()
    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id, statuses=("transcribing",))
    assert client.delete(f"/jobs/{job_id}").status_code == 204
    gate.set()
    deadline = time.time() + 5
    while (tmp_path / "outputs" / job_id).exists() and time.time() < deadline:
        time.sleep(0.05)
    assert not (tmp_path / "outputs" / job_id).exists()


def test_notes_on_failed_job_is_409(client, monkeypatch):
    from app import jobs

    monkeypatch.setattr(jobs, "transcribe", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("whisper exploded")))
    job_id = _upload(client).json()["job_id"]
    status = _wait(client, job_id)
    assert status["status"] == "error" and "whisper exploded" in status["error"]
    assert client.get(f"/notes/{job_id}").status_code == 409


def test_unknown_job_404(client):
    assert client.get("/status/nope").status_code == 404
    assert client.get("/notes/nope").status_code == 404


# ---------------------------------------------------------------- ask + retention

def test_ask(client, monkeypatch):
    import app.main as main_mod
    from app.pipeline import AskAnswer

    seen = {}

    def fake_answer(transcript, title, question, history):
        seen.update(title=title, question=question, turns=len(history))
        return AskAnswer(answer="Because of spatial memory.", timestamps=[1.0])

    monkeypatch.setattr(main_mod, "answer_question", fake_answer)
    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id)
    r = client.post(f"/ask/{job_id}", json={"question": "Why?", "history": [{"role": "user", "content": "hi"}]})
    assert r.json() == {"answer": "Because of spatial memory.", "timestamps": [1.0]}
    assert seen == {"title": "Memory palaces", "question": "Why?", "turns": 1}
    assert client.post(f"/ask/{job_id}", json={"question": ""}).status_code == 422


def test_retention_sweep(client, tmp_path):
    from datetime import datetime, timedelta, timezone

    from app import config, jobs

    job_id = _upload(client).json()["job_id"]
    _wait(client, job_id)
    (tmp_path / "outputs" / "orphan").mkdir()
    (tmp_path / "uploads" / "orphan.mp4").write_bytes(b"x")
    (tmp_path / "uploads" / f"{job_id}.webm").write_bytes(b"left over from an old version")

    assert jobs.sweep_expired() == 0  # fresh lecture survives, orphans don't
    assert not (tmp_path / "outputs" / "orphan").exists() and list((tmp_path / "uploads").iterdir()) == []
    assert (tmp_path / "outputs" / job_id / "notes.json").exists()

    future = datetime.now(timezone.utc) + timedelta(days=config.RETENTION_DAYS + 1)
    assert jobs.sweep_expired(now=future) == 1
    assert client.get(f"/status/{job_id}").status_code == 404
