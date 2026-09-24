"""Fetch a lecture from a URL (YouTube, most video/lecture sites, or a direct media link) via yt-dlp."""

import ipaddress
import logging
import socket
from collections.abc import Callable
from pathlib import Path
import urllib.parse
from urllib.parse import urlparse

log = logging.getLogger(__name__)

MAX_TITLE_LEN = 120
MAX_REDIRECTS = 5
MEDIA_EXTENSIONS = (".mp4", ".mp3", ".m4a", ".wav", ".webm", ".mov", ".mkv", ".ogg", ".opus", ".flac", ".aac")


class DownloadError(RuntimeError):
    pass


def validate_url(url: str, resolve: bool = True) -> str:
    """Reject anything that isn't a public http(s) URL.

    The server fetches these links itself, so without this check a user could make it request internal
    services (localhost admin ports, cloud metadata at 169.254.169.254, the LAN, ...).
    """
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise DownloadError("Enter a valid http(s) link")
    if parsed.username or parsed.password:
        raise DownloadError("Links with embedded credentials aren't allowed")
    try:
        port = parsed.port
    except ValueError as e:
        raise DownloadError("Invalid port in link") from e
    if port not in (None, 80, 443):
        raise DownloadError("Only standard web ports (80/443) are allowed")
    if resolve:
        _require_public_host(parsed.hostname)
    return url


def _require_public_host(host: str):
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError) as e:
        raise DownloadError(f"Couldn't find the site '{host}'") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global or ip.is_multicast:
            raise DownloadError("That link points to a private or local address, which isn't allowed")


def download_media(
    url: str,
    dest_stem: Path,
    max_mb: int | None = None,
    on_progress: Callable[[str], None] | None = None,
) -> tuple[Path, str]:
    """Download the best audio-only stream (or best available) to `<dest_stem>.<ext>`.

    Returns (path, display_name). We only need audio, so this is much smaller/faster than pulling video.
    """
    import yt_dlp  # lazy: heavy import, only needed for URL jobs

    report = on_progress or (lambda _m: None)
    dest_stem.parent.mkdir(parents=True, exist_ok=True)

    url = validate_url(url)  # re-check at download time: DNS may have changed since the job was queued
    direct = is_direct_media(url)
    if direct:
        url = resolve_redirects(url)

    def hook(d):
        if d.get("status") == "downloading":
            report(format_progress(d))
        elif d.get("status") == "finished":
            report("Download complete")

    opts = {
        "format": "bestaudio/best",
        "outtmpl": f"{dest_stem}.%(ext)s",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,  # we report progress via the hook; keep yt-dlp's own bar out of server logs
        "progress_hooks": [hook],
        "restrictfilenames": True,
        # Only known-site extractors (YouTube, Vimeo, ...). The generic extractor fetches arbitrary pages and
        # follows redirects, which would bypass validate_url; direct media links get their redirects checked above.
        "allowed_extractors": ["generic"] if direct else ["default", "-generic"],
    }
    if max_mb:
        opts["max_filesize"] = max_mb * 1024 * 1024

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            path = Path(ydl.prepare_filename(info))
    except yt_dlp.utils.DownloadError as e:
        msg = _clean_ytdlp_message(str(e))
        if "Unsupported URL" in msg or "No suitable extractor" in msg:
            msg = "That site isn't supported. Try a YouTube/Vimeo/lecture-platform link, or a direct link to an .mp4/.mp3 file."
        raise DownloadError(msg) from e

    if not path.exists():
        # e.g. max_filesize hit: yt-dlp skips silently
        raise DownloadError(f"Download failed or exceeded the {max_mb} MB limit")

    title = (info.get("title") or urlparse(url).netloc or "lecture")[:MAX_TITLE_LEN]
    return path, f"{title}{path.suffix}"


def is_direct_media(url: str) -> bool:
    return urlparse(url).path.lower().endswith(MEDIA_EXTENSIONS)


def resolve_redirects(url: str) -> str:
    """Follow redirects by hand, validating every hop, so a public link can't bounce us to an internal address."""
    import urllib.error
    import urllib.request

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    for _ in range(MAX_REDIRECTS + 1):
        validate_url(url)
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0 lecture-to-notes"})
        try:
            with opener.open(req, timeout=15):
                return url
        except urllib.error.HTTPError as e:
            location = e.headers.get("Location") if 300 <= e.code < 400 else None
            if not location:
                return url  # not a redirect (or HEAD unsupported) — let yt-dlp report any real error
            url = urllib.parse.urljoin(url, location)
        except urllib.error.URLError as e:
            raise DownloadError(f"Couldn't reach that link: {e.reason}") from e
    raise DownloadError("Too many redirects")


def format_progress(d: dict) -> str:
    """Build a plain-text progress line from yt-dlp's raw numbers.

    yt-dlp's `_percent_str` / `_eta_str` fields are pre-coloured with ANSI escape codes for terminals,
    so we never use them — only the numeric fields.
    """
    done = d.get("downloaded_bytes") or 0
    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
    parts = ["Downloading"]
    if total:
        parts.append(f"{done / total * 100:.0f}%")
        parts.append(f"({done / 1_048_576:.1f} / {total / 1_048_576:.1f} MB)")
    elif done:
        parts.append(f"{done / 1_048_576:.1f} MB")
    eta = d.get("eta")
    if isinstance(eta, (int, float)) and eta > 0:
        parts.append(f"· {int(eta // 60)}m {int(eta % 60):02d}s left" if eta >= 60 else f"· {int(eta)}s left")
    return " ".join(parts)


def _clean_ytdlp_message(msg: str) -> str:
    return msg.replace("ERROR: ", "").split("\n")[0]


def is_youtube(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")


def youtube_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host == "youtu.be":
        return parsed.path.strip("/").split("/")[0] or None
    if is_youtube(url):
        if parsed.path.startswith(("/shorts/", "/embed/", "/live/")):
            return parsed.path.split("/")[2] or None
        return urllib.parse.parse_qs(parsed.query).get("v", [None])[0]
    return None
