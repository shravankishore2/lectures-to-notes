# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Lectures-to-Notes** — lecture audio/video (uploaded file or pasted link) → Cornell notes + summary + MCQ quiz. Full stack: Python/FastAPI backend with a Whisper + Gemini pipeline, React/Vite frontend. `README.md` has the architecture diagram, API table, and deploy steps; read it first.

The parent folder holds planning material: `../lecture_to_notes_detailed_roadmap.html` (original 5-phase plan) and `../cfavid.mp4`, a ~5 min CFA-ethics lecture used as the end-to-end test asset. All five roadmap phases are implemented except optional auth.

## Commands

The Python venv lives at the repo root (`.venv/`), shared by backend and CLI. Its `pip` shim is broken (venv was moved) — always use `python -m pip`.

```bash
# backend (run from backend/)
../.venv/bin/python -m pip install -r requirements-dev.txt
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
../.venv/bin/python -m pytest                 # 45 tests, ~3 s, no ffmpeg/Whisper/yt-dlp network/API key needed
../.venv/bin/python -m pytest tests/test_api.py::test_full_flow_and_cleanup   # single test

# pipeline without the server (from backend/)
../.venv/bin/python cli.py ../../cfavid.mp4 -o ../outputs
../.venv/bin/python cli.py x -o ../outputs --from-transcript      # skip ffmpeg+Whisper, re-run LLM only
../.venv/bin/python cli.py ../../cfavid.mp4 -o ../outputs --skip-llm   # stop after transcript

# frontend (run from frontend/)
npm install && npm run dev      # http://localhost:5173
npm run build                   # verifies the bundle compiles; no JS tests exist
```

`backend/.env` holds `GEMINI_API_KEY` (gitignored; template in `backend/.env.example`). `ffmpeg` must be on PATH.

## Architecture

