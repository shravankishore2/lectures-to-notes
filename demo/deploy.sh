#!/usr/bin/env bash
# Build the read-only demo and copy it to the VM (ssh host "oracle"). Caddy serves it as a static
# file, so updating the page needs no reload. First-time setup is in demo/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

(cd frontend && npm run build:demo)
printf 'User-agent: *\nDisallow: /\n' > frontend/dist-demo/robots.txt
scp -q frontend/dist-demo/index.html frontend/dist-demo/robots.txt oracle:/srv/l2n-demo/
scp -q demo/guest.py oracle:lectures-to-notes-demo/guest.py
echo "deployed $(du -h frontend/dist-demo/index.html | cut -f1) → https://notes.68-233-96-25.sslip.io/guest?k=…"
