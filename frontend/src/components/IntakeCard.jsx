import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { formatSize, sourceLabel } from "../lib/format";
import { ArrowRight, FileAudioIcon, LinkIcon, UploadIcon, XIcon } from "./Icons.jsx";

const ACCEPT = {
  "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".opus", ".aac"],
  "video/*": [".mp4", ".webm", ".mkv", ".mov"],
};

function Tab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`relative flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-medium transition ${
        active ? "text-ink" : "text-ink-3 hover:text-ink-2"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      <span className={`absolute inset-x-6 -bottom-px h-0.5 rounded-full transition ${active ? "bg-ink" : "bg-transparent"}`} />
    </button>
  );
}

function PrimaryButton({ children, disabled, progress, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-ink px-5 py-3.5 font-medium text-paper shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-blue active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink"
    >
      {progress != null && <span className="absolute inset-y-0 left-0 bg-blue transition-all" style={{ width: `${progress}%` }} />}
      <span className="relative flex items-center gap-2">
        {children}
        {progress == null && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
      </span>
    </button>
  );
}

export default function IntakeCard({ onSubmitFile, onSubmitUrl, busy, uploadProgress }) {
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [reject, setReject] = useState(null);

  const onDrop = useCallback((accepted, rejected) => {
    setReject(rejected.length ? "That format isn't supported — try MP3, MP4, WAV, M4A, WEBM or MOV." : null);
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    disabled: busy,
  });

  const source = sourceLabel(url.trim());
  const uploading = busy && mode === "file";

  return (
    <div className="card-shadow overflow-hidden rounded-2xl border border-ink/10 bg-card">
      <div role="tablist" className="flex border-b border-rule">
        <Tab active={mode === "file"} onClick={() => setMode("file")} icon={UploadIcon}>Upload a recording</Tab>
        <Tab active={mode === "link"} onClick={() => setMode("link")} icon={LinkIcon}>Paste a link</Tab>
      </div>

      <div className="p-5 sm:p-6">
        {mode === "file" ? (
          <>
            {!file ? (
              <div
                {...getRootProps()}
                className={`flex cursor-pointer flex-col items-center rounded-xl border-[1.5px] border-dashed px-6 py-7 text-center transition ${
                  isDragActive ? "border-blue bg-blue-soft" : "border-rule bg-paper/40 hover:border-ink-3 hover:bg-paper/70"
                }`}
              >
                <input {...getInputProps()} />
                <div className="mb-4 flex h-12 items-end gap-[3px]" aria-hidden="true">
                  {[10, 22, 34, 18, 40, 26, 14, 30, 20, 36, 12, 24, 16].map((h, i) => (
                    <span key={i} className={`w-[3px] rounded-full ${isDragActive ? "bg-blue" : "bg-ink/25"}`} style={{ height: h }} />
                  ))}
                </div>
                <p className="font-display text-xl">{isDragActive ? "Let go — we've got it." : "Drop a lecture recording here"}</p>
                <p className="mt-1 text-sm text-ink-2">
                  or <span className="font-medium text-blue underline decoration-blue/30 underline-offset-4">browse your files</span>
                </p>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-3">mp3 · mp4 · wav · m4a · webm · mov — up to 500 MB</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-rule bg-paper/50 px-4 py-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-soft text-blue">
                    <FileAudioIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="font-mono text-xs text-ink-3">{formatSize(file.size)}</p>
                  </div>
                  {!busy && (
                    <button onClick={() => setFile(null)} className="rounded-md p-1.5 text-ink-3 transition hover:bg-paper-2 hover:text-ink" aria-label="Remove file">
                      <XIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <PrimaryButton onClick={() => onSubmitFile(file)} disabled={busy} progress={uploading ? uploadProgress : null}>
                  {uploading ? `Uploading… ${uploadProgress}%` : "Make my notes"}
                </PrimaryButton>
              </div>
            )}
            {reject && <p className="mt-3 text-sm text-margin">{reject}</p>}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) onSubmitUrl(url.trim());
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-2 block text-sm text-ink-2">YouTube, Vimeo, most lecture platforms, or a direct .mp4 / .mp3 link</span>
              <div className="flex items-center gap-2 rounded-xl border border-rule bg-paper/40 px-4 transition focus-within:border-blue focus-within:bg-card focus-within:ring-4 focus-within:ring-blue/10">
                <LinkIcon className="h-4 w-4 shrink-0 text-ink-3" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                  disabled={busy}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-3/70"
                />
              </div>
            </label>
            <div className="flex min-h-5 items-center gap-2 font-mono text-xs text-ink-3">
              {source ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  <span>
                    <span className="text-ink-2">{source}</span> — only the audio track is fetched
                  </span>
                </>
              ) : (
                <span>Only the audio is downloaded, so long lectures fetch quickly.</span>
              )}
            </div>
            <PrimaryButton type="submit" disabled={busy || !url.trim()}>
              {busy ? "Queuing…" : "Fetch & make notes"}
            </PrimaryButton>
          </form>
        )}
      </div>
    </div>
  );
}
