"""Shared Gemini plumbing: client, model fallback chain, JSON-mode calls with retry."""

import json
import logging
import os
import re
import threading
import time

log = logging.getLogger(__name__)

# The flash tier is frequently overloaded (503) on free keys; the lite models are the ones that reliably answer.
DEFAULT_MODEL = "gemini-flash-lite-latest"
DEFAULT_FALLBACK_MODELS = "gemini-3.5-flash-lite,gemini-3.6-flash,gemini-3.5-flash"
MAX_JSON_ATTEMPTS = 2
TRANSIENT_STATUS = {429, 500, 502, 503, 504}
PASSES = 2  # walk the whole chain this many times before giving up
BACKOFF_SECONDS = 4

_last_good: str | None = None  # the model that most recently answered; tried first next time
_lock = threading.Lock()


class LLMError(RuntimeError):
    pass


def client():
    from google import genai  # lazy: keeps the CLI/tests importable without network deps configured

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise LLMError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def model_chain(primary: str | None = None) -> list[str]:
    primary = primary or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    fallbacks = [m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", DEFAULT_FALLBACK_MODELS).split(",") if m.strip()]
    chain = [primary] + [m for m in fallbacks if m != primary]
    with _lock:
        if _last_good in chain:
            chain.remove(_last_good)
            chain.insert(0, _last_good)
    return chain


def _remember(model: str):
    global _last_good
    with _lock:
        _last_good = model


def call(cl, models: list[str], prompt: str, temperature: float = 0.3) -> str:
    """One JSON-mode generate_content call. Tries each model once per pass; backs off between passes."""
    from google.genai import errors, types

    cfg = types.GenerateContentConfig(response_mime_type="application/json", temperature=temperature)
    last: Exception | None = None
    for attempt in range(PASSES):
        for model in models:
            try:
                response = cl.models.generate_content(model=model, contents=prompt, config=cfg)
                _remember(model)
                return response.text or ""
            except errors.APIError as e:
                last = e
                level = logging.INFO if e.code in TRANSIENT_STATUS else logging.WARNING
                log.log(level, "%s returned %s (%s); trying next model", model, e.code, (e.message or "")[:80])
        if attempt + 1 < PASSES:
            time.sleep(BACKOFF_SECONDS * (attempt + 1))
    raise LLMError(f"all models failed ({', '.join(models)}): {getattr(last, 'message', last)}") from last


def strip_fences(text: str) -> str:
    text = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    return m.group(1) if m else text


def generate_json(cl, models: list[str], prompt: str, temperature: float = 0.3) -> dict:
    last_error: Exception | None = None
    for _ in range(MAX_JSON_ATTEMPTS):
        text = call(cl, models, prompt, temperature)
        try:
            data = json.loads(strip_fences(text))
            if isinstance(data, dict):
                return data
            last_error = ValueError("top-level JSON value is not an object")
        except json.JSONDecodeError as e:
            last_error = e
        prompt = prompt + "\n\nYour previous reply was not a valid JSON object. Reply with a single valid JSON object only."
    raise LLMError(f"model did not return valid JSON after {MAX_JSON_ATTEMPTS} attempts: {last_error}")
