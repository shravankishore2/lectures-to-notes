"""Background job runner: a single worker thread so Whisper and the LLM never run two lectures at once.

Disk policy: the original upload/download and the 16 kHz WAV are deleted as soon as they're no longer
needed (success, failure or cancel). What stays per lecture is outputs/<id>/{transcript.json, notes.json}
plus a small audio.m4a for in-app playback (skipped for YouTube, which is played via embed).
Lectures older than RETENTION_DAYS are removed entirely by a periodic sweep.
"""

import json
import logging
import shutil
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from . import config
from .db import TERMINAL, Job, JobStatus, get_session
from .pipeline import NotesOutput, Transcript, download_media, extract_audio, generate_notes, transcribe
from .pipeline.audio import compress_audio
from .pipeline.download import is_youtube

log = logging.getLogger(__name__)

SWEEP_INTERVAL_SECONDS = 3600

_executor: ThreadPoolExecutor | None = None
_sweeper_stop = threading.Event()


class JobCancelled(Exception):
    pass


# ---------------------------------------------------------------- lifecycle

def start_worker():
    global _executor
    _executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pipeline")
    with get_session() as s:
        # Anything mid-flight when the server last stopped can't be resumed; fail it loudly.
        stuck = s.scalars(select(Job).where(Job.status.in_([JobStatus.DOWNLOADING, JobStatus.TRANSCRIBING, JobStatus.PROCESSING]))).all()
        for job in stuck:
            job.status = JobStatus.ERROR
            job.error = "Server restarted while this job was running. Please re-upload."
        queued = s.scalars(select(Job).where(Job.status == JobStatus.QUEUED).order_by(Job.created_at)).all()
        queued_ids = [j.id for j in queued]
        s.commit()
    for job_id in queued_ids:
        enqueue(job_id)

    _sweeper_stop.clear()
    threading.Thread(target=_sweep_loop, name="retention-sweep", daemon=True).start()


def stop_worker():
    _sweeper_stop.set()
    if _executor:
        _executor.shutdown(wait=False, cancel_futures=True)


def enqueue(job_id: str):
    if _executor is None:
        raise RuntimeError("worker not started")
    _executor.submit(_run_safely, job_id)


# ---------------------------------------------------------------- paths

def job_dir(job_id: str) -> Path:
    return config.OUTPUTS_DIR / job_id


def upload_path(job_id: str, filename: str) -> Path:
    return config.UPLOADS_DIR / f"{job_id}{Path(filename).suffix.lower()}"


def notes_path(job_id: str) -> Path:
    return job_dir(job_id) / "notes.json"


def transcript_path(job_id: str) -> Path:
    return job_dir(job_id) / "transcript.json"


def audio_path(job_id: str) -> Path:
    return job_dir(job_id) / "audio.m4a"


def delete_source_files(job_id: str):
    """The original upload/download and the working WAV — large and only needed while processing."""
    for p in config.UPLOADS_DIR.glob(f"{job_id}.*"):
        p.unlink(missing_ok=True)
    (job_dir(job_id) / "audio.wav").unlink(missing_ok=True)


def delete_job_files(job_id: str, filename: str | None = None):
    delete_source_files(job_id)
    shutil.rmtree(job_dir(job_id), ignore_errors=True)


# ---------------------------------------------------------------- cancel

def request_cancel(job_id: str) -> str:
    """Queued jobs stop immediately; running jobs stop at the next checkpoint. Returns the resulting status."""
    with get_session() as s:
        job = s.get(Job, job_id)
        if job is None or job.status in TERMINAL:
            return job.status if job else JobStatus.CANCELLED
        job.cancel_requested = True
        if job.status == JobStatus.QUEUED:
            job.status = JobStatus.CANCELLED
            job.stage = None
        s.commit()
        status = job.status
    if status == JobStatus.CANCELLED:
        delete_source_files(job_id)
    return status


def _checkpoint(job_id: str):
    with get_session() as s:
        job = s.get(Job, job_id)
        if job is None or job.cancel_requested:
            raise JobCancelled()


# ---------------------------------------------------------------- run

def _update(job_id: str, **fields):
    with get_session() as s:
        job = s.get(Job, job_id)
        if job is None:
            return
        for k, v in fields.items():
            setattr(job, k, v)
        s.commit()


def _progress(job_id: str):
    def report(msg: str):
        _checkpoint(job_id)
        _update(job_id, stage=msg)

    return report


