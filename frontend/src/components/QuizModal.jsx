import { useCallback, useEffect, useState } from "react";
import { pad2 } from "../lib/format";
import { CheckIcon, XIcon } from "./Icons.jsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Models tend to put the right answer in the same slot; reshuffle options every round.
function shuffleOptions(q) {
  const options = [...q.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...q, options };
}

function verdict(score, total) {
  const r = score / total;
  if (r === 1) return "Clean sheet. You've got this one.";
  if (r >= 0.7) return "Solid — skim the ones you missed.";
  if (r >= 0.4) return "Halfway there. Worth another pass.";
  return "Go back to the cues, then try again.";
}

export default function QuizModal({ mcqs: source, topic, onClose }) {
  const [mcqs, setDeck] = useState(() => source.map(shuffleOptions));
  const [pool, setPool] = useState(() => mcqs.map((_, i) => i)); // indices into mcqs for this round
  const [pos, setPos] = useState(0);
  const [picks, setPicks] = useState({}); // mcq index -> picked option index
  const [finished, setFinished] = useState(false);

  const qi = pool[pos];
  const q = mcqs[qi];
  const picked = picks[qi];
  const answered = picked !== undefined;
  const correctIdx = q ? q.options.indexOf(q.answer) : -1;
  const isRight = (i) => mcqs[i].options[picks[i]] === mcqs[i].answer;
  const score = pool.filter((i) => picks[i] !== undefined && isRight(i)).length;
  const missed = pool.filter((i) => picks[i] !== undefined && !isRight(i));

  const choose = useCallback(
    (opt) => {
      if (answered || !q || opt >= q.options.length) return;
      setPicks((p) => ({ ...p, [qi]: opt }));
    },
    [answered, q, qi]
  );

  const next = useCallback(() => {
    if (!answered) return;
    if (pos + 1 >= pool.length) setFinished(true);
    else setPos((p) => p + 1);
  }, [answered, pos, pool.length]);

  const startRound = (indices) => {
    setDeck(source.map(shuffleOptions));
    setPool(indices);
    setPicks({});
    setPos(0);
    setFinished(false);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      if (finished) return;
      const n = "1234".indexOf(e.key) >= 0 ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
      if (n >= 0) choose(n);
      else if (e.key === "Enter" || e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, next, finished, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[3px] print:hidden" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Quiz" className="rise card-shadow flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">{finished ? "Results" : `Question ${pad2(pos + 1)} / ${pad2(pool.length)}`}</p>
            <p className="truncate text-sm text-ink-2">{topic}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-3 transition hover:bg-paper-2 hover:text-ink" aria-label="Close quiz">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4" aria-hidden="true">
          {pool.map((i, k) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                picks[i] === undefined ? (k === pos && !finished ? "bg-ink/40" : "bg-rule") : isRight(i) ? "bg-sage" : "bg-margin"
              }`}
            />
          ))}
        </div>

        <div className="overflow-y-auto px-6 pb-6 pt-5">
          {finished ? (
            <div>
              <div className="flex items-end gap-4">
                <p className="font-display text-7xl leading-none tracking-tight">
                  {score}
                  <span className="text-4xl text-ink-3">/{pool.length}</span>
                </p>
                <p className="pb-2 font-hand text-2xl leading-tight text-margin">{verdict(score, pool.length)}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {missed.length > 0 && (
                  <button onClick={() => startRound(missed)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-blue">
                    Retry the {missed.length} I missed
                  </button>
                )}
                <button onClick={() => startRound(mcqs.map((_, i) => i))} className="rounded-lg border border-rule px-4 py-2.5 text-sm font-medium transition hover:border-ink-3">
                  Start over
                </button>
                <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-2 transition hover:bg-paper-2">
                  Back to notes
                </button>
              </div>
              {missed.length > 0 && (
                <div className="mt-7">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Review what you missed</p>
                  <ul className="space-y-3">
                    {missed.map((i) => (
                      <li key={i} className="rounded-xl border border-rule bg-paper/40 p-4">
                        <p className="font-display text-[16px] leading-snug">{mcqs[i].question}</p>
                        <p className="mt-2 flex items-start gap-2 text-sm text-ink-3">
                          <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-margin" />
                          <span className="line-through decoration-margin/50">{mcqs[i].options[picks[i]]}</span>
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm text-ink">
                          <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
                          {mcqs[i].answer}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          ) : (
            <>
              <h2 key={qi} className="rise font-display text-2xl leading-snug tracking-tight sm:text-[1.7rem]">{q.question}</h2>
              <ul className="mt-6 space-y-2.5">
                {q.options.map((opt, i) => {
                  let cls = "border-rule hover:border-ink-3 hover:bg-paper/50";
                  let badge = "border-rule text-ink-3";
                  if (answered) {
                    if (i === correctIdx) {
                      cls = "border-sage bg-sage-soft";
                      badge = "border-sage bg-sage text-white";
                    } else if (i === picked) {
                      cls = "border-margin/60 bg-danger-soft";
                      badge = "border-margin bg-margin text-white";
                    } else cls = "border-rule opacity-50";
                  }
                  return (
                    <li key={i}>
                      <button
                        onClick={() => choose(i)}
                        disabled={answered}
                        className={`flex w-full items-center gap-3.5 rounded-xl border-[1.5px] px-4 py-3.5 text-left text-[15px] transition ${cls}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs transition ${badge}`}>
                          {answered && i === correctIdx ? <CheckIcon className="h-3.5 w-3.5" /> : answered && i === picked ? <XIcon className="h-3.5 w-3.5" /> : LETTERS[i]}
                        </span>
                        {opt}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 flex min-h-11 items-center justify-between gap-4">
                {answered ? (
                  <p className={`font-hand text-2xl ${picked === correctIdx ? "text-sage" : "text-margin"}`}>
                    {picked === correctIdx ? "Nice — that's it." : "Not quite. The green one's right."}
                  </p>
                ) : (
                  <p className="hidden font-mono text-[11px] text-ink-3 sm:block">Press 1–4 to answer · Enter for next · Esc to close</p>
                )}
                {answered && (
                  <button onClick={next} className="ml-auto rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-blue">
                    {pos + 1 >= pool.length ? "See results" : "Next question"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
