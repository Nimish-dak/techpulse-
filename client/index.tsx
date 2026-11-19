import { createClient } from "lakebed/client";
import { useState } from "preact/hooks";
import type app from "../server";
import { TOPICS, type Digest, type ExplanationMode, type Topic } from "../shared/digest";

const client = createClient<typeof app>();
const FILTERS: Array<"All" | Topic> = ["All", ...TOPICS];

const TAG_STYLES: Record<Topic, string> = {
  "AI": "rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-300",
  "Web": "rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-300",
  "Security": "rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-300",
  "Tools": "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-300",
  "Open Source": "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300"
};

function sourceOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function editionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });
}

function editionTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit"
  });
}

function PulseMark() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M2 12h4l3-8 6 16 3-8h4" />
      </svg>
    </span>
  );
}

export function App() {
  const digest = client.useQuery("digest");
  const refreshDigest = client.useMutation("refreshDigest");
  const [mode, setMode] = useState<ExplanationMode>("beginner");
  const [topic, setTopic] = useState<"All" | Topic>("All");
  const [fresh, setFresh] = useState<Digest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onRefresh() {
    setBusy(true);
    setError("");
    try {
      setFresh(await refreshDigest());
    } catch {
      setError("Refresh failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const data = fresh ?? digest;
  if (!data) return null;

  const stories = data.stories.filter((story) => topic === "All" || story.topic === topic);

  return (
    <main className="min-h-screen bg-[#08090b] text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-gradient-to-b from-cyan-500/10 via-indigo-500/5 to-transparent" />

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <PulseMark />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tech<span className="text-cyan-400">Pulse</span></h1>
              <p className="mt-1 max-w-md text-sm text-zinc-400">Your 2-minute daily programming news, summarized by AI.</p>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p className="font-medium uppercase tracking-widest text-zinc-400">Daily edition</p>
            <p className="mt-1">{editionDate(data.generatedAt)} · {editionTime(data.generatedAt)}</p>
          </div>
        </header>

        <div className="transition-opacity duration-200 starting:opacity-0">
          <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <svg aria-hidden="true" className="h-4 w-4 text-cyan-400" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 3l1.9 5.6L20 10.5l-6.1 1.9L12 18l-1.9-5.6L4 10.5l6.1-1.9L12 3z" />
              </svg>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Top Takeaways</h2>
            </div>
            <ol className="space-y-2.5">
              {data.takeaways.map((line, index) => (
                <li className="flex gap-3 text-sm leading-relaxed text-zinc-300 sm:text-[15px]" key={index}>
                  <span className="mt-0.5 font-mono text-xs text-cyan-500">{String(index + 1).padStart(2, "0")}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  aria-pressed={topic === item}
                  className={topic === item
                    ? "rounded-full border border-cyan-400/40 bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors"
                    : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-white/20 hover:text-white"}
                  key={item}
                  onClick={() => setTopic(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-white/10 bg-black/40 p-1">
                <button
                  aria-pressed={mode === "beginner"}
                  className={mode === "beginner"
                    ? "rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-white"}
                  onClick={() => setMode("beginner")}
                  type="button"
                >
                  Beginner
                </button>
                <button
                  aria-pressed={mode === "technical"}
                  className={mode === "technical"
                    ? "rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-white"}
                  onClick={() => setMode("technical")}
                  type="button"
                >
                  Technical
                </button>
              </div>
              <button
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-cyan-400/40 hover:text-white disabled:opacity-50"
                disabled={busy}
                onClick={() => void onRefresh()}
                type="button"
              >
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 11-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                {busy ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </section>

          {error ? <p className="mb-4 text-sm text-amber-400" role="alert">{error}</p> : null}

          {stories.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-400">
              No {topic} stories in today&apos;s top 10. Try another topic.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {stories.map((story, index) => (
                <article className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-cyan-400/30 hover:bg-white/[0.05]" key={story.id}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={TAG_STYLES[story.topic]}>{story.topic}</span>
                    <span className="font-mono text-xs text-zinc-500">
                      {String(index + 1).padStart(2, "0")} / {String(data.stories.length).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mb-3 text-base font-semibold leading-snug text-zinc-100">
                    <a className="transition-colors group-hover:text-cyan-300" href={story.url} rel="noreferrer" target="_blank">
                      {story.title}
                    </a>
                  </h3>

                  <p className="mb-3 text-sm leading-relaxed text-zinc-400">
                    {mode === "beginner" ? story.beginner : story.technical}
                  </p>

                  <p className="mb-4 text-sm leading-relaxed text-zinc-300">
                    <span className="font-semibold text-cyan-400">Why it matters:</span> {story.why}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 pt-3 text-xs text-zinc-500">
                    <span>{sourceOf(story.url)}</span>
                    <span>{story.score} points</span>
                    <a className="hover:text-cyan-300" href={story.hnUrl} rel="noreferrer" target="_blank">
                      {story.comments} comments
                    </a>
                    <a className="ml-auto font-medium text-cyan-400 hover:text-cyan-300" href={story.url} rel="noreferrer" target="_blank">
                      Read story →
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-zinc-600">
          <p>Stories from Hacker News · Summaries by AI</p>
          <p>
            {data.source === "ai"
              ? "AI summaries ready"
              : data.source === "seed"
                ? "AI summaries from today's snapshot"
                : "Quick summaries while the AI provider is unavailable"}
          </p>
        </footer>
      </div>
    </main>
  );
}
