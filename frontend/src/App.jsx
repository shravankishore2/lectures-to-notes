import { useCallback, useEffect, useRef, useState } from "react";
import Landing from "./components/Landing.jsx";
import Library from "./components/Library.jsx";
import Nav from "./components/Nav.jsx";
import NotesView from "./components/NotesView.jsx";
import ProcessingView from "./components/ProcessingView.jsx";
import QuizModal from "./components/QuizModal.jsx";
import { XIcon } from "./components/Icons.jsx";
import {
  cancelJob,
  deleteJob,
  errorMessage,
  getNotes,
  getStatus,
  hasToken,
  listJobs,
  me,
  setToken,
  setUnauthorizedHandler,
  submitUrl,
  uploadFile,
} from "./lib/api";

const POLL_MS = 3000;
const TERMINAL = new Set(["done", "error", "cancelled"]);

const jobFromHash = () => new URLSearchParams(window.location.hash.slice(1)).get("job");
const setHash = (jobId) => window.history.replaceState(null, "", jobId ? `#job=${jobId}` : window.location.pathname);

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!hasToken());
  const [authNotice, setAuthNotice] = useState(null);
  const [job, setJob] = useState(null); // {job_id, filename, source_url, status, stage, error, created_at}
  const [notes, setNotes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [banner, setBanner] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const pollRef = useRef(null);

  const refreshHistory = useCallback(() => (hasToken() ? listJobs().then(setHistory).catch(() => {}) : Promise.resolve()), []);

  const reset = useCallback(() => {
    clearInterval(pollRef.current);
    setJob(null);
    setNotes(null);
    setQuizOpen(false);
    setBanner(null);
    setHash(null);
    window.scrollTo({ top: 0 });
  }, []);

  const openJob = useCallback(async (jobId) => {
    clearInterval(pollRef.current);
    setNotes(null);
    setQuizOpen(false);
    setBanner(null);
    try {
      const status = await getStatus(jobId);
      setJob(status);
      setHash(jobId);
      if (status.status === "done") setNotes(await getNotes(jobId));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setBanner(errorMessage(e));
      setJob(null);
      setHash(null);
    }
  }, []);

  // Poll while a job is in flight.
  useEffect(() => {
    if (!job || TERMINAL.has(job.status)) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await getStatus(job.job_id);
        if (status.status !== job.status || status.filename !== job.filename) refreshHistory();
        setJob(status);
        if (status.status === "done") {
          setNotes(await getNotes(job.job_id));
          refreshHistory();
        } else if (TERMINAL.has(status.status)) {
          refreshHistory();
        }
      } catch (e) {
        setBanner(errorMessage(e));
      }
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [job?.job_id, job?.status, job?.filename, refreshHistory]);

  const signOut = useCallback(
    (notice = null) => {
      setToken(null);
      setUser(null);
      setHistory([]);
      setAuthNotice(notice);
      reset();
    },
    [reset]
  );

  // Restore the session, and drop back to the sign-in card whenever the API says the token is no good.
  useEffect(() => {
    setUnauthorizedHandler((msg) => signOut(msg));
    if (!hasToken()) return;
    me()
      .then(setUser)
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, [signOut]);

  const onAuthed = ({ token, user: u }) => {
    setToken(token);
    setUser(u);
    setAuthNotice(null);
  };

  // Once signed in: load the library and resume from #job=<id>.
  useEffect(() => {
    if (!user) return;
    refreshHistory();
    const id = jobFromHash();
    if (id) openJob(id);
    const onHash = () => {
      const next = jobFromHash();
      if (next) openJob(next);
      refreshHistory();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [user, openJob, refreshHistory]);

  const startJob = async (promise) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await promise;
      setJob({ ...res, stage: null, error: null });
      setHash(res.job_id);
      refreshHistory();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setBanner(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFile = (file) => {
    setUploadProgress(0);
    startJob(uploadFile(file, setUploadProgress));
  };
  const handleSubmitUrl = (url) => startJob(submitUrl(url));

  const handleCancel = async (j) => {
    try {
      setJob(await cancelJob(j.job_id));
      refreshHistory();
    } catch (e) {
      setBanner(errorMessage(e));
    }
  };

  const handleDelete = async (j) => {
    try {
      await deleteJob(j.job_id);
      if (job?.job_id === j.job_id) reset();
      refreshHistory();
    } catch (e) {
      setBanner(errorMessage(e));
    }
  };

  const showNotes = job?.status === "done" && notes;

  return (
    <div className="min-h-screen">
      <Nav onHome={reset} showNew={!!job} user={user} onSignOut={() => signOut()} />

      {banner && (
        <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4 print:hidden">
          <div className="rise card-shadow flex max-w-xl items-start gap-3 rounded-xl border border-margin/30 border-l-4 border-l-margin bg-card px-4 py-3 text-sm">
            <p className="flex-1 text-ink-2">{banner}</p>
            <button onClick={() => setBanner(null)} className="text-ink-3 hover:text-ink" aria-label="Dismiss">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <main>
        {!authReady && <div className="mx-auto mt-32 h-8 w-8 animate-spin rounded-full border-2 border-rule border-t-ink" aria-label="Loading" />}

        {authReady && !job && (
          <Landing
            user={user}
            onAuthed={onAuthed}
            authNotice={authNotice}
            onSubmitFile={handleSubmitFile}
            onSubmitUrl={handleSubmitUrl}
            busy={busy}
            uploadProgress={uploadProgress}
          >
            {user && <Library jobs={history} activeId={null} onOpen={(j) => openJob(j.job_id)} onDelete={handleDelete} />}
          </Landing>
        )}

        {job && !showNotes && (
          <>
            <ProcessingView job={job} onReset={reset} onCancel={handleCancel} />
            <Library jobs={history} activeId={job.job_id} onOpen={(j) => openJob(j.job_id)} onDelete={handleDelete} />
          </>
        )}

        {showNotes && <NotesView notes={notes} job={job} onQuiz={() => setQuizOpen(true)} onError={setBanner} />}
      </main>

      <footer className="mx-auto max-w-6xl px-5 sm:px-8 print:hidden">
        <div className="flex flex-wrap justify-between gap-2 border-t border-rule py-8 font-mono text-[11px] text-ink-3">
          <span>Lecture to Notes</span>
          <span>Whisper for transcription · Gemini for structure · FastAPI + React</span>
        </div>
      </footer>

      {quizOpen && notes && <QuizModal mcqs={notes.mcqs} topic={notes.topic} onClose={() => setQuizOpen(false)} />}
    </div>
  );
}
