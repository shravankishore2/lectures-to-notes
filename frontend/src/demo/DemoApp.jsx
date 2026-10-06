import { useEffect, useState } from "react";
import Nav from "../components/Nav.jsx";
import NotesView from "../components/NotesView.jsx";
import QuizModal from "../components/QuizModal.jsx";
import { ArrowRight, ArrowUpRight, UploadIcon } from "../components/Icons.jsx";
import { formatClock } from "../lib/format";
import { LECTURES } from "./lectures.js";

const REPO_URL = "https://github.com/shravankishore2/lectures-to-notes";

const slugFromHash = () => new URLSearchParams(window.location.hash.slice(1)).get("lecture");
// replaceState keeps the ?k= guest key in the URL; only the fragment changes.
const setHash = (slug) => window.history.replaceState(null, "", slug ? `#lecture=${slug}` : window.location.pathname + window.location.search);

const minutes = (s) => `${Math.round(s / 60)} min`;

function Credit({ lecture, className = "" }) {
  return (
    <p className={`text-xs leading-relaxed text-ink-3 ${className}`}>
      {lecture.instructor}, <span className="italic">{lecture.course}</span>.{" "}
      <a href={lecture.ocw_url} target="_blank" rel="noreferrer" className="text-blue hover:underline">
        MIT OpenCourseWare
      </a>
      , licensed{" "}
      <a href={lecture.licence.url} target="_blank" rel="noreferrer license" className="text-blue hover:underline">
        {lecture.licence.name}
      </a>
      . Changes: transcribed by Whisper and condensed by Gemini into notes, a summary and a quiz, which may contain errors. The derived notes are
      shared under the same licence; not endorsed by MIT or the instructor.
    </p>
  );
}

function LectureCard({ lecture, onOpen }) {
  const { notes, transcript, processing } = lecture.data;
  return (
    <li className="card-shadow flex flex-col rounded-xl border border-ink/10 bg-card">
      <button onClick={onOpen} className="group flex flex-1 flex-col p-6 text-left">
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">
          <span>{lecture.course.split(",")[0]}</span>
          <span>{formatClock(transcript.duration)}</span>
        </div>
        <h3 className="mt-4 font-display text-[1.45rem] leading-snug tracking-tight">{notes.topic}</h3>
        <p className="mt-1 text-sm text-ink-2">
          {lecture.title} · {lecture.instructor}
        </p>
        <p className="mt-4 line-clamp-3 text-[15px] leading-relaxed text-ink-2">{notes.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="font-mono text-xs text-ink-3">
            {notes.cornell_notes.length} cues · {notes.mcqs.length} questions
            {processing && ` · processed in ${minutes(processing.seconds)}`}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-blue transition group-hover:translate-x-0.5">
            Open <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </button>
      <Credit lecture={lecture} className="border-t border-rule px-6 py-4" />
    </li>
  );
}

function Gallery({ onOpen }) {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pb-14 pt-10 sm:px-8 lg:pt-14">
        <div className="rise max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-rule bg-card/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-margin" />
            Live demo · read-only
          </p>
          <h1 className="font-display text-[2.5rem] font-[420] leading-[1.04] tracking-[-0.02em] sm:text-[3.4rem]">
            Three real lectures, <span className="italic font-[360]"><span className="hl">turned into study sheets.</span></span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">
            Each recording went through the real pipeline once: Whisper transcribed it on a laptop CPU and Gemini wrote the Cornell notes, summary and
            quiz. Open one to read the notes, click a cue's timestamp to jump the video to that moment, try recall mode, or take the quiz.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {LECTURES.map((l) => (
            <LectureCard key={l.slug} lecture={l} onOpen={() => onOpen(l.slug)} />
          ))}
        </ol>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-rule bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1fr_1.1fr]">
          <div className="rounded-xl border border-dashed border-ink/20 bg-paper/50 p-6">
            <div className="flex items-center gap-2 font-medium text-ink-2">
              <UploadIcon className="h-5 w-5" /> Uploading is off in this demo
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
              Transcription runs Whisper on your own CPU and the notes use your own Gemini key, so the app is meant to run on your machine. This
              server is too small to transcribe for strangers, and open uploads would spend one person's API quota. For the same reason the{" "}
              <span className="italic">Ask the lecture</span> chat is switched off here.
            </p>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-blue">
              Run it locally <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-tight">How a recording becomes a study sheet</h2>
            <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-2">
              <li><span className="font-mono text-xs text-margin">01</span> ffmpeg pulls out the audio; Whisper transcribes it in 10-minute pieces, with timestamps.</li>
              <li><span className="font-mono text-xs text-margin">02</span> The transcript is split into overlapping parts; Gemini turns each into cue questions, notes and quiz questions as validated JSON.</li>
              <li><span className="font-mono text-xs text-margin">03</span> The parts are stitched into one Cornell sheet. Every cue keeps the time it was taught, so it can seek the video.</li>
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}

export default function DemoApp() {
  const [slug, setSlug] = useState(slugFromHash);
  const [quizOpen, setQuizOpen] = useState(false);
  const lecture = LECTURES.find((l) => l.slug === slug) || null;

  const open = (next) => {
    setSlug(next);
    setQuizOpen(false);
    setHash(next);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onHash = () => setSlug(slugFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = lecture ? `${lecture.data.notes.topic} · Lecture to Notes demo` : "Lecture to Notes · demo";
  }, [lecture]);

  // NotesView expects an API job; the demo's "job" points at the official YouTube upload for playback.
  const job = lecture && {
    job_id: lecture.slug,
    youtube_id: lecture.youtube_id,
    source_url: lecture.ocw_url,
    filename: `${lecture.course} — ${lecture.title}`,
    created_at: lecture.data.processing?.date,
  };

  return (
    <div className="min-h-screen">
      <Nav onHome={() => open(null)} showNew={false} user={null} />

      <main>
        {!lecture && <Gallery onOpen={open} />}
        {lecture && (
          <>
            <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8 print:hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-rule bg-card/70 px-4 py-3">
                <Credit lecture={lecture} className="max-w-4xl" />
                <button onClick={() => open(null)} className="shrink-0 text-sm text-blue hover:underline">
                  ← All lectures
                </button>
              </div>
            </div>
            <NotesView notes={lecture.data.notes} job={job} onQuiz={() => setQuizOpen(true)} />
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-5 sm:px-8 print:hidden">
        <div className="flex flex-wrap justify-between gap-2 border-t border-rule py-8 font-mono text-[11px] text-ink-3">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">Lecture to Notes · source on GitHub</a>
          <span>Lectures: MIT OpenCourseWare, CC BY-NC-SA 4.0</span>
        </div>
      </footer>

      {quizOpen && lecture && <QuizModal mcqs={lecture.data.notes.mcqs} topic={lecture.data.notes.topic} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
