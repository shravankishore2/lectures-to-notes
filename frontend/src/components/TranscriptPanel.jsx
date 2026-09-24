import { useEffect, useMemo, useState } from "react";
import { errorMessage, getTranscript } from "../lib/api";
import { formatClock } from "../lib/format";

function highlight(text, q) {
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) => (i % 2 ? <mark key={i} className="hl bg-transparent text-ink">{p}</mark> : p));
}

export default function TranscriptPanel({ jobId, canSeek, onSeek }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getTranscript(jobId).then(setData).catch((e) => setError(errorMessage(e)));
  }, [jobId]);

  const q = query.trim();
  const rows = useMemo(() => {
    if (!data) return [];
    return q ? data.segments.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())) : data.segments;
  }, [data, q]);

  return (
    <div className="card-shadow rounded-xl border border-ink/10 bg-card">
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-t-xl border-b border-rule bg-card/95 px-5 py-3 backdrop-blur sm:px-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the transcript…"
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper/40 px-3.5 py-2 text-sm outline-none transition focus:border-blue focus:bg-card focus:ring-4 focus:ring-blue/10"
        />
        {data && (
          <span className="font-mono text-xs text-ink-3">
            {q ? `${rows.length} match${rows.length === 1 ? "" : "es"}` : `${data.segments.length} lines · ${formatClock(data.duration)}`}
          </span>
        )}
      </div>

      {error ? (
        <p className="p-8 text-sm text-margin">{error}</p>
      ) : !data ? (
        <div className="space-y-3 p-8">
          {[80, 95, 70, 88].map((w, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-paper-2" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="p-8 font-hand text-2xl text-ink-3">Nothing matches “{q}”.</p>
      ) : (
        <ol className="divide-y divide-rule/60">
          {rows.map((s, i) => (
            <li key={`${s.start}-${i}`} className="grid grid-cols-[64px_1fr] gap-3 px-5 py-2.5 sm:px-8">
              {canSeek ? (
                <button onClick={() => onSeek(s.start)} className="self-start pt-0.5 text-left font-mono text-xs text-blue hover:underline">
                  {formatClock(s.start)}
                </button>
              ) : (
                <span className="pt-0.5 font-mono text-xs text-ink-3">{formatClock(s.start)}</span>
              )}
              <p className="text-[15px] leading-relaxed text-ink-2">{highlight(s.text, q)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
