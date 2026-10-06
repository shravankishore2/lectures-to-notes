# Read-only demo

A static gallery of three MIT OpenCourseWare lectures (CC BY-NC-SA 4.0) processed once with the
real pipeline, served by Caddy on the Oracle VM at `https://notes.68-233-96-25.sslip.io/guest?k=<key>`.
No app process runs on the server.

| File | Purpose |
|---|---|
| `build_data.py` | CLI outputs (`<runs>/<slug>/{transcript,notes}.json` + `timings.txt`) → `frontend/src/demo/data/<slug>.json` |
| `Caddyfile.notes` | the site block appended to `/etc/caddy/Caddyfile` on the VM |
| `guest.py` | runs on the VM: `rotate` / `show` / `off` for the guest key |
| `deploy.sh` | build the single-file page and copy it (plus `guest.py`) to the VM |

## Regenerate the lectures

Sources are the archive.org links on each OCW lecture page (see `frontend/src/demo/lectures.js`):

```bash
cd backend
for n in qp1 alg1 la1; do
  start=$(date +%s)
  ../.venv/bin/python cli.py /path/to/$n.mp4 -o /tmp/runs/$n
  echo "$n rc=$? seconds=$(( $(date +%s) - start ))" >> /tmp/runs/timings.txt
done
cd .. && .venv/bin/python demo/build_data.py /tmp/runs --whisper-model base
```

## First-time VM setup (already done 2026-10-07)

```bash
sudo mkdir -p /srv/l2n-demo && sudo chown ubuntu:ubuntu /srv/l2n-demo
mkdir -p ~/lectures-to-notes-demo
printf '@guest expression false\n' > /tmp/g && sudo install -o root -g caddy -m 640 /tmp/g /etc/caddy/l2n-guest.caddy
sudo cp -p /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-before-notes-demo
sudo tee -a /etc/caddy/Caddyfile < Caddyfile.notes      # (copied over with scp)
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy
```

Then from the laptop `demo/deploy.sh`, and on the VM `cd ~/lectures-to-notes-demo && python3 guest.py rotate`.

## Guest key

```bash
ssh oracle 'cd ~/lectures-to-notes-demo && python3 guest.py rotate'   # new link; the old one 404s
ssh oracle 'cd ~/lectures-to-notes-demo && python3 guest.py show'
ssh oracle 'cd ~/lectures-to-notes-demo && python3 guest.py off'      # /guest 404s until the next rotate
```

The key is kept in `~/.l2n_guest_key` (600) and `/etc/caddy/l2n-guest.caddy` (root:caddy 640).
`guest.py` validates the Caddy config before reloading and restores the previous key if validation
fails. After a rotate, update the "Live demo" link in the top-level README.

Caddy has no rate-limit module installed here, so unlike the ORBITAL guest view the demo is not
rate-limited. It is a single static file (gzipped by Caddy), so a request costs one file read.
