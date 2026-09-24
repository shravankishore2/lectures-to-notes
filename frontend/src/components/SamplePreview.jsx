import { CheckIcon, ScribbleArrow } from "./Icons.jsx";

const ROWS = [
  ["Where did the first stock market come from?", "The Dutch East India Company sold shares in its voyages to private citizens in the 1600s — the first public trading of company ownership."],
  ["What is an IPO?", "A company's first sale of stock to the public, usually backed by large investors who get the first crack at buying."],
  ["Why do prices move?", "Supply and demand: strong results raise demand and the share price; bad news does the opposite."],
];

/** Static illustration of the output on the landing page. Not live data. */
export default function SamplePreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] select-none pb-16 pt-6 lg:pt-0" aria-label="Example of generated notes">
      <p className="absolute -top-2 right-2 z-10 hidden rotate-[4deg] font-hand text-2xl text-blue sm:block lg:-right-6 lg:-top-8">
        cues left, notes right
        <ScribbleArrow className="ml-auto mt-0.5 h-9 w-16 -scale-x-100 rotate-12" />
      </p>

      <div className="card-shadow rotate-[-1.2deg] overflow-hidden rounded-lg border border-ink/10 bg-card">
        <div className="border-b-2 border-ink px-6 pb-4 pt-5">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">
            <span>Cornell notes</span>
            <span>econ 101 · wk 3</span>
          </div>
          <h3 className="mt-1.5 font-display text-2xl leading-tight">How the stock market works</h3>
        </div>
        <div className="grid grid-cols-[36%_1fr] text-[13px]">
          {ROWS.map(([cue, note], i) => (
            <div key={i} className="contents">
              <div className="border-r-2 border-margin/70 border-t border-t-rule bg-paper/50 px-4 py-3 font-display text-[14px] leading-snug">{cue}</div>
              <div className="border-t border-rule px-4 py-3 leading-relaxed text-ink-2">
                {i === 2 ? (
                  <>
                    <span className="hl text-ink">Supply and demand</span>: strong results raise demand and the share price; bad news does the opposite.
                  </>
                ) : (
                  note
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t-2 border-ink bg-paper/40 px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Summary</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Stock markets began as a way to fund risky voyages. Today, companies list through an IPO and prices track supply, demand and confidence…
          </p>
        </div>
      </div>

      <div className="card-shadow absolute -bottom-14 -left-2 w-[250px] rotate-[3deg] rounded-xl border border-ink/10 bg-card p-4 sm:-left-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Question 2 / 6</p>
        <p className="mt-1.5 font-display text-[15px] leading-snug">What happens to a stock's price when demand rises?</p>
        <div className="mt-3 space-y-1.5 text-[12px]">
          <div className="flex items-center gap-2 rounded-md border border-sage/40 bg-sage-soft px-2.5 py-1.5 text-ink">
            <CheckIcon className="h-3.5 w-3.5 text-sage" /> It goes up
          </div>
          <div className="rounded-md border border-rule px-2.5 py-1.5 text-ink-3">It stays fixed until the next IPO</div>
        </div>
      </div>
    </div>
  );
}
