# Lecture to Notes

Upload a lecture recording **or paste a link** (YouTube, Vimeo, most lecture platforms, or a direct media URL) and get a **Cornell notes sheet** where every cue links back to the moment it was taught, a **summary**, a **practice quiz**, a searchable **transcript**, and an **"Ask the lecture"** chat — exportable as Markdown, PDF, or Anki flashcards.

```
 lecture.mp4 ─┐
              ├─▶ ffmpeg ──▶ 16 kHz WAV ──▶ Whisper (10-min pieces) ──▶ timestamped transcript
 YouTube URL ─┘ (yt-dlp, audio only)                                          │
                                                          chunks with [m:ss] markers, 3 in parallel
                                                                               │
                                                               Gemini (JSON mode, model fallback)
                                                                               │
                                                     pydantic-validated notes.json (cue → start time)
                                                                               │
                                        React UI: Cornell sheet + player · transcript · ask · quiz · exports
```

| Layer | Stack |
|---|---|
| Ingestion | file upload, or [yt-dlp](https://github.com/yt-dlp/yt-dlp) fetching the audio-only stream from a link (public addresses only) |
| Transcription | ffmpeg, [openai-whisper](https://github.com/openai/whisper) (`base`, CPU), long files in 10-minute pieces |
| Notes / Q&A | Gemini via `google-genai`, pydantic v2 validation, retry + sticky model fallback |
| API | FastAPI, SQLite + SQLAlchemy, email/password accounts (scrypt + JWT), single-worker background thread |
| Frontend | React 19, Vite, Tailwind v4, react-dropzone, axios |
| Deploy | Docker → Render (backend), Vercel (frontend) |

## Features

- **Cornell sheet** with a contents rail and **recall mode** (notes hidden until you tap — the Cornell self-test step).
- **Jump to the moment**: each cue has a `▶ 12:05` chip that seeks the embedded YouTube video, or the stored audio for uploads.
- **Transcript tab** with search and clickable timestamps.
- **Ask the lecture**: questions answered only from the transcript, with links to the supporting moments.
- **Quiz** with keyboard controls, options reshuffled every round, missed-question review and "retry the ones I missed".
- **Exports**: Markdown, print-to-PDF, and Anki (`File → Import` picks up deck and columns automatically).
- **Accounts**: every lecture is private to its owner. The first account created also claims any lectures made before accounts existed.
- **Cancel** a lecture at any stage; **housekeeping** deletes the original upload once transcribed and removes lectures after `RETENTION_DAYS`.

## Run locally

Prerequisites: Python 3.12+, Node 20+, `ffmpeg` on PATH (`brew install ffmpeg`), a Gemini API key.

```bash
# backend
cd backend
python -m venv ../.venv && source ../.venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env          # put your GEMINI_API_KEY in it
uvicorn app.main:app --reload --port 8000

# frontend (another terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 → create an account on the landing page
```

Pipeline only, no server:

```bash
cd backend
python cli.py ../../cfavid.mp4 -o ../outputs        # → outputs/transcript.json, notes.json, notes.md
python cli.py x -o ../outputs --from-transcript     # re-run just the LLM stage
```

Tests (`cd backend && pytest`): 45 tests, pipeline stages mocked — no ffmpeg, Whisper, network or API key needed.

## API

All routes except `/health`, `/auth/*` and `/media/*` need `Authorization: Bearer <token>`. Other users' lectures return 404.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/signup`, `/auth/login` | `{email, password}` → `{token, user}` (throttled per IP) |
| `GET` | `/auth/me` | current user |
| `POST` | `/upload` | multipart `file` → 202 job; 415 unsupported, 400 empty, 413 too big, 429 too many active jobs |
| `POST` | `/upload-url` | `{url}` → 202 job; 400 for non-public / non-http(s) links |
| `GET` | `/status/{id}` | `queued → [downloading →] transcribing → processing → done \| error \| cancelled`, plus `stage` text |
| `POST` | `/jobs/{id}/cancel` | stop a queued or running lecture |
| `GET` / `DELETE` | `/jobs`, `/jobs/{id}` | your library / delete (stops it first if running) |
| `GET` | `/notes/{id}` · `/notes/{id}/markdown` · `/notes/{id}/anki` | notes JSON and exports |
| `GET` | `/transcript/{id}` | timestamped segments |
| `POST` | `/ask/{id}` | `{question, history}` → `{answer, timestamps}` |
| `GET` | `/media-token/{id}` → `/media/{id}?token=` | short-lived, lecture-scoped URL for the audio player (supports Range) |

Notes schema (`backend/app/pipeline/schema.py`):

```json
{
  "topic": "string",
  "summary": "string",
  "cornell_notes": [{ "cue": "string", "note": "string", "start": 74.0 }],
  "mcqs": [{ "question": "string", "options": ["A", "B", "C", "D"], "answer": "exact option text" }]
}
```

## Configuration (`backend/.env`)

| Var | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | — | required |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | primary model |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.5-flash` | tried when the primary fails; the last model that worked is tried first next time |
| `WHISPER_MODEL` | `base` | `tiny`/`base`/`small`/`medium` |
| `JWT_SECRET` | auto-generated into `DATA_DIR/.jwt_secret` | **set this in production** |
| `TOKEN_TTL_HOURS` | `336` | sign-in lifetime |
| `ALLOW_SIGNUP` | `true` | set `false` to close registration |
| `RETENTION_DAYS` | `30` | delete lectures older than this (`0` = never) |
| `MAX_ACTIVE_JOBS_PER_USER` | `3` | in-flight lectures per account |
| `MAX_UPLOAD_MB` | `500` | caps uploads and link downloads |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | frontend origins |
| `DATA_DIR` | `backend/data` | uploads, outputs, `jobs.db`, JWT secret |

Frontend: `VITE_API_URL` (default `http://localhost:8000`).

## Security notes

- Link downloads: only `http(s)` on ports 80/443, hostnames must resolve to public IPs (blocks localhost, LAN, cloud metadata), yt-dlp is limited to its known-site extractors, and direct media links have every redirect hop validated. DNS rebinding between the check and the fetch is still theoretically possible; run the backend without access to sensitive internal services.
- Passwords are hashed with scrypt; tokens are HS256 JWTs. Login/signup are rate-limited in memory (per process).
- Tokens live in `localStorage`, so keep the frontend free of third-party scripts.

## Deploy

- **Backend → Render**: `render.yaml` defines a Docker web service with a disk at `/data`. Set `GEMINI_API_KEY`, `JWT_SECRET` and `CORS_ORIGINS` (your Vercel URL). Whisper needs more than the free tier's 512 MB RAM.
- **Frontend → Vercel**: root directory `frontend`, env `VITE_API_URL=https://<your-render-service>.onrender.com`.

## Project layout

```
backend/
  app/main.py            routes          app/auth.py    accounts, JWT, throttle
  app/jobs.py            worker, cancel, cleanup, retention sweep
  app/db.py              User + Job models, tiny column migration
  app/pipeline/          download → audio → transcribe → chunking → notes / ask (llm.py) → export
  cli.py                 run the pipeline on one file
  tests/                 pytest (pipeline + API)
frontend/src/
  App.jsx                auth + job state machine, #job=<id> deep links
  components/            Landing, AuthCard, IntakeCard, ProcessingView, NotesView, Player,
                         TranscriptPanel, AskPanel, QuizModal, Library, Nav
```

## License

[MIT](LICENSE) © 2026 Shravan Kishore
