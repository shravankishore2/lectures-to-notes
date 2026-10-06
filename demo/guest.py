"""
guest.py: the demo's guest link (/guest?k=<key>), run on the VM. The key is the only secret. It
lives in ~/.l2n_guest_key (mode 600) and in /etc/caddy/l2n-guest.caddy (root:caddy, mode 640),
outside the repo. Changing it reloads Caddy gracefully: no restart, other sites keep serving.

    python3 guest.py rotate     # new key (the old link stops working); prints the new link
    python3 guest.py show       # print the current link
    python3 guest.py off        # remove the key: /guest answers 404 until the next rotate
"""

import os
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path

KEY_FILE = Path(os.getenv("L2N_GUEST_KEY_FILE", "~/.l2n_guest_key")).expanduser()
SNIPPET = "/etc/caddy/l2n-guest.caddy"
CADDYFILE = "/etc/caddy/Caddyfile"
BASE_URL = os.getenv("L2N_PUBLIC_URL", "https://notes.68-233-96-25.sslip.io")


def link(key):
    return f"{BASE_URL}/guest?k={key}"


def install_matcher(body):
    """Write the @guest matcher for Caddy, validate the whole config, then reload (rolls back on failure)."""
    old = subprocess.run(["sudo", "cat", SNIPPET], capture_output=True, text=True).stdout
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write(body)
    try:
        subprocess.run(["sudo", "install", "-o", "root", "-g", "caddy", "-m", "640", f.name, SNIPPET], check=True)
    finally:
        os.unlink(f.name)
    ok = subprocess.run(["sudo", "caddy", "validate", "--config", CADDYFILE, "--adapter", "caddyfile"], capture_output=True).returncode == 0
    if not ok:
        subprocess.run(["sudo", "tee", SNIPPET], input=old, text=True, stdout=subprocess.DEVNULL, check=True)
        raise SystemExit("caddy validate failed; previous key restored")
    subprocess.run(["sudo", "systemctl", "reload", "caddy"], check=True)


def rotate():
    key = secrets.token_urlsafe(24)  # [A-Za-z0-9_-], safe inside a Caddyfile
    install_matcher(f"@guest {{\n\tpath /guest\n\tquery k={key}\n}}\n")
    tmp = KEY_FILE.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(key + "\n")
    os.replace(tmp, KEY_FILE)
    return key


def main(cmd):
    if cmd == "rotate":
        print(link(rotate()))
    elif cmd == "show":
        print(link(KEY_FILE.read_text().strip()) if KEY_FILE.exists() else "no guest key (python3 guest.py rotate)")
    elif cmd == "off":
        install_matcher("@guest expression false\n")
        KEY_FILE.unlink(missing_ok=True)
        print("guest view off")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
