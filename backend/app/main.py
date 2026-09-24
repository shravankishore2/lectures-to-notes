import json
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from . import auth, config, jobs
from .db import ACTIVE, TERMINAL, Job, JobStatus, User, get_session, init_db
from .pipeline import AskTurn, DownloadError, NotesOutput, Transcript, answer_question, notes_to_anki, notes_to_markdown, validate_url
from .pipeline.audio import SUPPORTED_EXTENSIONS
from .pipeline.download import youtube_id
from .pipeline.llm import LLMError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)

UPLOAD_CHUNK = 1024 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    jobs.start_worker()
    yield
    jobs.stop_worker()


app = FastAPI(title="Lecture to Notes", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server."})


CurrentUser = Depends(auth.current_user)


# ---------------------------------------------------------------- helpers

def _get_job(job_id: str, user: User) -> Job:
    with get_session() as s:
        job = s.get(Job, job_id)
    # Someone else's lecture is indistinguishable from a missing one.
    if job is None or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return job


def _require_done(job: Job) -> None:
    if job.status == JobStatus.ERROR:
        raise HTTPException(status_code=409, detail=f"Job failed: {job.error}")
    if job.status != JobStatus.DONE:
        raise HTTPException(status_code=409, detail=f"Job is not finished yet (status: {job.status})")


def _require_capacity(user: User) -> None:
    with get_session() as s:
        active = s.scalar(select(func.count()).select_from(Job).where(Job.user_id == user.id, Job.status.in_(list(ACTIVE))))
    if active >= config.MAX_ACTIVE_JOBS_PER_USER:
        raise HTTPException(
            status_code=429,
            detail=f"You already have {active} lectures in progress. Wait for one to finish or cancel it.",
        )


def _load_notes(job_id: str) -> NotesOutput:
    path = jobs.notes_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Notes file missing for this lecture")
    return NotesOutput.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _load_transcript(job_id: str) -> Transcript:
    path = jobs.transcript_path(job_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Transcript missing for this lecture")
    return Transcript.model_validate_json(path.read_text(encoding="utf-8"))


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "notes"


def _job_payload(job: Job) -> dict:
    data = job.to_dict()
    data["youtube_id"] = youtube_id(job.source_url) if job.source_url else None
    return data


# ---------------------------------------------------------------- meta + auth

@app.get("/health")
def health():
    return {"status": "ok", "whisper_model": config.WHISPER_MODEL, "signup_open": config.ALLOW_SIGNUP}


class Credentials(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=256)


@app.post("/auth/signup", status_code=201)
def signup(body: Credentials, request: Request):
    auth.throttle(request, "signup")
    user = auth.signup(body.email, body.password)
    return {"token": auth.create_token(user.id), "user": user.to_dict()}


@app.post("/auth/login")
def login(body: Credentials, request: Request):
    auth.throttle(request, "login")
    user = auth.login(body.email, body.password)
    return {"token": auth.create_token(user.id), "user": user.to_dict()}


@app.get("/auth/me")
def me(user: User = CurrentUser):
    return user.to_dict()


# ---------------------------------------------------------------- create jobs

@app.post("/upload", status_code=202)
async def upload(file: UploadFile, user: User = CurrentUser):
    filename = Path(file.filename or "upload").name[:255]
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext or 'none'}'. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )
    _require_capacity(user)

    with get_session() as s:
        job = Job(filename=filename, user_id=user.id)
        s.add(job)
        s.commit()
        job_id = job.id

    dest = jobs.upload_path(job_id, filename)
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    written = 0

    def discard():
        dest.unlink(missing_ok=True)
        with get_session() as s:
            s.delete(s.get(Job, job_id))
            s.commit()

    try:
        with dest.open("wb") as f:
            while chunk := await file.read(UPLOAD_CHUNK):
                written += len(chunk)
                if written > limit:
                    raise HTTPException(status_code=413, detail=f"File exceeds {config.MAX_UPLOAD_MB} MB limit")
                f.write(chunk)
    except BaseException:
        discard()
        raise
    finally:
        await file.close()

    if written == 0:
        discard()
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    jobs.enqueue(job_id)
    with get_session() as s:
        return _job_payload(s.get(Job, job_id))


class UrlUpload(BaseModel):
    url: str = Field(max_length=2048)


@app.post("/upload-url", status_code=202)
def upload_url(body: UrlUpload, user: User = CurrentUser):
    """Queue a lecture from a link (YouTube, most lecture sites, or a direct media URL). Download happens in the worker."""
    try:
        url = validate_url(body.url)
    except DownloadError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    _require_capacity(user)

    with get_session() as s:
        job = Job(filename=url[:255], source_url=url, user_id=user.id)  # filename becomes the media title once downloaded
        s.add(job)
        s.commit()
        job_id = job.id

    jobs.enqueue(job_id)
    with get_session() as s:
        return _job_payload(s.get(Job, job_id))


# ---------------------------------------------------------------- read / manage jobs

@app.get("/status/{job_id}")
def status(job_id: str, user: User = CurrentUser):
    return _job_payload(_get_job(job_id, user))


@app.get("/jobs")
def list_jobs(limit: int = 50, user: User = CurrentUser):
    with get_session() as s:
        rows = s.scalars(
            select(Job).where(Job.user_id == user.id).order_by(Job.created_at.desc()).limit(max(1, min(limit, 200)))
        ).all()
    return [_job_payload(j) for j in rows]


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    if job.status in TERMINAL:
        raise HTTPException(status_code=409, detail=f"This lecture has already {'finished' if job.status == JobStatus.DONE else 'stopped'}")
    jobs.request_cancel(job_id)
    return _job_payload(_get_job(job_id, user))


@app.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    running = job.status in ACTIVE
    if running:
        jobs.request_cancel(job_id)
    with get_session() as s:
        s.delete(s.get(Job, job_id))
        s.commit()
    if not running:  # a running job's worker cleans up its own files once it notices the row is gone
        jobs.delete_job_files(job_id)


# ---------------------------------------------------------------- outputs

@app.get("/notes/{job_id}")
def notes(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    _require_done(job)
    return _load_notes(job_id).model_dump()


@app.get("/notes/{job_id}/markdown")
def notes_markdown(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    _require_done(job)
    n = _load_notes(job_id)
    return PlainTextResponse(
        notes_to_markdown(n),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_slug(n.topic)}.md"'},
    )


@app.get("/notes/{job_id}/anki")
def notes_anki(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    _require_done(job)
    n = _load_notes(job_id)
    return PlainTextResponse(
        notes_to_anki(n),
        media_type="text/tab-separated-values; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_slug(n.topic)}-anki.txt"'},
    )


@app.get("/transcript/{job_id}")
def transcript(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    if job.status in (JobStatus.QUEUED, JobStatus.DOWNLOADING, JobStatus.TRANSCRIBING):
        raise HTTPException(status_code=409, detail="Transcript not ready yet")
    return _load_transcript(job_id).model_dump()


class AskBody(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    history: list[AskTurn] = Field(default_factory=list, max_length=20)


@app.post("/ask/{job_id}")
def ask(job_id: str, body: AskBody, request: Request, user: User = CurrentUser):
    auth.throttle(request, f"ask:{user.id}", limit=40)
    job = _get_job(job_id, user)
    _require_done(job)
    try:
        result = answer_question(_load_transcript(job_id), job.topic or job.filename, body.question, body.history)
    except LLMError as e:
        log.warning("ask failed for %s: %s", job_id, e)
        raise HTTPException(status_code=503, detail="The AI model is busy right now. Try again in a moment.") from e
    return result.model_dump()


@app.get("/media-token/{job_id}")
def media_token(job_id: str, user: User = CurrentUser):
    job = _get_job(job_id, user)
    if not job.has_audio or not jobs.audio_path(job_id).exists():
        raise HTTPException(status_code=404, detail="No audio kept for this lecture")
    return {"url": f"/media/{job_id}?token={auth.create_media_token(user.id, job_id)}"}


@app.get("/media/{job_id}")
def media(job_id: str, token: str):
    """Audio for the in-page player. Auth is a short-lived job-scoped token because <audio src> can't send headers."""
    user_id = auth.verify_media_token(token, job_id)
    with get_session() as s:
        job = s.get(Job, job_id)
    path = jobs.audio_path(job_id)
    if job is None or job.user_id != user_id or not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="audio/mp4", headers={"Cache-Control": "private, max-age=3600"})
