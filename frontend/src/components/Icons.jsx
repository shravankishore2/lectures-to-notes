const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };

export const Logo = ({ className = "h-7 w-7" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3" y="2.5" width="18" height="19" rx="2" fill="#fffdf7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 2.5v14.5M3 17h18" stroke="#d2475a" strokeWidth="1.5" />
    <path d="M11.5 7h6.5M11.5 10h6.5M11.5 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export const UploadIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>
);
export const LinkIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>
);
export const FileAudioIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 16v-3M12 17v-6M15 15v-2" /></svg>
);
export const ArrowRight = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ArrowUpRight = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>
);
export const CheckIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2.2} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const XIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const EyeOffIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
export const DownloadIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4 20h16" /></svg>
);
export const PrinterIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v7H7z" /></svg>
);
export const PlayIcon = (p) => (
  <svg viewBox="0 0 24 24" {...base} {...p}><path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></svg>
);

/** Hand-drawn arrow for margin annotations. */
export const ScribbleArrow = ({ className }) => (
  <svg viewBox="0 0 80 50" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M76 6C60 4 30 8 14 36" />
    <path d="M8 26l6 11 11-5" />
  </svg>
);
