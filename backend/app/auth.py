"""Email + password accounts with stateless JWT bearer tokens.

Passwords are hashed with stdlib scrypt (no native deps). Media URLs can't carry an Authorization header
(<audio src>), so they get a short-lived, job-scoped token in the query string instead.
"""

import base64
import hashlib
import hmac
import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select

from . import config
from .db import Job, User, get_session

ALGORITHM = "HS256"
MEDIA_TOKEN_TTL = timedelta(hours=6)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD = 8

_bearer = HTTPBearer(auto_error=False)
_secret_cache: str | None = None


# ---------------------------------------------------------------- passwords

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_b64, dk_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(dk_b64)
    except ValueError:
        return False
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=len(expected))
    return hmac.compare_digest(dk, expected)


# ---------------------------------------------------------------- tokens

def _secret() -> str:
    global _secret_cache
    if config.JWT_SECRET:
        return config.JWT_SECRET
    if _secret_cache:
        return _secret_cache
    path = config.DATA_DIR / ".jwt_secret"
    if not path.exists():
        config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(secrets.token_urlsafe(48))
        path.chmod(0o600)
    _secret_cache = path.read_text().strip()
    return _secret_cache


def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "typ": "access", "iat": now, "exp": now + timedelta(hours=config.TOKEN_TTL_HOURS)}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def create_media_token(user_id: str, job_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "typ": "media", "job": job_id, "iat": now, "exp": now + MEDIA_TOKEN_TTL}
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def _decode(token: str, typ: str) -> dict:
    try:
        data = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.") from e
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=401, detail="Invalid credentials") from e
    if data.get("typ") != typ:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return data


def verify_media_token(token: str, job_id: str) -> str:
    data = _decode(token, "media")
    if data.get("job") != job_id:
        raise HTTPException(status_code=403, detail="Token is not valid for this lecture")
    return data["sub"]


# ---------------------------------------------------------------- dependencies

def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    data = _decode(creds.credentials, "access")
    with get_session() as s:
        user = s.get(User, data.get("sub"))
    if user is None:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    return user


# ---------------------------------------------------------------- signup / login

def normalise_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return email


def signup(email: str, password: str) -> User:
    if not config.ALLOW_SIGNUP:
        raise HTTPException(status_code=403, detail="Sign-ups are closed on this server")
    email = normalise_email(email)
    if len(password or "") < MIN_PASSWORD:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD} characters")
    if len(password) > 256:
        raise HTTPException(status_code=400, detail="Password is too long")
    with get_session() as s:
        if s.scalar(select(User).where(User.email == email)):
            raise HTTPException(status_code=409, detail="An account with that email already exists")
        first_user = s.scalar(select(func.count()).select_from(User)) == 0
        user = User(email=email, password_hash=hash_password(password))
        s.add(user)
        s.flush()
        if first_user:
            # Lectures processed before accounts existed belong to whoever sets the server up.
            for job in s.scalars(select(Job).where(Job.user_id.is_(None))):
                job.user_id = user.id
        s.commit()
        return user


def login(email: str, password: str) -> User:
    email = (email or "").strip().lower()
    with get_session() as s:
        user = s.scalar(select(User).where(User.email == email))
    # Always run a hash so response time doesn't reveal whether the email exists.
    ok = verify_password(password or "", user.password_hash if user else hash_password("x" * 12))
    if not user or not ok:
        raise HTTPException(status_code=401, detail="Wrong email or password")
    return user


# ---------------------------------------------------------------- brute-force throttle

_attempts: dict[str, deque] = defaultdict(deque)
WINDOW_SECONDS = 600
MAX_ATTEMPTS = 10


def throttle(request: Request, bucket: str, limit: int = MAX_ATTEMPTS):
    """In-memory sliding window per client IP. Good enough for one process; use a shared store if you scale out."""
    key = f"{bucket}:{request.client.host if request.client else '?'}"
    now = time.monotonic()
    q = _attempts[key]
    while q and now - q[0] > WINDOW_SECONDS:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again in a few minutes.")
    q.append(now)
