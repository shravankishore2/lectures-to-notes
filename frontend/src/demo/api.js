// Stand-in for lib/api.js in the demo build (vite.demo.config.js aliases "../lib/api" here), so the
// real NotesView / TranscriptPanel / AskPanel / Player run unchanged against pre-processed lectures.
import { LECTURES } from "./lectures.js";

const bySlug = (slug) => LECTURES.find((l) => l.slug === slug);
const offline = (what) =>
  Promise.reject({ response: { data: { detail: `${what} runs on your own machine (it needs a Gemini key), so it's switched off in this demo. See the README to run it locally.` } } });

export function errorMessage(err) {
  return err?.response?.data?.detail || err?.message || "Something went wrong";
}

export const getTranscript = async (slug) => bySlug(slug).data.transcript;
export const ask = () => offline("Ask the lecture");
export const mediaUrl = () => Promise.reject(new Error("No local audio in the demo"));

export async function downloadExport(slug, kind) {
  const lecture = bySlug(slug);
  const anki = kind === "anki";
  const blob = new Blob([anki ? lecture.data.anki : lecture.data.markdown], { type: anki ? "text/plain" : "text/markdown" });
  const href = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href, download: `${slug}${anki ? "-anki.txt" : ".md"}` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
