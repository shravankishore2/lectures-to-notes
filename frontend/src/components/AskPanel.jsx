import { useEffect, useRef, useState } from "react";
import { ask, errorMessage } from "../lib/api";
import { formatClock } from "../lib/format";
import { ArrowRight } from "./Icons.jsx";

export default function AskPanel({ jobId, notes, messages, setMessages, canSeek, onSeek }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, busy]);

  const suggestions = [
    "What are the three most important ideas for an exam?",
    notes.cornell_notes[0] ? `Explain "${notes.cornell_notes[0].cue.replace(/\?$/, "")}" more simply` : null,
    "Give me a real-world example of the main concept",
  ].filter(Boolean);

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await ask(jobId, question, history);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, timestamps: res.timestamps }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: errorMessage(e), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-shadow flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-ink/10 bg-card">
      <div className="flex-1 space-y-5 px-5 py-6 sm:px-8">
        {messages.length === 0 && (
          <div>
            <p className="font-display text-2xl leading-snug">Ask this lecture anything.</p>
            <p className="mt-1 text-sm text-ink-2">Answers come only from what was said, with links to the moments that back them up.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-rule bg-paper/50 px-3.5 py-1.5 text-left text-sm text-ink-2 transition hover:border-ink-3 hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-paper">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="max-w-[92%]">
              <div className={`whitespace-pre-line rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed ${m.error ? "border-margin/30 bg-danger-soft text-margin" : "border-rule bg-paper/40 text-ink"}`}>
                {m.content}
              </div>
              {m.timestamps?.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">From</span>
                  {m.timestamps.map((t) =>
                    canSeek ? (
                      <button key={t} onClick={() => onSeek(t)} className="rounded-full bg-blue-soft px-2.5 py-0.5 font-mono text-xs text-blue transition hover:bg-blue hover:text-white">
                        ▶ {formatClock(t)}
                      </button>
                    ) : (
                      <span key={t} className="rounded-full bg-paper-2 px-2.5 py-0.5 font-mono text-xs text-ink-2">{formatClock(t)}</span>
                    )
                  )}
                </div>
              )}
            </div>
          )
        )}

        {busy && (
          <div className="flex items-center gap-1.5 pl-1" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-rule bg-paper/40 p-3 sm:px-6"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          placeholder="e.g. What's the difference between an IPO and a direct listing?"
          className="min-w-0 flex-1 rounded-xl border border-rule bg-card px-4 py-3 text-[15px] outline-none transition focus:border-blue focus:ring-4 focus:ring-blue/10"
        />
        <button type="submit" disabled={busy || !input.trim()} className="flex items-center gap-1.5 rounded-xl bg-ink px-4 font-medium text-paper transition hover:bg-blue disabled:opacity-40">
          Ask <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
