import axios from "axios";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "l2n.token";

const http = axios.create({ baseURL: API_URL });

// ---------------------------------------------------------------- token storage

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token = readToken();
let onUnauthorized = () => {};

export const hasToken = () => !!token;
export function setToken(t) {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: stay signed in for this tab only */
  }
}
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

http.interceptors.request.use((cfg) => {
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && token && !err.config?.url?.startsWith("/auth/")) {
      setToken(null);
      onUnauthorized(errorMessage(err));
    }
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  const d = err?.response?.data?.detail;
  if (Array.isArray(d)) return d.map((x) => x.msg).join("; ");
  return d || (err?.code === "ERR_NETWORK" ? "Can't reach the server. Is the backend running?" : err?.message) || "Something went wrong";
}

// ---------------------------------------------------------------- auth

export const signup = (email, password) => http.post("/auth/signup", { email, password }).then((r) => r.data);
export const login = (email, password) => http.post("/auth/login", { email, password }).then((r) => r.data);
export const me = () => http.get("/auth/me").then((r) => r.data);

// ---------------------------------------------------------------- jobs

export async function uploadFile(file, onProgress) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await http.post("/upload", form, {
    onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
  });
  return data;
}

export const submitUrl = (url) => http.post("/upload-url", { url }).then((r) => r.data);
export const getStatus = (jobId) => http.get(`/status/${jobId}`).then((r) => r.data);
export const getNotes = (jobId) => http.get(`/notes/${jobId}`).then((r) => r.data);
export const getTranscript = (jobId) => http.get(`/transcript/${jobId}`).then((r) => r.data);
export const listJobs = () => http.get("/jobs").then((r) => r.data);
export const deleteJob = (jobId) => http.delete(`/jobs/${jobId}`);
export const cancelJob = (jobId) => http.post(`/jobs/${jobId}/cancel`).then((r) => r.data);
export const ask = (jobId, question, history) => http.post(`/ask/${jobId}`, { question, history }).then((r) => r.data);
export const mediaUrl = (jobId) => http.get(`/media-token/${jobId}`).then((r) => `${API_URL}${r.data.url}`);

/** Authenticated file download (a plain <a href> can't carry the bearer token). */
export async function downloadExport(jobId, kind) {
  const res = await http.get(`/notes/${jobId}/${kind}`, { responseType: "blob" });
  const match = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "");
  const name = match ? match[1] : `notes.${kind === "anki" ? "txt" : "md"}`;
  const href = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement("a"), { href, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
