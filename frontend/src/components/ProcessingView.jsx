import { useEffect, useRef, useState } from "react";
import { formatElapsed, jobTitle, parseServerDate, sourceLabel } from "../lib/format";
import { CheckIcon, XIcon } from "./Icons.jsx";

const FILE_STEPS = [
  { key: "queued", label: "Received", detail: "Your recording is saved and waiting for the worker." },
  { key: "transcribing", label: "Transcribing", detail: "Whisper is turning speech into timestamped text." },
  { key: "processing", label: "Writing notes", detail: "Drafting cue questions, notes, a summary and a quiz." },
  { key: "done", label: "Ready", detail: "Opening your notes…" },
];
const LINK_STEPS = [
  { key: "queued", label: "Queued", detail: "Waiting for the worker." },
  { key: "downloading", label: "Fetching audio", detail: "Downloading just the audio track from the link." },
  ...FILE_STEPS.slice(1),
];

const TIPS = [
  "Cornell tip: after reading a cue, cover the notes and say the answer out loud before checking.",
  "Reviewing within 24 hours is when notes pay off the most — the forgetting curve is steepest early.",
  "Rewrite the summary in your own words. If you can't, that's the part to rewatch.",
  "Short on time? Do the quiz first, then read only the cues you got wrong.",
];

function Waveform({ active }) {
  return (
    <div className="flex h-16 items-center justify-between gap-[3px]" aria-hidden="true">
      {Array.from({ length: 72 }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] shrink-0 rounded-full ${active ? "wave-bar bg-blue/70" : "bg-ink/15"}`}
          style={{ height: `${20 + ((i * 37) % 44)}px`, animationDelay: `${(i % 11) * -0.1}s` }}
        />
      ))}
    </div>
  );
}

export default function ProcessingView({ job, onReset, onCancel }) {
  const steps = job.source_url ? LINK_STEPS : FILE_STEPS;
  const cancelled = job.status === "cancelled";
  const failed = job.status === "error" || cancelled;
  const stopping = !failed && job.cancel_requested;
  const [cancelBusy, setCancelBusy] = useState(false);
  const current = Math.max(0, steps.findIndex((s) => s.key === job.status));

  const mountedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (failed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const k = setInterval(() => setTip((x) => (x + 1) % TIPS.length), 9000);
    return () => {
      clearInterval(t);
      clearInterval(k);
    };
  }, [failed]);
  const started = parseServerDate(job.created_at)?.getTime() ?? mountedAt.current;

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="rise grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-3">
            {job.source_url ? sourceLabel(job.source_url) || "Link" : "Upload"} · {failed ? "stopped" : `elapsed ${formatElapsed(now - started)}`}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            {cancelled ? (
              "Cancelled."
            ) : failed ? (
              "That one didn't work."
            ) : (
              <>
                Working on <span className="italic">your notes</span>
              </>
            )}
          </h1>
          <p className="mt-3 truncate text-ink-2" title={job.filename}>{jobTitle(job)}</p>

          {cancelled ? (
            <div className="mt-8 rounded-xl border border-rule bg-card p-5">
              <p className="text-ink-2">Nothing was kept — the recording and any partial work have been deleted.</p>
              <button onClick={onReset} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-blue">
                Start another lecture
              </button>
            </div>
          ) : failed ? (
            <div className="mt-8 rounded-xl border border-margin/25 border-l-4 border-l-margin bg-danger-soft/60 p-5">
              <p className="font-medium">What went wrong</p>
              <p className="mt-1 break-words font-mono text-sm text-ink-2">{job.error || "Unknown error"}</p>
              <p className="mt-3 text-sm text-ink-2">
                {job.source_url
                  ? "Check the link opens without signing in, or download the file and upload it instead."
                  : "Try another file, or a shorter clip to check things are working."}
              </p>
              <button onClick={onReset} className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-blue">
                Try another lecture
              </button>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-rule bg-card p-6">
              <Waveform active={job.status === "transcribing" || job.status === "downloading"} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm text-ink-2">
                  <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${stopping ? "bg-margin" : "bg-blue"}`} />
                  {stopping ? "Stopping at the next checkpoint…" : job.stage || steps[current]?.detail}
                </p>
                {!stopping && (
                  <button
                    onClick={async () => {
                      setCancelBusy(true);
                      await onCancel(job);
                      setCancelBusy(false);
                    }}
                    disabled={cancelBusy}
                    className="rounded-lg border border-rule px-3 py-1.5 text-sm text-ink-2 transition hover:border-margin/50 hover:bg-danger-soft hover:text-margin disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <ol className="relative space-y-0 lg:pt-8">
          {steps.map((s, i) => {
            const state = failed ? (i < current ? "done" : i === current ? "failed" : "todo") : job.status === "done" || i < current ? "done" : i === current ? "active" : "todo";
            return (
              <li key={s.key} className="relative flex gap-4 pb-7 last:pb-0">
                {i < steps.length - 1 && (
                  <span className={`absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px ${state === "done" ? "bg-sage/50" : "bg-rule"}`} />
                )}
                <span
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] transition ${
                    state === "done"
                      ? "border-sage bg-sage text-white"
                      : state === "active"
                        ? "border-blue bg-card text-blue ring-4 ring-blue/10"
                        : state === "failed"
                          ? cancelled
                            ? "border-ink-3 bg-ink-3 text-white"
                            : "border-margin bg-margin text-white"
                          : "border-rule bg-card text-ink-3"
                  }`}
                >
                  {state === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : state === "failed" ? <XIcon className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <div className="pt-0.5">
                  <p className={`font-medium ${state === "todo" ? "text-ink-3" : "text-ink"}`}>{s.label}</p>
                  {state === "active" && <p className="mt-0.5 text-sm text-ink-2">{s.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {!failed && (
        <div className="mt-12 flex items-start gap-4 border-t border-rule pt-6">
          <span className="font-hand text-2xl leading-none text-margin">while you wait —</span>
          <p key={tip} className="rise max-w-xl text-sm leading-relaxed text-ink-2">{TIPS[tip]}</p>
        </div>
      )}
    </section>
  );
}
