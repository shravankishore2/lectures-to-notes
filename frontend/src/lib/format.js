// The API stores UTC timestamps without a zone suffix; without this, browsers read them as local time.
export function parseServerDate(s) {
  if (!s) return null;
  return new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
}

export function formatDay(s) {
  const d = parseServerDate(s);
  if (!d) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(s) {
  const d = parseServerDate(s);
  return d ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

export function formatLongDate(s) {
  const d = parseServerDate(s);
  return d ? d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human title for a job: the LLM topic if we have it, else the filename without extension, else the link host. */
export function jobTitle(job) {
  if (job.topic) return job.topic;
  const name = job.filename || "";
  if (/^https?:\/\//.test(name)) {
    try {
      return new URL(name).hostname.replace(/^www\./, "");
    } catch {
      return name;
    }
  }
  return name.replace(/\.[a-z0-9]{2,5}$/i, "");
}

export function sourceLabel(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return "YouTube";
    if (/(^|\.)vimeo\.com$/.test(host)) return "Vimeo";
    if (/\.(mp4|mp3|m4a|wav|webm|mov|ogg|flac|opus|aac)$/i.test(u.pathname)) return "Direct file";
    return host;
  } catch {
    return null;
  }
}

export const pad2 = (n) => String(n).padStart(2, "0");

export function formatClock(seconds) {
  const t = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