def _run_safely(job_id: str):
    try:
        _run(job_id)
    except JobCancelled:
        log.info("job %s cancelled", job_id)
        _update(job_id, status=JobStatus.CANCELLED, stage=None)
        delete_source_files(job_id)
    except Exception as e:  # noqa: BLE001 — any failure must land in the job row, not kill the worker
        with get_session() as s:
            job = s.get(Job, job_id)
            cancelled = job is None or bool(job.cancel_requested)
        if cancelled:  # e.g. yt-dlp wraps our cancel exception in its own error type
            _update(job_id, status=JobStatus.CANCELLED, stage=None)
        else:
            log.error("job %s failed: %s\n%s", job_id, e, traceback.format_exc())
            _update(job_id, status=JobStatus.ERROR, error=f"{type(e).__name__}: {e}", stage=None)
        delete_source_files(job_id)
    finally:
        with get_session() as s:
            if s.get(Job, job_id) is None:  # deleted while running
                delete_job_files(job_id)


def _run(job_id: str):
    with get_session() as s:
        job = s.get(Job, job_id)
        if job is None or job.status in TERMINAL:
            return
        filename = job.filename
        source_url = job.source_url
    report = _progress(job_id)
    _checkpoint(job_id)

    if source_url:
        _update(job_id, status=JobStatus.DOWNLOADING, stage="Fetching link")
        src, filename = download_media(source_url, config.UPLOADS_DIR / job_id, max_mb=config.MAX_UPLOAD_MB, on_progress=report)
        _update(job_id, filename=filename)  # now the real title + extension
    else:
        src = upload_path(job_id, filename)

    out = job_dir(job_id)
    out.mkdir(parents=True, exist_ok=True)

    _checkpoint(job_id)
    _update(job_id, status=JobStatus.TRANSCRIBING, stage="Extracting audio")
    wav = extract_audio(src, out / "audio.wav")
    src.unlink(missing_ok=True)

    report(f"Transcribing with Whisper ({config.WHISPER_MODEL})")
    transcript: Transcript = transcribe(wav, model_name=config.WHISPER_MODEL, on_progress=report)
    _checkpoint(job_id)
    transcript_path(job_id).write_text(transcript.model_dump_json(indent=2), encoding="utf-8")

    if not (source_url and is_youtube(source_url)):
        report("Saving a compact copy for playback")
        compress_audio(wav, audio_path(job_id))
        _update(job_id, has_audio=True)
    wav.unlink(missing_ok=True)

    _checkpoint(job_id)
    _update(job_id, status=JobStatus.PROCESSING, stage="Writing notes")
    notes: NotesOutput = generate_notes(transcript, on_progress=report)
    _checkpoint(job_id)
    notes_path(job_id).write_text(json.dumps(notes.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")

    _update(job_id, status=JobStatus.DONE, stage=None, topic=notes.topic)


# ---------------------------------------------------------------- retention

def sweep_expired(now: datetime | None = None) -> int:
    """Delete lectures past RETENTION_DAYS, plus any files on disk with no job row. Returns lectures removed."""
    removed = 0
    if config.RETENTION_DAYS > 0:
        cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=config.RETENTION_DAYS)
        with get_session() as s:
            old = s.scalars(select(Job).where(Job.created_at < cutoff, Job.status.in_(list(TERMINAL)))).all()
            for job in old:
                delete_job_files(job.id)
                s.delete(job)
                removed += 1
            s.commit()

    with get_session() as s:
        status_by_id = dict(s.execute(select(Job.id, Job.status)).all())
    for d in config.OUTPUTS_DIR.glob("*"):
        if d.is_dir() and d.name not in status_by_id:
            shutil.rmtree(d, ignore_errors=True)
        elif d.is_dir() and status_by_id[d.name] in TERMINAL:
            (d / "audio.wav").unlink(missing_ok=True)
    for f in config.UPLOADS_DIR.glob("*"):
        # uploads are only needed while a job is running (also cleans up lectures from before this policy existed)
        if f.is_file() and status_by_id.get(f.name.split(".")[0]) not in (JobStatus.QUEUED, JobStatus.DOWNLOADING, JobStatus.TRANSCRIBING):
            f.unlink(missing_ok=True)
    if removed:
        log.info("retention sweep removed %d lecture(s) older than %d days", removed, config.RETENTION_DAYS)
    return removed


def _sweep_loop():
    while not _sweeper_stop.is_set():
        try:
            sweep_expired()
        except Exception:  # noqa: BLE001
            log.exception("retention sweep failed")
        _sweeper_stop.wait(SWEEP_INTERVAL_SECONDS)
