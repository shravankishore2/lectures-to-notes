import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env (and fall back to CWD .env) so the CLI, tests, and server all see the same vars.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data")).resolve()
UPLOADS_DIR = DATA_DIR / "uploads"
OUTPUTS_DIR = DATA_DIR / "outputs"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'jobs.db'}")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()]
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "500"))

# --- auth
JWT_SECRET = os.getenv("JWT_SECRET")  # if unset, a random secret is generated once and stored in DATA_DIR
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", str(24 * 14)))
ALLOW_SIGNUP = os.getenv("ALLOW_SIGNUP", "true").lower() in ("1", "true", "yes")

# --- housekeeping
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS", "30"))  # delete lectures older than this; 0 = keep forever
MAX_ACTIVE_JOBS_PER_USER = int(os.getenv("MAX_ACTIVE_JOBS_PER_USER", "3"))
