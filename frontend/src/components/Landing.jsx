import AuthCard from "./AuthCard.jsx";
import IntakeCard from "./IntakeCard.jsx";
import SamplePreview from "./SamplePreview.jsx";

const STEPS = [
  {
    n: "01",
    title: "Listen",
    body: "The audio is pulled out of your file or link and transcribed with Whisper — timestamped, with the “um”s and repeats cleaned out.",
    meta: "whisper · runs on the server",
  },
  {
    n: "02",
    title: "Structure",
    body: "Long lectures are split into overlapping parts. Each part becomes cue questions, detailed notes and practice questions, then gets stitched back together.",
    meta: "gemini · validated json",
  },
  {
    n: "03",
    title: "Recall",
    body: "Cover the notes and answer each cue from memory, quiz yourself, or ask the lecture a question. Every cue links back to the moment it was taught.",
    meta: "recall · quiz · ask · anki",
  },
];

export default function Landing({ user, onAuthed, authNotice, onSubmitFile, onSubmitUrl, busy, uploadProgress, children }) {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:pt-14">
        <div className="rise">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-rule bg-card/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-margin" />
            Cornell notes, written for you
          </p>
          <h1 className="font-display text-[2.7rem] font-[420] leading-[1.02] tracking-[-0.02em] sm:text-6xl">
            You sat through the lecture.
            <br />
            <span className="italic font-[360]">
              <span className="hl">We'll take the notes.</span>
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink-2">
            Drop in a recording or paste a YouTube link. You get a proper Cornell sheet — cues on the left, notes on the right, a summary at the
            bottom — and a quiz to check it actually stuck.
          </p>

          <div className="mt-7 max-w-xl">
            {user ? (
              <IntakeCard onSubmitFile={onSubmitFile} onSubmitUrl={onSubmitUrl} busy={busy} uploadProgress={uploadProgress} />
            ) : (
              <AuthCard onAuthed={onAuthed} notice={authNotice} />
            )}
            <p className="mt-3 pl-1 font-mono text-[11px] text-ink-3">
              {user ? "Your lectures are private to your account." : "Free account · your lectures are private to you."}
            </p>
          </div>
        </div>

        <div className="rise lg:pl-6" style={{ animationDelay: "120ms" }}>
          <SamplePreview />
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-rule bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              How a recording becomes <span className="italic">a study sheet</span>
            </h2>
            <p className="max-w-sm text-sm text-ink-2">A five-minute clip takes about a minute. A full lecture takes a few — you can close the tab and come back.</p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-rule bg-rule md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-card p-7">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-5xl font-light italic text-margin/80">{s.n}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">{s.meta}</span>
                </div>
                <h3 className="mt-6 font-display text-2xl">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {children}
    </>
  );
}
