#!/usr/bin/env bash
# Run the real pipeline on demo lectures, timing each, with the transcript corrections from
# prompts.json (Whisper writes spoken course numbers as integers: "804" for 8.04).
# WHISPER_PROMPT=1 also passes each lecture's initial_prompt. Off by default: measured 2026-10-07
# against MIT's captions it raised base's word error rate (8.04: 10.1% -> 13.0%, 6.006: 7.4% -> 11.7%)
# and cut its segment count 3-4x, while not fixing the course numbers.
#   demo/process.sh <media_dir> <runs_dir> <whisper_model> <slug>...
#   e.g. demo/process.sh ~/lectures /tmp/runs base qp1 alg1 la1   (expects <media_dir>/<slug>.mp4)
# Appends "<slug> rc=<rc> seconds=<s> model=<m>" to <runs_dir>/timings.txt for demo/build_data.py.
set -uo pipefail
media=$(cd "$1" && pwd); runs=$(mkdir -p "$2" && cd "$2" && pwd); model=$3; shift 3
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/backend"
for slug in "$@"; do
  hints=$(../.venv/bin/python -c 'import json,sys; print(json.dumps(json.load(open(sys.argv[1]))[sys.argv[2]]))' "$root/demo/prompts.json" "$slug")
  prompt=$(../.venv/bin/python -c 'import json,sys; print(json.loads(sys.argv[1])["prompt"])' "$hints")
  corrections=()
  while IFS= read -r c; do [ -n "$c" ] && corrections+=(--correct "$c"); done < <(../.venv/bin/python -c 'import json,sys; [print(f"{k}={v}") for k, v in json.loads(sys.argv[1]).get("corrections", {}).items()]' "$hints")
  start=$(date +%s)
  prompt_args=()
  [ "${WHISPER_PROMPT:-0}" = 1 ] && prompt_args=(--initial-prompt "$prompt")
  ../.venv/bin/python -u cli.py "$media/$slug.mp4" -o "$runs/$slug" --whisper-model "$model" ${prompt_args[@]+"${prompt_args[@]}"} ${corrections[@]+"${corrections[@]}"} > "$runs/$slug.log" 2>&1
  rc=$?
  echo "$slug rc=$rc seconds=$(( $(date +%s) - start )) model=$model prompt=${WHISPER_PROMPT:-0}" | tee -a "$runs/timings.txt"
done
