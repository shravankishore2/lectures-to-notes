import { useEffect, useRef, useState } from "react";
import { downloadExport, errorMessage } from "../lib/api";
import { formatClock, formatLongDate, jobTitle, pad2, sourceLabel } from "../lib/format";
import AskPanel from "./AskPanel.jsx";
import { ArrowUpRight, DownloadIcon, EyeOffIcon, PrinterIcon } from "./Icons.jsx";
import Player from "./Player.jsx";
import TranscriptPanel from "./TranscriptPanel.jsx";

const TABS = [
  ["notes", "Notes"],
  ["transcript", "Transcript"],
  ["ask", "Ask the lecture"],
];

function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-blue" : "bg-rule"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function NotesView({ notes, job, onQuiz, onError }) {
  const [tab, setTab] = useState("notes");
  const [chat, setChat] = useState([]);
  const [recall, setRecall] = useState(false);
  const player = useRef(null);
  const canSeek = !!(job.youtube_id || job.has_audio);
  const seek = (t) => player.current?.seek(t);

  useEffect(() => {
    setTab("notes");
    setChat([]);
  }, [job.job_id]);

  const download = (kind) => downloadExport(job.job_id, kind).catch((e) => onError?.(errorMessage(e)));
  const [revealed, setRevealed] = useState(() => new Set());
  const total = notes.cornell_notes.length;

  const reveal = (i) => setRevealed((prev) => new Set(prev).add(i));
  const setRecallMode = (on) => {
    setRecall(on);
    setRevealed(new Set());
  };
  const scrollTo = (i) => {
    setTab("notes");
    setTimeout(() => document.getElementById(`cue-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  };
  const exportPdf = () => {
    const prev = document.title;
    const wasRecall = recall;
    document.title = notes.topic;
    setRecall(false);
    setTimeout(() => {
      window.print();
      document.title = prev;
      setRecall(wasRecall);
    }, 50);
  };

  const src = sourceLabel(job.source_url);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[280px_1fr] lg:py-14">
      <aside className="print:hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        {canSeek && (
          <div className="mb-4">
            <Player ref={player} job={job} />
          </div>
        )}
        <button
          onClick={onQuiz}
          className="group flex w-full items-center justify-between rounded-xl bg-ink px-4 py-3.5 text-left text-paper shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-blue active:translate-y-px"
        >
          <span>
            <span className="block font-medium">Test yourself</span>
            <span className="block font-mono text-[11px] text-paper/60">{notes.mcqs.length} questions</span>
          </span>
          <span className="font-display text-2xl italic transition group-hover:translate-x-0.5">→</span>
        </button>

        <div className="mt-4 rounded-xl border border-rule bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <EyeOffIcon className="h-4 w-4 text-ink-2" />
              Recall mode
            </div>
            <Toggle on={recall} onChange={setRecallMode} label="Recall mode" />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            {recall ? (
              <>
                <span className="font-mono text-ink-2">{revealed.size}/{total}</span> revealed — answer each cue before you peek.
              </>
            ) : (
              "Hide the notes column and answer each cue from memory."
            )}
          </p>
        </div>

        <nav className="mt-6 hidden lg:block" aria-label="Contents">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Contents</p>
          <ol className="space-y-0.5">
            {notes.cornell_notes.map((n, i) => (
              <li key={i}>
                <button onClick={() => scrollTo(i)} className="flex w-full gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug text-ink-2 transition hover:bg-paper-2 hover:text-ink">
                  <span className="pt-px font-mono text-[11px] text-ink-3">{pad2(i + 1)}</span>
                  <span className="line-clamp-2">{n.cue}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-6 border-t border-rule pt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Export</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <button onClick={() => download("markdown")} className="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card px-2 py-2 text-ink-2 transition hover:border-ink-3 hover:text-ink">
              <DownloadIcon className="h-4 w-4" /> MD
            </button>
            <button onClick={exportPdf} className="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card px-2 py-2 text-ink-2 transition hover:border-ink-3 hover:text-ink">
              <PrinterIcon className="h-4 w-4" /> PDF
            </button>
            <button onClick={() => download("anki")} title="Flashcards for Anki (File → Import)" className="flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-card px-2 py-2 text-ink-2 transition hover:border-ink-3 hover:text-ink">
              <DownloadIcon className="h-4 w-4" /> Anki
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
      <div role="tablist" className="mb-4 flex gap-1 rounded-xl border border-rule bg-card/60 p-1 print:hidden">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === key ? "bg-ink text-paper shadow-sm" : "text-ink-2 hover:bg-paper-2 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "transcript" && <TranscriptPanel jobId={job.job_id} canSeek={canSeek} onSeek={seek} />}
      {tab === "ask" && <AskPanel jobId={job.job_id} notes={notes} messages={chat} setMessages={setChat} canSeek={canSeek} onSeek={seek} />}

      <article className={`print-sheet rise card-shadow overflow-hidden rounded-xl border border-ink/10 bg-card ${tab === "notes" ? "" : "hidden print:block"}`}>
        <header className="border-b-2 border-ink px-6 pb-6 pt-7 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span>Cornell notes</span>
            <span>{formatLongDate(job.created_at)}</span>
          </div>
          <h1 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight sm:text-[2.6rem]">{notes.topic}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            <span className="max-w-full truncate">{job.filename ? jobTitle({ filename: job.filename }) : ""}</span>
            <span className="font-mono text-xs">{total} cues · {notes.mcqs.length} questions</span>
            {job.source_url && (
              <a href={job.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue hover:underline print:hidden">
                Open on {src} <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-[32%_1fr]">
          <div className="hidden border-r-2 border-margin/70 bg-paper/50 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:block">Cues</div>
          <div className="hidden px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 sm:block">Notes</div>

          {notes.cornell_notes.map((n, i) => {
            const hidden = recall && !revealed.has(i);
            return (
              <div key={i} id={`cue-${i}`} className="print-break-inside-avoid contents">
                <div className="flex gap-3 border-t border-rule bg-paper/50 px-5 py-4 sm:border-r-2 sm:border-r-margin/70">
                  <span className="pt-1 font-mono text-[11px] text-margin/80">{pad2(i + 1)}</span>
                  <div>
                    <p className="font-display text-[17px] leading-snug">{n.cue}</p>
                    {n.start != null &&
                      (canSeek ? (
                        <button
                          onClick={() => seek(n.start)}
                          title="Play from here"
                          className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-soft px-2 py-0.5 font-mono text-[11px] text-blue transition hover:bg-blue hover:text-white print:bg-transparent print:p-0 print:text-ink-3"
                        >
                          <span className="print:hidden">▶</span> {formatClock(n.start)}
                        </button>
                      ) : (
                        <span className="mt-2 inline-block font-mono text-[11px] text-ink-3">{formatClock(n.start)}</span>
                      ))}
                  </div>
                </div>
                <div className="relative border-rule px-6 py-3.5 sm:border-t">
                  <p className="ruled text-[15px] leading-7 text-ink-2" style={{ backgroundPosition: "0 0" }}>{n.note}</p>
                  {hidden && (
                    <button
                      onClick={() => reveal(i)}
                      className="hatch absolute inset-1.5 flex items-center justify-center rounded-md border border-dashed border-ink/15 text-ink-3 transition hover:text-ink print:hidden"
                    >
                      <span className="font-hand text-2xl">answer it first, then tap to reveal</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t-2 border-ink bg-paper/40 px-6 py-7 sm:px-10">
          <p className="font-hand text-3xl leading-none text-margin">Summary</p>
          <p className="mt-3 max-w-3xl font-display text-[17px] leading-relaxed text-ink">{notes.summary}</p>
        </footer>
      </article>
      </div>
    </div>
  );
}
