import { Logo } from "./Icons.jsx";

export default function Nav({ onHome, showNew, user, onSignOut }) {
  const go = (id) => {
    onHome();
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 30);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-rule/80 bg-paper/85 backdrop-blur-md print:hidden">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <button onClick={onHome} className="group flex items-center gap-2.5" aria-label="Lecture to Notes, home">
          <Logo className="h-7 w-7 transition group-hover:-rotate-6" />
          <span className="whitespace-nowrap font-display text-[1.2rem] leading-none tracking-tight sm:text-[1.35rem]">
            Lecture <span className="italic text-ink-3">to</span> Notes
          </span>
        </button>
        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <button onClick={() => go("how")} className="hidden rounded-full px-3 py-1.5 text-ink-2 transition hover:bg-paper-2 hover:text-ink sm:block">
            How it works
          </button>
          {user && (
            <button onClick={() => go("library")} className="rounded-full px-3 py-1.5 text-ink-2 transition hover:bg-paper-2 hover:text-ink">
              Library
            </button>
          )}
          {user && (
            <details className="relative">
              <summary
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-blue-soft font-mono text-xs font-medium uppercase text-blue transition hover:ring-2 hover:ring-blue/20 [&::-webkit-details-marker]:hidden"
                aria-label="Account"
              >
                {user.email[0]}
              </summary>
              <div className="card-shadow absolute right-0 top-10 z-50 w-60 rounded-xl border border-rule bg-card p-2 text-sm">
                <p className="truncate px-3 pb-2 pt-1 text-xs text-ink-3">{user.email}</p>
                <button onClick={onSignOut} className="w-full rounded-lg px-3 py-2 text-left text-ink-2 transition hover:bg-paper-2 hover:text-ink">
                  Sign out
                </button>
              </div>
            </details>
          )}
          {showNew && (
            <button onClick={onHome} className="ml-1 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 font-medium text-paper transition hover:bg-blue sm:px-4">
              New<span className="hidden sm:inline"> lecture</span>
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
