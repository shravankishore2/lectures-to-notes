import { useState } from "react";
import { formatDay, formatTime, jobTitle, sourceLabel } from "../lib/format";
import { FileAudioIcon, PlayIcon, TrashIcon } from "./Icons.jsx";

const STATUS = {
  done: { label: "Ready", cls: "bg-sage-soft text-sage" },
  error: { label: "Failed", cls: "bg-danger-soft text-margin" },
  cancelled: { label: "Cancelled", cls: "bg-paper-2 text-ink-3" },
  queued: { label: "Queued", cls: "bg-paper-2 text-ink-2" },
  downloading: { label: "Fetching", cls: "bg-blue-soft text-blue" },
  transcribing: { label: "Transcribing", cls: "bg-blue-soft text-blue" },
  processing: { label: "Writing", cls: "bg-blue-soft text-blue" },
};

function Row({ job, active, onOpen, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const st = STATUS[job.status] || STATUS.queued;
  const src = sourceLabel(job.source_url);
  const inFlight = !["done", "error", "cancelled"].includes(job.status);

  return (
    <li className={`group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition sm:grid-cols-[88px_1fr_auto] ${active ? "bg-highlight/25" : "hover:bg-paper/60"}`}>
      <div className="hidden font-mono text-xs leading-tight text-ink-3 sm:block">
        <div className="text-ink-2">{formatDay(job.created_at)}</div>
        <div>{formatTime(job.created_at)}</div>
      </div>
      <button onClick={() => onOpen(job)} className="min-w-0 text-left">
        <p className="truncate font-display text-[17px] leading-snug group-hover:underline group-hover:decoration-rule group-hover:underline-offset-4">{jobTitle(job)}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-3">
          {src ? <PlayIcon className="h-3.5 w-3.5 shrink-0" /> : <FileAudioIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{src ? `${src} · ${job.topic ? job.filename : job.source_url}` : job.filename}</span>
        </p>
      </button>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ${st.cls}`}>
          {inFlight && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {st.label}
        </span>
        {confirming ? (
          <span className="flex items-center gap-1 text-xs">
            <button onClick={() => onDelete(job)} className="rounded-md bg-margin px-2 py-1 font-medium text-white hover:bg-margin/90">{inFlight ? "Stop & delete" : "Delete"}</button>
            <button onClick={() => setConfirming(false)} className="rounded-md px-2 py-1 text-ink-2 hover:bg-paper-2">Keep</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-md p-1.5 text-ink-3 opacity-60 transition hover:bg-paper-2 hover:text-margin group-hover:opacity-100"
            aria-label={`Delete ${jobTitle(job)}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </li>
  );
}

export default function Library({ jobs, activeId, onOpen, onDelete }) {
  return (
    <section id="library" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 print:hidden">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-display text-3xl tracking-tight">Your library</h2>
        <span className="font-mono text-xs text-ink-3">{jobs.length} {jobs.length === 1 ? "lecture" : "lectures"}</span>
      </div>
      {jobs.length ? (
        <ul className="divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
          {jobs.map((j) => (
            <Row key={j.job_id} job={j} active={j.job_id === activeId} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-rule px-6 py-12 text-center">
          <p className="font-hand text-3xl text-ink-3">Nothing on the shelf yet.</p>
          <p className="mt-1 text-sm text-ink-3">Your first lecture will show up here.</p>
        </div>
      )}
    </section>
  );
}
