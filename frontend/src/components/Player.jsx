import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { errorMessage, mediaUrl } from "../lib/api";

const YT_ORIGIN = "https://www.youtube-nocookie.com";

/**
 * YouTube lectures play in an embed (seeked via the iframe postMessage API — no extra script needed);
 * uploads and other links play the compact audio copy the backend keeps. Exposes `seek(seconds)`.
 */
const Player = forwardRef(function Player({ job }, ref) {
  const frame = useRef(null);
  const audio = useRef(null);
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const yt = job.youtube_id;

  useEffect(() => {
    setSrc(null);
    setError(null);
    if (!yt && job.has_audio) mediaUrl(job.job_id).then(setSrc).catch((e) => setError(errorMessage(e)));
  }, [job.job_id, job.has_audio, yt]);

  const post = (func, args = []) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN);

  useImperativeHandle(
    ref,
    () => ({
      seek(t) {
        if (yt) {
          post("seekTo", [t, true]);
          post("playVideo");
          frame.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else if (audio.current) {
          audio.current.currentTime = t;
          audio.current.play().catch(() => {});
        }
      },
    }),
    [yt]
  );

  if (yt) {
    const origin = encodeURIComponent(window.location.origin);
    return (
      <div className="overflow-hidden rounded-xl border border-ink/10 bg-ink shadow-sm">
        <iframe
          ref={frame}
          title="Lecture video"
          className="aspect-video w-full"
          src={`${YT_ORIGIN}/embed/${yt}?enablejsapi=1&rel=0&modestbranding=1&origin=${origin}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening" }), YT_ORIGIN)}
        />
      </div>
    );
  }

  if (!job.has_audio) return null;
  return (
    <div className="rounded-xl border border-rule bg-card p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3">Recording</p>
      {error ? (
        <p className="text-xs text-margin">{error}</p>
      ) : src ? (
        <audio ref={audio} src={src} controls preload="metadata" className="h-9 w-full" />
      ) : (
        <div className="h-9 animate-pulse rounded-full bg-paper-2" />
      )}
    </div>
  );
});

export default Player;
