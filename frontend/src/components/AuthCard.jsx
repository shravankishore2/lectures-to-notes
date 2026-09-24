import { useState } from "react";
import { errorMessage, login, signup } from "../lib/api";
import { ArrowRight } from "./Icons.jsx";

export default function AuthCard({ onAuthed, notice }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mode === "signin" ? await login(email, password) : await signup(email, password);
      onAuthed(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tab = (key, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === key}
      onClick={() => {
        setMode(key);
        setError(null);
      }}
      className={`relative flex-1 py-3.5 text-sm font-medium transition ${mode === key ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
    >
      {label}
      <span className={`absolute inset-x-6 -bottom-px h-0.5 rounded-full ${mode === key ? "bg-ink" : "bg-transparent"}`} />
    </button>
  );

  return (
    <div className="card-shadow overflow-hidden rounded-2xl border border-ink/10 bg-card">
      <div role="tablist" className="flex border-b border-rule">
        {tab("signin", "Sign in")}
        {tab("signup", "Create account")}
      </div>
      <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
        {notice && !error && <p className="rounded-lg bg-blue-soft px-3 py-2 text-sm text-blue">{notice}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm text-ink-2">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-rule bg-paper/40 px-4 py-3 text-[15px] outline-none transition focus:border-blue focus:bg-card focus:ring-4 focus:ring-blue/10"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex justify-between text-sm text-ink-2">
            Password
            {mode === "signup" && <span className="font-mono text-[11px] text-ink-3">8+ characters</span>}
          </span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-rule bg-paper/40 px-4 py-3 text-[15px] outline-none transition focus:border-blue focus:bg-card focus:ring-4 focus:ring-blue/10"
          />
        </label>
        {error && <p className="text-sm text-margin">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3.5 font-medium text-paper shadow-[0_2px_0_rgba(0,0,0,0.25)] transition hover:bg-blue active:translate-y-px disabled:opacity-50"
        >
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create my account"}
          {!busy && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />}
        </button>
        <p className="text-center text-xs text-ink-3">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-blue hover:underline">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
