# Tasks: history cleanup, fresh clone, Whisper prompts (2026-10-07)

- [x] 1. Mirror backups outside the project: `~/repo-backups/lectures-to-notes-2026-10-07/{local,github}-mirror.git` (both `main` = 09b1d83, fsck clean)
- [x] 2. Audit (GitHub mirror: 5 commits, 1 branch, 0 tags, 0 stash; local repo same + 1 unreachable blob = old render.yaml)
  - outputs/ ever committed: `outputs/notes.json`, `outputs/notes.md`, `outputs/transcript.json` (transcript + notes of the copyrighted third-party test video), added in bc8644c, removed in 09b1d83
  - other content from the copyrighted test videos: none. Only references: the test video's filename in a cli.py docstring / README / CLAUDE.md and a one-line description in CLAUDE.md (scrubbed in step 4); a made-up "Memory palaces" test fixture. No TED-Ed match anywhere
  - .db / real .env / audio / video ever committed: none (only `backend/.env.example`, `frontend/.env.example` templates)
  - emails: the personal Gmail address (2 case variants, 4 commits) and a laptop-hostname address (1 commit, git's fallback when no user.email is set); committer the same plus `noreply@github.com` (GitHub web UI)
  - new Gemini key: 0 hits in all objects of both mirrors and the local .git; in files only `backend/.env` (find+grep over project, backups, scratch, ~/.claude, ~/.zsh_history; ~47k files)
- [x] 3. gh: 0 stars, 0 forks, 0 watchers, 0 issues, 0 PRs, 0 releases, 0 tags, no Pages/Actions/deployments/commit comments. Traffic (14 d): 7 views (1 unique), **89 clones (62 unique)**
- [x] 4. filter-repo on `~/repo-backups/lectures-to-notes-2026-10-07/rewrite/clean` (clone of the GitHub mirror): `--invert-paths --path outputs/`, mailmap of all 3 identities → `218974830+shravankishore2@users.noreply.github.com`, plus `--replace-text` / `--replace-message` scrubbing the test video's filename and description. Verified over all 104 objects: 0 hits for either Gemini key, the pasted key, `gmail`, the hostname address, the test video's transcript text, its filename or course name, TED-Ed; 0 paths under outputs/; identities = noreply + GitHub web-flow only; final tree differs from 09b1d83 only in the scrubbed lines of CLAUDE.md and backend/cli.py. New HEAD f98c2a9
- [x] 5. Recommendation: (a) delete + recreate (0 stars/forks/issues/PRs/releases, so nothing is lost; deleting removes the old objects GitHub serves by SHA, which a force-push leaves reachable until Support purges them). Approved
- [x] 6. Deleted + recreated github.com/shravankishore2/lectures-to-notes (public), pushed clean main f98c2a9. Old SHAs bc8644c / c9f2a3d / 09b1d83 → "No commit found"; old raw outputs/transcript.json URL → 404. No commit hashes are cited in README / demo/ / CLAUDE.md, so nothing to update
- [x] 7. Old folder → `lec to notes proj/lectures-to-notes.moved-aside-2026-10-07` (not deleted). Fresh clone in ~/PycharmProjects/lectures-to-notes; copied only backend/.env (+ this TASKS.md). New .venv (Homebrew 3.13) + `npm ci`; `npm run build`, `npm run build:demo` and `demo/deploy.sh` all run in place (deployed hash = local hash); workaround removed from CLAUDE.md
- [x] 8. `initial_prompt` added to transcribe() (every piece), config `WHISPER_INITIAL_PROMPT`, CLI `--initial-prompt`, per lecture in demo/prompts.json (+2 tests). 8.04 re-run end to end on the new key: OK (9 end-to-end runs today, no auth errors)
  - [x] Prompt alone does NOT fix "804" (base and small, 4 prompt styles tested on the first 4 min) and raises base WER (8.04: 10.1% → 13.0%) with 3–4× fewer segments. Added whole-word transcript corrections (`cli.py --correct 804=8.04`, `apply_corrections`, +1 test); prompt is opt-in in demo/process.sh (`WHISPER_PROMPT=1`)
  - [x] Re-ran all three gallery lectures (base, corrections, no prompt); live page renders "8.04" on gallery / notes / transcript / quiz and "804" nowhere (checked rendered innerText in headless Chrome); other sites 200/302 before and after
  - [ ] Summary says "8.04": NOT met. No summary names the course number (Gemini just doesn't mention it); the notes and transcript do. Needs a decision (see report)
- [x] 9. 6.006 base (98 s, WER 7.4%) vs small (182 s, WER 6.5%) end to end, vs MIT's human captions; README table with visible differences

## Found along the way
- [x] My step-4 check printed the first 12 of 53 chars of the new Gemini key (and 12 of the revoked key) into the session log. Not usable alone; rotate anyway if you want zero exposure
- [x] BSD `grep -r` silently returns nothing on the repo root here (works on subdirs); use `find … | xargs grep` or `git grep` for scans
- [x] 62 unique cloners in 14 days: the old history has very likely been copied by scrapers already; a rewrite can't recall those copies
- [x] This Mac's resolver can't resolve notes.68-233-96-25.sslip.io (dig and the VM can); checked live with `curl --resolve` / Chrome `--host-resolver-rules`. Probably a stale negative DNS cache entry: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
- [x] Unpinned requirements: the fresh venv got torch 2.14.1 / google-genai 2.28.0 (old venv 2.12.0 / 2.17.0); 48 tests pass
- [x] The 6.006 lecture never says its course number, so its `6006` correction is a no-op (kept for completeness)
- [x] Claude memory for this project is keyed to the old path; sessions in ~/PycharmProjects/lectures-to-notes start without it
- [x] No git user.email was configured (repo or global), so git fell back to `<user>@<hostname>.local`. Set the noreply identity in this clone's local config