**Pipeline** (`backend/app/pipeline/`) — pure functions, no FastAPI imports, so the CLI and the worker share them:
- `download.py` — yt-dlp, audio-only, size-capped. **SSRF guard**: `validate_url` (http(s), ports 80/443, no userinfo, host must resolve to global IPs) runs at submit *and* again at download; yt-dlp is restricted to `allowed_extractors=["default","-generic"]` except for direct media links (`is_direct_media`), whose redirects are followed by hand with every hop validated (`resolve_redirects`). Don't re-enable the generic extractor for arbitrary pages.
- `audio.py` — `extract_audio` (16 kHz WAV for Whisper), `compress_audio` (48 kbps AAC `audio.m4a` kept for playback).
- `transcribe.py` — Whisper, model cached; files longer than ~15 min are cut into 10-min pieces (`PIECE_SECONDS`) with offsets re-applied; `on_progress` is called between pieces and may raise (that's how cancel interrupts transcription).
- `chunking.py` — `chunk_lines` groups `Transcript.marked_lines()` ("[m:ss] text") without splitting lines, ~2250 words with overlap.
- `llm.py` — shared Gemini plumbing: `model_chain()` = `GEMINI_MODEL` + `GEMINI_FALLBACK_MODELS` with the **last model that answered moved to the front** (`_last_good`); `call()` tries each model once per pass, 2 passes; `generate_json()` re-prompts on invalid JSON. Default is `gemini-flash-lite-latest` because the flash tier 503s constantly on this key.
- `notes.py` — per-chunk calls run 3 at a time (`PARALLEL_CHUNKS`); `on_progress` is only called from the calling thread so it can raise to abort. Each cue gets `start` from the `[m:ss]` markers.
- `ask.py` — answers from the full marked transcript; returns `{answer, timestamps}`.
- `schema.py` — `NotesOutput` is the backend↔frontend contract; `CornellNote.start` is optional (older lectures lack it) and parsed by `parse_timestamp`. **The prompt in `notes.py` restates the schema; keep them in sync.**
- `export.py` — Markdown and Anki (tab-separated with `#separator/#html/#columns/#deck` headers, HTML-escaped).

**API + worker** (`backend/app/`):
- `auth.py` — scrypt password hashes, HS256 JWT (`typ: access`), plus job-scoped `typ: media` tokens for `/media/{id}?token=` because `<audio src>` can't send headers. Secret from `JWT_SECRET` or generated once into `DATA_DIR/.jwt_secret`. In-memory per-IP throttle for login/signup/ask. **The first account to sign up claims all jobs with `user_id IS NULL`** (pre-auth data).
- `main.py` — every job route depends on `current_user` and goes through `_get_job(job_id, user)`, which 404s for other users' jobs. Keep that pattern for new routes. `_require_capacity` caps active jobs per user.
- `jobs.py` — `ThreadPoolExecutor(max_workers=1)`. Cancel = `cancel_requested` flag checked by `_checkpoint()` between stages and inside every progress callback; queued jobs are cancelled immediately. A deleted row also counts as cancelled, and the worker removes its files. **Disk policy**: the source upload is deleted right after audio extraction, the WAV after transcription; kept per lecture: `transcript.json`, `notes.json`, and `audio.m4a` (not for YouTube, which is played via embed). `sweep_expired()` runs hourly: deletes lectures older than `RETENTION_DAYS`, orphan dirs, and any upload whose job isn't mid-download/transcription.
- `db.py` — `User`, `Job` (`user_id`, `cancel_requested`, `has_audio`). `_migrate()` adds new `jobs` columns to existing SQLite files. `iso()` stamps naive SQLite datetimes as UTC — use it for any datetime you serialise.
- `config.py` — all env-driven settings; loads `backend/.env`.

**Frontend** (`frontend/src/`):
- `App.jsx` owns auth + job state. Signed out → `Landing` shows `AuthCard`; signed in → `IntakeCard` + `Library`. In flight → `ProcessingView` (3 s polling, Cancel button, cancelled state); `done` → `NotesView` (+ `QuizModal`). `#job=<id>` deep-links (also on `hashchange`). Any 401 from a non-auth route clears the token and returns to sign-in (`setUnauthorizedHandler`).
- `lib/api.js` — axios with bearer token from `localStorage` (`l2n.token`); `downloadExport` fetches exports as blobs because plain links can't carry the token.
- `NotesView` — tabs Notes / Transcript (`TranscriptPanel`) / Ask (`AskPanel`, chat state lifted into NotesView so it survives tab switches); `Player` exposes `seek(t)` via ref: YouTube embed seeked with iframe `postMessage` (`enablejsapi=1`, no YT script), otherwise `<audio>` from the media token URL. Recall mode, contents rail, exports (MD / print-PDF / Anki).
- `QuizModal` reshuffles options every round (models bias the answer position).
- `lib/format.js` — `parseServerDate` (still tolerant of zone-less timestamps), `formatClock`, etc.
- Visual system in `index.css` `@theme` (paper/ink/margin-red/highlighter; Fraunces, Instrument Sans, IBM Plex Mono, Caveat via Google Fonts in `index.html`). Utilities: `.hl`, `.ruled` (pair with `leading-7`), `.hatch`, `.card-shadow`, `.rise`. `SamplePreview` is a static illustration.
- Sticky elements inside cards: don't put `overflow-hidden` on the card or it becomes the sticky container (this broke the transcript search bar once).
- PDF export is `window.print()`; Tailwind v4 via `@tailwindcss/vite`, no `tailwind.config.js`.

## Testing notes

`tests/conftest.py`: `app_client` is an unauthenticated `TestClient` with `DATA_DIR` in a tmp dir, the `app` package force-reloaded (so `config` sees the env — mind module-level state), and `jobs.download_media / extract_audio / transcribe / compress_audio / generate_notes` replaced by fakes (download raises `DownloadError` for URLs containing "bad"). `main.validate_url` is patched to skip DNS. `client` is signed in as alice; `bob_headers` is a second user for isolation tests. The `gate` fixture is a `threading.Event` the fake transcriber waits on — `gate.clear()` holds a job in `transcribing` to test cancel/limits.

**Browser testing without touching real data:** the first signup claims all existing lectures, so for manual/Chrome tests copy `backend/data` somewhere, run a second backend with `DATA_DIR=<copy> CORS_ORIGINS=http://localhost:5174 uvicorn app.main:app --port 8001` and `VITE_API_URL=http://localhost:8001 npx vite --port 5174`, create the account with curl, and set `localStorage["l2n.token"]`.

## Gotchas

- Gemini flash models return 503 "high demand" often; the fallback chain exists for this. If every model fails, check which respond with a tiny probe before changing defaults (`gemini-2.5-*` are retired → 404).
- Roadmap says Claude API + pydub; the implementation uses Gemini + raw ffmpeg. Follow the code.
- Whisper `base` on Apple Silicon CPU: ~1 min for the 5 min sample; budget ~10× real time is pessimistic, ~0.2× is typical.
- The Render free tier OOMs on Whisper; `render.yaml` pins the Starter plan.
- yt-dlp needs updating often (YouTube changes break old versions): `python -m pip install -U yt-dlp` is the first thing to try when link downloads start failing.
