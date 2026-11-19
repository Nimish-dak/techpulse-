import { createClient } from "lakebed/client";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type app from "../server";
import { TOPICS, type Digest, type DigestStory, type ExplanationMode, type Topic } from "../shared/digest";

const client = createClient<typeof app>();
const FILTERS: Array<"All" | Topic> = ["All", ...TOPICS];

const LS_BOOKMARKS = "techpulse.bookmarks.v2";
const LS_THEME = "techpulse.theme.v2";
const COMMAND = "techpulse --fetch today";

const SHORTCUTS: Array<[string, string]> = [
  ["J / K", "Next / previous story"],
  ["O", "Open the active story"],
  ["B", "Bookmark the active story"],
  ["Ctrl K", "Command palette"],
  ["G", "Toggle git-log view"],
  ["D", "Toggle dev mode"],
  ["R", "Refresh stories"],
  ["?", "Shortcut cheat sheet"],
  ["Esc", "Close overlays"]
];

interface Bookmark {
  id: number;
  title: string;
  url: string;
  hnUrl: string;
  topic: Topic;
  score: number;
  savedAt: number;
}

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  group: string;
  run: () => void;
  keywords?: string;
}

const STYLES = `
:root {
  --tp-bg: #05060a;
  --tp-bg-2: #0a0d15;
  --tp-panel: rgba(255,255,255,0.04);
  --tp-panel-strong: rgba(9,12,19,0.94);
  --tp-border: rgba(255,255,255,0.09);
  --tp-border-strong: rgba(255,255,255,0.18);
  --tp-text: #f4f4f5;
  --tp-body: #c3c7d1;
  --tp-muted: #9aa1ae;
  --tp-faint: #6b7280;
  --tp-accent: #22d3ee;
  --tp-accent-2: #818cf8;
  --tp-good: #34d399;
  --tp-warn: #fbbf24;
  --tp-grid: rgba(148,163,184,0.075);
  --tp-track: rgba(255,255,255,0.07);
  --tp-skel: rgba(255,255,255,0.07);
  --tp-hover: rgba(255,255,255,0.055);
  --tp-shadow: 0 30px 60px -34px rgba(0,0,0,0.9);
}
[data-theme="light"] {
  --tp-bg: #f4f6fb;
  --tp-bg-2: #e9eef7;
  --tp-panel: rgba(255,255,255,0.78);
  --tp-panel-strong: rgba(255,255,255,0.98);
  --tp-border: rgba(15,23,42,0.10);
  --tp-border-strong: rgba(15,23,42,0.22);
  --tp-text: #0b1220;
  --tp-body: #334155;
  --tp-muted: #556176;
  --tp-faint: #6b7789;
  --tp-accent: #0e7490;
  --tp-accent-2: #4f46e5;
  --tp-good: #047857;
  --tp-warn: #b45309;
  --tp-grid: rgba(15,23,42,0.055);
  --tp-track: rgba(15,23,42,0.10);
  --tp-skel: rgba(15,23,42,0.08);
  --tp-hover: rgba(15,23,42,0.05);
  --tp-shadow: 0 30px 60px -40px rgba(15,23,42,0.35);
}
html { color-scheme: dark; }
[data-theme="light"] { color-scheme: light; }
body { margin: 0; }
.tp-root {
  min-height: 100vh;
  background: radial-gradient(1200px 600px at 12% -10%, color-mix(in srgb, var(--tp-accent) 14%, transparent), transparent 60%),
              radial-gradient(900px 500px at 88% 0%, color-mix(in srgb, var(--tp-accent-2) 14%, transparent), transparent 62%),
              var(--tp-bg);
  color: var(--tp-text);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  position: relative;
  overflow-x: hidden;
}
.tp-mono { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-feature-settings: "ss01"; }
.tp-grid-bg {
  position: fixed; inset: -20%;
  pointer-events: none; z-index: 0;
  background-image: linear-gradient(to right, var(--tp-grid) 1px, transparent 1px),
                    linear-gradient(to bottom, var(--tp-grid) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%);
  animation: tp-drift 28s linear infinite;
}
.tp-orb {
  position: fixed; border-radius: 999px; filter: blur(90px); pointer-events: none; z-index: 0;
  opacity: .5; animation: tp-float 18s ease-in-out infinite alternate;
}
.tp-orb-a { top: -140px; left: 8%; width: 420px; height: 420px; background: color-mix(in srgb, var(--tp-accent) 32%, transparent); }
.tp-orb-b { top: 80px; right: 4%; width: 460px; height: 460px; background: color-mix(in srgb, var(--tp-accent-2) 26%, transparent); animation-delay: -6s; }
[data-theme="light"] .tp-orb-a, [data-theme="light"] .tp-orb-b { opacity: .3; }
@keyframes tp-drift { from { background-position: 0 0; } to { background-position: 46px 46px; } }
@keyframes tp-float { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-30px, 28px, 0) scale(1.08); } }

.tp-panel {
  background: var(--tp-panel);
  border: 1px solid var(--tp-border);
  border-radius: 18px;
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  box-shadow: var(--tp-shadow);
}
.tp-card {
  position: relative;
  border-radius: 18px;
  border: 1px solid var(--tp-border);
  background: var(--tp-panel);
  backdrop-filter: blur(14px) saturate(140%);
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  transform-style: preserve-3d;
  transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, transform .18s ease;
  will-change: transform;
}
.tp-card::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  background: radial-gradient(340px circle at var(--mx, 50%) var(--my, -10%), color-mix(in srgb, var(--tp-accent) 22%, transparent), transparent 64%);
  opacity: 0; transition: opacity .25s ease;
}
.tp-card:hover::before { opacity: 1; }
.tp-card:hover { border-color: color-mix(in srgb, var(--tp-accent) 42%, transparent); box-shadow: 0 24px 50px -30px color-mix(in srgb, var(--tp-accent) 60%, transparent); }
.tp-card.tp-active { border-color: color-mix(in srgb, var(--tp-accent) 62%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--tp-accent) 30%, transparent), 0 26px 54px -30px color-mix(in srgb, var(--tp-accent) 70%, transparent); }
.tp-card.tp-active::before { opacity: .8; }

.tp-rise { animation: tp-rise .55s cubic-bezier(.2,.7,.3,1) backwards; }
@keyframes tp-rise { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: none; } }
.tp-fade { animation: tp-fade .45s ease backwards; }
@keyframes tp-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.tp-heart { stroke-dasharray: 46; stroke-dashoffset: 46; animation: tp-draw 2.6s ease-in-out infinite; filter: drop-shadow(0 0 4px color-mix(in srgb, var(--tp-accent) 70%, transparent)); }
@keyframes tp-draw { 0% { stroke-dashoffset: 46; } 42% { stroke-dashoffset: 0; } 74% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -46; } }
.tp-logo { position: relative; }
.tp-logo::after { content: ""; position: absolute; inset: 0; border-radius: 14px; box-shadow: 0 0 0 0 color-mix(in srgb, var(--tp-accent) 55%, transparent); animation: tp-logo-pulse 2.6s ease-out infinite; }
@keyframes tp-logo-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tp-accent) 45%, transparent); } 70% { box-shadow: 0 0 0 14px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

.tp-live-dot { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tp-good) 70%, transparent); animation: tp-live 1.9s ease-out infinite; }
@keyframes tp-live { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--tp-good) 65%, transparent); } 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

.tp-caret { display: inline-block; width: 8px; height: 1.05em; margin-left: 2px; vertical-align: -2px; background: var(--tp-accent); animation: tp-blink 1s steps(2, start) infinite; }
@keyframes tp-blink { 50% { opacity: 0; } }

.tp-skel { background: linear-gradient(90deg, var(--tp-skel) 25%, color-mix(in srgb, var(--tp-text) 18%, transparent) 37%, var(--tp-skel) 63%); background-size: 400% 100%; animation: tp-shimmer 1.5s ease infinite; border-radius: 8px; }
@keyframes tp-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.tp-spin { animation: tp-spin .9s linear infinite; }
@keyframes tp-spin { to { transform: rotate(360deg); } }

.tp-bar { transform-origin: left center; animation: tp-grow .8s cubic-bezier(.2,.7,.3,1) backwards; }
@keyframes tp-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.tp-tag { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 9px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; border: 1px solid transparent; }
.tp-tag-ai { color: #c4b5fd; background: rgba(139,92,246,.14); border-color: rgba(139,92,246,.32); }
.tp-tag-web { color: #7dd3fc; background: rgba(56,189,248,.12); border-color: rgba(56,189,248,.30); }
.tp-tag-security { color: #fda4af; background: rgba(244,63,94,.12); border-color: rgba(244,63,94,.30); }
.tp-tag-tools { color: #fcd34d; background: rgba(245,158,11,.12); border-color: rgba(245,158,11,.30); }
.tp-tag-open-source { color: #6ee7b7; background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.30); }
[data-theme="light"] .tp-tag-ai { color: #6d28d9; }
[data-theme="light"] .tp-tag-web { color: #0369a1; }
[data-theme="light"] .tp-tag-security { color: #be123c; }
[data-theme="light"] .tp-tag-tools { color: #b45309; }
[data-theme="light"] .tp-tag-open-source { color: #047857; }

.tp-chip { border-radius: 999px; border: 1px solid var(--tp-border); background: transparent; color: var(--tp-muted); padding: 6px 12px; font-size: 12px; font-weight: 500; transition: all .18s ease; cursor: pointer; }
.tp-chip:hover { color: var(--tp-text); border-color: var(--tp-border-strong); background: var(--tp-hover); }
.tp-chip[aria-pressed="true"] { color: #041016; background: var(--tp-accent); border-color: transparent; font-weight: 700; box-shadow: 0 6px 22px -10px color-mix(in srgb, var(--tp-accent) 90%, transparent); }
[data-theme="light"] .tp-chip[aria-pressed="true"] { color: #fff; }

.tp-btn { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; border: 1px solid var(--tp-border); background: var(--tp-panel); color: var(--tp-text); padding: 7px 12px; font-size: 12px; font-weight: 600; transition: all .18s ease; cursor: pointer; }
.tp-btn:hover { border-color: var(--tp-border-strong); background: var(--tp-hover); }
.tp-btn:disabled { opacity: .55; cursor: progress; }
.tp-btn-accent { border-color: color-mix(in srgb, var(--tp-accent) 38%, transparent); color: var(--tp-accent); }

.tp-kbd { display: inline-flex; min-width: 20px; align-items: center; justify-content: center; border-radius: 5px; border: 1px solid var(--tp-border); border-bottom-width: 2px; background: var(--tp-hover); padding: 1px 5px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: var(--tp-muted); }

.tp-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(3,5,9,.62); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
[data-theme="light"] .tp-overlay { background: rgba(203,213,225,.55); }
.tp-sheet { background: var(--tp-panel-strong); border: 1px solid var(--tp-border-strong); border-radius: 18px; box-shadow: 0 40px 80px -30px rgba(0,0,0,.7); }
.tp-input { width: 100%; background: transparent; border: 0; outline: none; color: var(--tp-text); font-size: 15px; }
.tp-input::placeholder { color: var(--tp-faint); }
.tp-palette-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border-radius: 10px; padding: 9px 11px; color: var(--tp-body); cursor: pointer; border: 1px solid transparent; }
.tp-palette-item:hover, .tp-palette-item[data-active="true"] { background: var(--tp-hover); border-color: var(--tp-border); color: var(--tp-text); }

.tp-code { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; line-height: 1.65; white-space: pre; overflow-x: auto; }
.tp-code .k { color: #7dd3fc; }
.tp-code .s { color: #86efac; }
.tp-code .n { color: #fcd34d; }
.tp-code .b { color: #f9a8d4; }
[data-theme="light"] .tp-code .k { color: #0369a1; }
[data-theme="light"] .tp-code .s { color: #047857; }
[data-theme="light"] .tp-code .n { color: #b45309; }
[data-theme="light"] .tp-code .b { color: #be185d; }

.tp-log-row { display: grid; grid-template-columns: auto 1fr; gap: 10px 14px; padding: 12px 14px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; transition: background .18s ease, border-color .18s ease; }
.tp-log-row:hover { background: var(--tp-hover); border-color: var(--tp-border); }
.tp-log-row.tp-active { background: var(--tp-hover); border-color: color-mix(in srgb, var(--tp-accent) 45%, transparent); }

.tp-stars { color: #fbbf24; }
.tp-mobile-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: var(--tp-panel-strong); border-top: 1px solid var(--tp-border); padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); backdrop-filter: blur(14px); }

.tp-scroll::-webkit-scrollbar { width: 10px; }
.tp-scroll::-webkit-scrollbar-thumb { background: var(--tp-track); border-radius: 999px; border: 3px solid transparent; background-clip: content-box; }
.tp-scroll::-webkit-scrollbar-track { background: transparent; }

.tp-link { color: var(--tp-accent); text-decoration: none; }
.tp-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.tp-underline { text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--tp-accent) 60%, transparent); text-underline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  .tp-grid-bg, .tp-orb, .tp-heart, .tp-logo::after, .tp-live-dot, .tp-rise, .tp-fade, .tp-bar, .tp-skel, .tp-caret { animation: none !important; }
}
`;

const TOPIC_CLASS: Record<Topic, string> = {
  "AI": "tp-tag tp-tag-ai",
  "Web": "tp-tag tp-tag-web",
  "Security": "tp-tag tp-tag-security",
  "Tools": "tp-tag tp-tag-tools",
  "Open Source": "tp-tag tp-tag-open-source"
};

const TOPIC_COLOR: Record<Topic, string> = {
  "AI": "#a78bfa",
  "Web": "#38bdf8",
  "Security": "#fb7185",
  "Tools": "#fbbf24",
  "Open Source": "#34d399"
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
  return new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function readMinutes(story: DigestStory): number {
  return 2 + (Math.abs(story.id) % 5);
}

function commitHash(id: number): string {
  const seed = Math.abs(Math.floor(Math.sin(id) * 1e9)) % 0xffffff;
  return seed.toString(16).padStart(6, "0").slice(0, 6);
}

function formatScore(score: number): string {
  return score >= 1000 ? `${(score / 1000).toFixed(1)}k` : String(score);
}

function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(LS_BOOKMARKS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.id === "number") : [];
  } catch {
    return [];
  }
}

function loadTheme(): "dark" | "light" {
  try {
    return localStorage.getItem(LS_THEME) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightJson(value: unknown): string {
  const raw = escapeHtml(JSON.stringify(value, null, 2));
  return raw.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:)|("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, bool, num) => {
      if (key) return `<span class="k">${key}</span>`;
      if (str) return `<span class="s">${str}</span>`;
      if (bool) return `<span class="b">${bool}</span>`;
      if (num) return `<span class="n">${num}</span>`;
      return match;
    }
  );
}

function jsonFor(story: DigestStory): string {
  return JSON.stringify(
    {
      id: story.id,
      title: story.title,
      topic: story.topic,
      url: story.url,
      hn_url: story.hnUrl,
      score: story.score,
      comments: story.comments,
      author: story.by,
      read_minutes: readMinutes(story),
      summaries: { beginner: story.beginner, technical: story.technical },
      why_it_matters: story.why
    },
    null,
    2
  );
}

function PulseLogo({ small }: { small?: boolean }) {
  const size = small ? "h-8 w-8" : "h-11 w-11";
  return (
    <span className={`tp-logo relative flex ${size} shrink-0 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10`}>
      <svg aria-hidden="true" className={small ? "h-4 w-4" : "h-5 w-5"} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ color: "var(--tp-accent)" }} viewBox="0 0 24 24">
        <path d="M2 12h4l3-8 6 16 3-8h4" opacity="0.22" />
        <path className="tp-heart" d="M2 12h4l3-8 6 16 3-8h4" />
      </svg>
    </span>
  );
}

function Background() {
  return (
    <div aria-hidden="true">
      <div className="tp-grid-bg" />
      <div className="tp-orb tp-orb-a" />
      <div className="tp-orb tp-orb-b" />
    </div>
  );
}

function Tag({ topic }: { topic: Topic }) {
  return <span className={TOPIC_CLASS[topic]}>{topic}</span>;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="tp-panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="tp-skel h-5 w-16" />
        <div className="tp-skel h-3 w-14" />
      </div>
      <div className="tp-skel mb-2 h-4 w-11/12" />
      <div className="tp-skel mb-5 h-4 w-8/12" />
      <div className="tp-skel mb-2 h-3 w-full" />
      <div className="tp-skel mb-2 h-3 w-10/12" />
      <div className="tp-skel mb-5 h-3 w-7/12" />
      <div className="flex items-center gap-3">
        <div className="tp-skel h-3 w-20" />
        <div className="tp-skel h-3 w-12" />
        <div className="tp-skel ml-auto h-3 w-16" />
      </div>
      <span className="sr-only">Loading story {index + 1}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((index) => <SkeletonCard index={index} key={index} />)}
    </div>
  );
}

function TrendingChart({ stories }: { stories: DigestStory[] }) {
  const rows = useMemo(() => {
    const counts = TOPICS.map((topic) => ({
      topic,
      count: stories.filter((story) => story.topic === topic).length
    })).sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...counts.map((row) => row.count));
    return counts.map((row) => ({ ...row, pct: Math.round((row.count / max) * 100) }));
  }, [stories]);

  return (
    <div className="tp-panel p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="tp-mono text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--tp-muted)" }}>
          Trending topics
        </h2>
        <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>{stories.length} stories</span>
      </div>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li className="grid grid-cols-[86px_1fr_32px] items-center gap-3" key={row.topic}>
            <span className="tp-mono truncate text-[11px]" style={{ color: "var(--tp-body)" }}>{row.topic}</span>
            <span className="h-2 overflow-hidden rounded-full" style={{ background: "var(--tp-track)" }}>
              <span
                className="tp-bar block h-full rounded-full"
                style={{ width: `${row.count === 0 ? 0 : Math.max(8, row.pct)}%`, background: TOPIC_COLOR[row.topic], animationDelay: `${index * 70}ms` }}
              />
            </span>
            <span className="tp-mono text-right text-[11px]" style={{ color: "var(--tp-muted)" }}>{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "var(--tp-border)", background: "color-mix(in srgb, var(--tp-bg-2) 88%, transparent)" }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--tp-border)" }}>
        <span className="tp-mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--tp-muted)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#f87171" }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#fbbf24" }} />
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
          <span className="ml-2">{label}</span>
        </span>
        <button className="tp-mono rounded-md border px-2 py-1 text-[10px]" onClick={() => void copy()} style={{ borderColor: "var(--tp-border)", color: copied ? "var(--tp-good)" : "var(--tp-muted)" }} type="button">
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="tp-code tp-scroll max-h-56 overflow-y-auto p-3" dangerouslySetInnerHTML={{ __html: highlightJson(JSON.parse(value)) }} />
    </div>
  );
}

function StoryCard(props: {
  story: DigestStory;
  index: number;
  total: number;
  mode: ExplanationMode;
  active: boolean;
  bookmarked: boolean;
  devMode: boolean;
  delay: number;
  onFocus: (index: number) => void;
  onBookmark: (story: DigestStory) => void;
}) {
  const { story, index, total, mode, active, bookmarked, devMode, delay, onFocus, onBookmark } = props;
  const ref = useRef<HTMLElement | null>(null);

  function handleMove(event: MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty("--mx", `${Math.round(px * 100)}%`);
    el.style.setProperty("--my", `${Math.round(py * 100)}%`);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * 3.2}deg) rotateY(${(px - 0.5) * 4.2}deg) translateY(-3px)`;
    }
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
  }

  const summary = mode === "beginner" ? story.beginner : story.technical;

  return (
    <article
      className={`tp-card tp-rise flex flex-col p-5 ${active ? "tp-active" : ""}`}
      id={`story-${story.id}`}
      onFocus={() => onFocus(index)}
      onMouseLeave={handleLeave}
      onMouseMove={handleMove}
      ref={ref as never}
      style={{ animationDelay: `${delay}ms` }}
      tabIndex={0}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag topic={story.topic} />
          <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>{readMinutes(story)} min read</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>
            {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
          <button
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark story"}
            aria-pressed={bookmarked}
            className="tp-btn h-7 w-7 justify-center p-0"
            onClick={(event) => {
              event.stopPropagation();
              onBookmark(story);
            }}
            style={bookmarked ? { color: "var(--tp-accent)", borderColor: "color-mix(in srgb, var(--tp-accent) 45%, transparent)" } : undefined}
            title={bookmarked ? "Remove from reading list" : "Save to reading list"}
            type="button"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 4h12v17l-6-4-6 4V4z" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="mb-3 text-[16px] font-semibold leading-snug">
        <a className="tp-underline transition-colors hover:text-cyan-400" href={story.url} onClick={() => onFocus(index)} rel="noreferrer" target="_blank">
          {story.title}
        </a>
      </h3>

      <p className="mb-3 text-[13.5px] leading-relaxed" style={{ color: "var(--tp-body)" }}>{summary}</p>

      <p className="mb-4 text-[13px] leading-relaxed">
        <span className="tp-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--tp-accent)" }}>Why it matters · </span>
        <span style={{ color: "var(--tp-body)" }}>{story.why}</span>
      </p>

      {devMode ? <JsonBlock label={`${commitHash(story.id)}.json`} value={jsonFor(story)} /> : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px]" style={{ borderColor: "var(--tp-border)", color: "var(--tp-faint)" }}>
        <span className="tp-mono truncate">{sourceOf(story.url)}</span>
        <span className="tp-stars flex items-center gap-1 font-semibold" title={`${story.score} points`}>
          <svg aria-hidden="true" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 1-5 4.9 1.2 7L12 18l-6.2 3.4L7 14.4l-5-4.9 7-1L12 2z" /></svg>
          <span className="tp-mono">{formatScore(story.score)}</span>
        </span>
        <a className="tp-mono hover:opacity-80" href={story.hnUrl} rel="noreferrer" target="_blank">{story.comments} comments</a>
        <a className="tp-mono ml-auto font-semibold" href={story.url} rel="noreferrer" style={{ color: "var(--tp-accent)" }} target="_blank">read →</a>
      </div>
    </article>
  );
}

function GitLog(props: {
  stories: DigestStory[];
  active: number;
  bookmarks: number[];
  onFocus: (index: number) => void;
  onBookmark: (story: DigestStory) => void;
}) {
  const { stories, active, bookmarks, onFocus, onBookmark } = props;

  return (
    <div className="tp-panel tp-fade overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--tp-border)" }}>
        <span className="tp-mono text-[11px]" style={{ color: "var(--tp-muted)" }}>
          <span style={{ color: "var(--tp-good)" }}>techpulse@dev</span>:<span style={{ color: "var(--tp-accent)" }}>~/digest</span>$ git log --oneline
        </span>
        <span className="tp-mono hidden text-[10px] sm:block" style={{ color: "var(--tp-faint)" }}>{stories.length} commits</span>
      </div>
      <div className="p-2">
        {stories.map((story, index) => {
          const saved = bookmarks.includes(story.id);
          return (
            <div
              className={`tp-log-row ${active === index ? "tp-active" : ""}`}
              id={`log-${story.id}`}
              key={story.id}
              onClick={() => onFocus(index)}
              onDblClick={() => window.open(story.url, "_blank", "noopener")}
            >
              <div className="flex items-center gap-2">
                <span className="tp-mono text-[11px]" style={{ color: "var(--tp-accent)" }}>{commitHash(story.id)}</span>
                <span className="tp-mono rounded px-1 text-[9px] uppercase" style={{ background: "var(--tp-hover)", color: "var(--tp-faint)" }}>{story.topic}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <a className="truncate text-[13px] font-medium hover:text-cyan-400" href={story.url} rel="noreferrer" target="_blank">{story.title}</a>
                  <span className="tp-mono shrink-0 text-[11px]" style={{ color: "var(--tp-faint)" }}>(score: {story.score})</span>
                  <button
                    aria-label={saved ? "Remove bookmark" : "Bookmark story"}
                    className="ml-auto shrink-0 p-0.5"
                    onClick={(event) => {
                      event.stopPropagation();
                      onBookmark(story);
                    }}
                    style={{ color: saved ? "var(--tp-accent)" : "var(--tp-faint)" }}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M6 4h12v17l-6-4-6 4V4z" />
                    </svg>
                  </button>
                </div>
                <p className="tp-mono mt-1 truncate text-[10px]" style={{ color: "var(--tp-faint)" }}>
                  {story.by || "unknown"} · {story.comments} comments · {readMinutes(story)} min read · {sourceOf(story.url)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t px-4 py-2" style={{ borderColor: "var(--tp-border)" }}>
        <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>tip: double-click a row to open the story</span>
      </div>
    </div>
  );
}

export function App() {
  const digest = client.useQuery("digest");
  const refreshDigest = client.useMutation("refreshDigest");

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mode, setMode] = useState<ExplanationMode>("beginner");
  const [topic, setTopic] = useState<"All" | Topic>("All");
  const [view, setView] = useState<"cards" | "log">("cards");
  const [devMode, setDevMode] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [fresh, setFresh] = useState<Digest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [staggerKey, setStaggerKey] = useState(0);
  const [typed, setTyped] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  const data = fresh ?? digest;
  const allStories = data?.stories ?? [];
  const stories = allStories.filter((story) => topic === "All" || story.topic === topic);
  const sourceLabel = data
    ? data.source === "ai"
      ? "AI summaries ready"
      : data.source === "seed"
        ? "today's AI snapshot"
        : "lightweight fallback"
    : "loading";

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => {
    setTheme(loadTheme());
    setBookmarks(loadBookmarks());
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(LS_THEME, theme);
    } catch {
      /* storage can be unavailable */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks));
    } catch {
      /* storage can be unavailable */
    }
  }, [bookmarks]);

  useEffect(() => {
    if (typed >= COMMAND.length) {
      const timer = window.setTimeout(() => setIntroDone(true), 240);
      return () => window.clearTimeout(timer);
    }
    const char = COMMAND[typed] ?? "";
    const timer = window.setTimeout(() => setTyped((value) => value + 1), char === " " ? 55 : 32);
    return () => window.clearTimeout(timer);
  }, [typed]);

  useEffect(() => {
    if (active > stories.length - 1) setActive(0);
  }, [stories.length, active]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQuery, paletteOpen]);

  function toggleBookmark(story: DigestStory) {
    const saved = bookmarks.some((item) => item.id === story.id);
    if (saved) {
      setBookmarks(bookmarks.filter((item) => item.id !== story.id));
      notify("Removed from reading list");
      return;
    }
    setBookmarks([
      { id: story.id, title: story.title, url: story.url, hnUrl: story.hnUrl, topic: story.topic, score: story.score, savedAt: Date.now() },
      ...bookmarks
    ]);
    notify("Saved to reading list");
  }

  async function onRefresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await refreshDigest();
      setFresh(next);
      setStaggerKey((value) => value + 1);
      setIntroDone(true);
      notify("Fetched the latest edition");
    } catch {
      setError("Refresh failed. Please try again.");
      notify("Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  function focusStory(index: number) {
    setActive(index);
    const story = stories[index];
    if (story) {
      window.setTimeout(() => {
        const target = document.getElementById(`story-${story.id}`) ?? document.getElementById(`log-${story.id}`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 40);
    }
  }

  function moveActive(delta: number) {
    if (stories.length === 0) return;
    const next = Math.min(stories.length - 1, Math.max(0, active + delta));
    focusStory(next);
  }

  function openActive() {
    const story = stories[active];
    if (story) window.open(story.url, "_blank", "noopener");
  }

  function bookmarkActive() {
    const story = stories[active];
    if (story) toggleBookmark(story);
  }

  function closeOverlays() {
    setPaletteOpen(false);
    setShortcutsOpen(false);
    setReadingOpen(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable));

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        setPaletteQuery("");
        return;
      }

      if (event.key === "Escape") {
        closeOverlays();
        return;
      }

      if (typing) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "j") {
        event.preventDefault();
        moveActive(1);
      } else if (key === "k") {
        event.preventDefault();
        moveActive(-1);
      } else if (key === "o") {
        event.preventDefault();
        openActive();
      } else if (key === "b") {
        event.preventDefault();
        bookmarkActive();
      } else if (key === "g") {
        setView((current) => (current === "cards" ? "log" : "cards"));
      } else if (key === "d") {
        setDevMode((value) => !value);
      } else if (key === "r") {
        void onRefresh();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const paletteItems: PaletteItem[] = [];
  allStories.forEach((story, index) => {
    paletteItems.push({
      id: `story-${story.id}`,
      label: story.title,
      hint: `${story.topic} · ${story.score} pts`,
      group: "Stories",
      keywords: `${story.by} ${sourceOf(story.url)}`,
      run: () => {
        setTopic("All");
        setView("cards");
        setActive(index);
        closeOverlays();
        window.setTimeout(() => {
          document.getElementById(`story-${story.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 90);
      }
    });
  });
  FILTERS.forEach((item) => {
    paletteItems.push({
      id: `topic-${item}`,
      label: `Filter: ${item}`,
      hint: item === "All" ? "show every story" : "topic filter",
      group: "Topics",
      run: () => {
        setTopic(item);
        setActive(0);
        closeOverlays();
      }
    });
  });
  paletteItems.push(
    {
      id: "mode-beginner",
      label: "Mode: Beginner",
      hint: "plain-language summaries",
      group: "View",
      run: () => { setMode("beginner"); closeOverlays(); }
    },
    {
      id: "mode-technical",
      label: "Mode: Technical",
      hint: "implementation details",
      group: "View",
      run: () => { setMode("technical"); closeOverlays(); }
    },
    {
      id: "view-cards",
      label: "View: Story cards",
      hint: "glowing card grid",
      group: "View",
      run: () => { setView("cards"); closeOverlays(); }
    },
    {
      id: "view-log",
      label: "View: Git log",
      hint: "stories as commits",
      group: "View",
      run: () => { setView("log"); closeOverlays(); }
    },
    {
      id: "dev",
      label: `${devMode ? "Disable" : "Enable"} dev mode`,
      hint: "raw JSON for each story",
      group: "Tools",
      run: () => { setDevMode((value) => !value); closeOverlays(); }
    },
    {
      id: "theme",
      label: `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
      hint: "appearance",
      group: "Tools",
      run: () => { setTheme(theme === "dark" ? "light" : "dark"); closeOverlays(); }
    },
    {
      id: "reading",
      label: "Open reading list",
      hint: `${bookmarks.length} saved`,
      group: "Tools",
      run: () => { setReadingOpen(true); setPaletteOpen(false); }
    },
    {
      id: "refresh",
      label: "Refresh today's stories",
      hint: "fetch the latest digest",
      group: "Actions",
      run: () => { closeOverlays(); void onRefresh(); }
    },
    {
      id: "shortcuts",
      label: "Show keyboard shortcuts",
      hint: "press ? anytime",
      group: "Actions",
      run: () => { setShortcutsOpen(true); setPaletteOpen(false); }
    }
  );

  const trimmedQuery = paletteQuery.trim().toLowerCase();
  const paletteResults = paletteItems
    .filter((item) => !trimmedQuery || `${item.label} ${item.hint} ${item.keywords ?? ""}`.toLowerCase().includes(trimmedQuery))
    .slice(0, 26);

  const savedIds = bookmarks.map((item) => item.id);

  return (
    <div className="tp-root">
      <style>{STYLES}</style>
      <Background />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PulseLogo />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tech<span style={{ color: "var(--tp-accent)" }}>Pulse</span></h1>
                <span className="tp-mono hidden rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-widest sm:inline" style={{ borderColor: "var(--tp-border)", color: "var(--tp-faint)" }}>v2.0</span>
              </div>
              <p className="tp-mono text-[10px] sm:text-[11px]" style={{ color: "var(--tp-muted)" }}>// your 2-minute dev briefing</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="tp-mono flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "color-mix(in srgb, var(--tp-good) 35%, transparent)", color: "var(--tp-good)", background: "color-mix(in srgb, var(--tp-good) 8%, transparent)" }}>
              <span className="tp-live-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--tp-good)" }} />
              Live
            </span>
            <button className="tp-btn tp-mono" onClick={() => { setPaletteOpen(true); setPaletteQuery(""); }} title="Command palette" type="button">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="hidden sm:inline">Search</span>
              <span className="tp-kbd hidden sm:inline-flex">Ctrl K</span>
            </button>
            <button aria-label="Reading list" className="tp-btn relative" onClick={() => setReadingOpen(true)} type="button">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M6 4h12v17l-6-4-6 4V4z" />
              </svg>
              <span className="tp-mono hidden sm:inline">Reading list</span>
              {bookmarks.length > 0 ? (
                <span className="tp-mono rounded-full px-1.5 text-[9px] font-bold" style={{ background: "var(--tp-accent)", color: "#04121a" }}>{bookmarks.length}</span>
              ) : null}
            </button>
            <button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="tp-btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
              type="button"
            >
              {theme === "dark" ? (
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <section className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-3">
            <span className="tp-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--tp-faint)" }}>Daily edition</span>
            <span className="tp-mono text-[11px]" style={{ color: "var(--tp-muted)" }}>
              {data ? `${editionDate(data.generatedAt)} · ${editionTime(data.generatedAt)}` : "fetching today's signal…"}
            </span>
          </div>
          <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>
            source: hacker news · model: opencode zen
          </span>
        </section>

        <section className="tp-panel mb-5 overflow-hidden">
          <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--tp-border)", background: "var(--tp-hover)" }}>
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#f87171" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#fbbf24" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#34d399" }} />
            </span>
            <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>techpulse — zsh — 80×24</span>
            <span className="tp-mono ml-auto hidden text-[10px] sm:inline" style={{ color: "var(--tp-faint)" }}>{busy ? "refreshing…" : "ready"}</span>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <p className="tp-mono text-[12px] leading-relaxed sm:text-[13px]">
              <span style={{ color: "var(--tp-good)" }}>$</span>{" "}
              <span style={{ color: "var(--tp-text)" }}>{COMMAND.slice(0, typed)}</span>
              <span className="tp-caret" />
            </p>
            {introDone ? (
              <p className="tp-mono tp-fade mt-2 text-[11px]" style={{ color: "var(--tp-faint)" }}>
                <span style={{ color: "var(--tp-good)" }}>✔</span> fetched {allStories.length || 10} stories
                <span className="mx-2">·</span>
                <span style={{ color: "var(--tp-accent)" }}>{sourceLabel}</span>
                <span className="mx-2">·</span>
                press <span className="tp-kbd">?</span> for shortcuts
              </p>
            ) : null}
          </div>
        </section>

        <div className={introDone ? "tp-fade" : "pointer-events-none opacity-0"}>
          <section className="mb-5 grid gap-4 md:grid-cols-[1.55fr_1fr]">
            <div className="tp-panel p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="tp-mono flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--tp-accent)" }}>
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 3l1.9 5.6L20 10.5l-6.1 1.9L12 18l-1.9-5.6L4 10.5l6.1-1.9L12 3z" />
                  </svg>
                  Top takeaways
                </h2>
                <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>TL;DR</span>
              </div>
              <ol className="space-y-3">
                {(data?.takeaways ?? ["Connecting to Hacker News…", "Ranking today's programming stories…", "Preparing your two-minute briefing…"]).map((line, index) => (
                  <li className="flex gap-3 text-[13.5px] leading-relaxed" key={index} style={{ color: "var(--tp-body)" }}>
                    <span className="tp-mono mt-0.5 text-[10px]" style={{ color: "var(--tp-accent)" }}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
            <TrendingChart stories={allStories} />
          </section>

          <section className="tp-panel mb-4 flex flex-col gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((item) => (
                <button
                  aria-pressed={topic === item}
                  className="tp-chip tp-mono"
                  key={item}
                  onClick={() => { setTopic(item); setActive(0); }}
                  type="button"
                >
                  {item}
                </button>
              ))}
              <span className="tp-mono ml-auto hidden text-[10px] sm:inline" style={{ color: "var(--tp-faint)" }}>{stories.length} shown</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "var(--tp-border)" }}>
              <div className="flex rounded-full border p-0.5" style={{ borderColor: "var(--tp-border)", background: "var(--tp-hover)" }}>
                <button
                  aria-pressed={mode === "beginner"}
                  className="tp-mono rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  onClick={() => setMode("beginner")}
                  style={mode === "beginner" ? { background: "var(--tp-panel-strong)", color: "var(--tp-text)", boxShadow: "0 1px 6px rgba(0,0,0,.25)" } : { color: "var(--tp-faint)" }}
                  type="button"
                >
                  Beginner
                </button>
                <button
                  aria-pressed={mode === "technical"}
                  className="tp-mono rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  onClick={() => setMode("technical")}
                  style={mode === "technical" ? { background: "var(--tp-panel-strong)", color: "var(--tp-text)", boxShadow: "0 1px 6px rgba(0,0,0,.25)" } : { color: "var(--tp-faint)" }}
                  type="button"
                >
                  Technical
                </button>
              </div>

              <div className="flex rounded-full border p-0.5" style={{ borderColor: "var(--tp-border)", background: "var(--tp-hover)" }}>
                <button
                  aria-pressed={view === "cards"}
                  className="tp-mono rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  onClick={() => setView("cards")}
                  style={view === "cards" ? { background: "var(--tp-panel-strong)", color: "var(--tp-text)" } : { color: "var(--tp-faint)" }}
                  type="button"
                >
                  Cards
                </button>
                <button
                  aria-pressed={view === "log"}
                  className="tp-mono rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  onClick={() => setView("log")}
                  style={view === "log" ? { background: "var(--tp-panel-strong)", color: "var(--tp-text)" } : { color: "var(--tp-faint)" }}
                  type="button"
                >
                  Git log
                </button>
              </div>

              <button
                aria-pressed={devMode}
                className="tp-btn tp-mono"
                onClick={() => setDevMode((value) => !value)}
                style={devMode ? { color: "var(--tp-accent)", borderColor: "color-mix(in srgb, var(--tp-accent) 45%, transparent)" } : undefined}
                title="Show raw API JSON (D)"
                type="button"
              >
                <span className="font-bold">{"{ }"}</span> Dev
              </button>

              <button className="tp-btn tp-mono ml-auto disabled:opacity-50" disabled={busy} onClick={() => void onRefresh()} title="Refresh (R)" type="button">
                <svg aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? "tp-spin" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" />
                </svg>
                {busy ? "Refreshing" : "Refresh"}
                <span className="tp-kbd hidden sm:inline-flex">R</span>
              </button>
            </div>
          </section>

          {error ? (
            <p className="tp-mono mb-4 rounded-xl border px-4 py-3 text-[11px]" role="alert" style={{ borderColor: "color-mix(in srgb, var(--tp-warn) 40%, transparent)", color: "var(--tp-warn)", background: "color-mix(in srgb, var(--tp-warn) 8%, transparent)" }}>
              ! {error}
            </p>
          ) : null}

          {!data ? (
            <SkeletonGrid />
          ) : stories.length === 0 ? (
            <div className="tp-panel p-10 text-center">
              <p className="tp-mono text-[12px]" style={{ color: "var(--tp-muted)" }}>no {topic.toLowerCase()} stories in today&apos;s top 10.</p>
              <button className="tp-btn tp-mono mt-4" onClick={() => setTopic("All")} type="button">clear filter</button>
            </div>
          ) : view === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2" key={staggerKey}>
              {stories.map((story, index) => (
                <StoryCard
                  active={index === active}
                  bookmarked={savedIds.includes(story.id)}
                  delay={index * 60}
                  devMode={devMode}
                  index={index}
                  key={story.id}
                  mode={mode}
                  onBookmark={toggleBookmark}
                  onFocus={setActive}
                  story={story}
                  total={stories.length}
                />
              ))}
            </div>
          ) : (
            <GitLog active={active} bookmarks={savedIds} onBookmark={toggleBookmark} onFocus={setActive} stories={stories} />
          )}
        </div>

        <footer className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--tp-border)" }}>
          <p className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>Built with AI • Data from the Hacker News API</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>digest: {sourceLabel}</span>
            <span className="tp-mono text-[10px]" style={{ color: "var(--tp-faint)" }}>press <span className="tp-kbd">?</span> for shortcuts</span>
          </div>
        </footer>
      </div>

      <div className="tp-mobile-bar flex items-center justify-between gap-2 sm:hidden">
        <button className="tp-btn tp-mono flex-1 justify-center" onClick={() => { setPaletteOpen(true); setPaletteQuery(""); }} type="button">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          Search
        </button>
        <button className="tp-btn tp-mono flex-1 justify-center" onClick={() => setReadingOpen(true)} type="button">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
          Saved{bookmarks.length ? ` (${bookmarks.length})` : ""}
        </button>
        <button className="tp-btn tp-mono flex-1 justify-center" onClick={() => setShortcutsOpen(true)} type="button">
          <span className="font-bold">?</span> Keys
        </button>
        <button className="tp-btn tp-btn-accent tp-mono flex-1 justify-center" disabled={busy} onClick={() => void onRefresh()} type="button">
          <svg aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? "tp-spin" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          {busy ? "…" : "Refresh"}
        </button>
      </div>

      {paletteOpen ? (
        <div className="tp-overlay flex items-start justify-center px-4 pt-[12vh]" onClick={closeOverlays} role="presentation">
          <div className="tp-sheet w-full max-w-xl overflow-hidden" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Command palette">
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--tp-border)" }}>
              <span className="tp-mono text-[12px]" style={{ color: "var(--tp-accent)" }}>&gt;</span>
              <input
                autoFocus
                className="tp-input tp-mono"
                onInput={(event) => setPaletteQuery((event.currentTarget as HTMLInputElement).value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setPaletteIndex((index) => Math.min(paletteResults.length - 1, index + 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setPaletteIndex((index) => Math.max(0, index - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    paletteResults[paletteIndex]?.run();
                  }
                }}
                placeholder="Search stories, topics, commands…"
                value={paletteQuery}
              />
              <span className="tp-kbd">esc</span>
            </div>
            <div className="tp-scroll max-h-[46vh] overflow-y-auto p-2">
              {paletteResults.length === 0 ? (
                <p className="tp-mono px-3 py-6 text-center text-[11px]" style={{ color: "var(--tp-faint)" }}>no matches</p>
              ) : (
                paletteResults.map((item, index) => {
                  const showGroup = index === 0 || paletteResults[index - 1].group !== item.group;
                  return (
                    <div key={item.id}>
                      {showGroup ? (
                        <p className="tp-mono px-3 pb-1 pt-3 text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--tp-faint)" }}>{item.group}</p>
                      ) : null}
                      <button
                        className="tp-palette-item"
                        data-active={index === paletteIndex}
                        onClick={() => item.run()}
                        onMouseEnter={() => setPaletteIndex(index)}
                        type="button"
                      >
                        <span className="tp-mono truncate text-[12.5px]">{item.label}</span>
                        <span className="tp-mono ml-auto shrink-0 text-[10px]" style={{ color: "var(--tp-faint)" }}>{item.hint}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="tp-mono flex items-center gap-3 border-t px-4 py-2 text-[10px]" style={{ borderColor: "var(--tp-border)", color: "var(--tp-faint)" }}>
              <span><span className="tp-kbd">↑↓</span> navigate</span>
              <span><span className="tp-kbd">↵</span> run</span>
              <span className="ml-auto"><span className="tp-kbd">esc</span> close</span>
            </div>
          </div>
        </div>
      ) : null}

      {shortcutsOpen ? (
        <div className="tp-overlay flex items-center justify-center px-4" onClick={closeOverlays} role="presentation">
          <div className="tp-sheet w-full max-w-md p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="tp-mono text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--tp-accent)" }}>Keyboard shortcuts</h2>
              <button className="tp-btn h-7 w-7 justify-center p-0" onClick={closeOverlays} type="button" aria-label="Close">✕</button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(([keys, description]) => (
                <div className="flex items-center justify-between gap-4 border-b pb-2" key={keys} style={{ borderColor: "var(--tp-border)" }}>
                  <span className="text-[12.5px]" style={{ color: "var(--tp-body)" }}>{description}</span>
                  <span className="tp-kbd shrink-0">{keys}</span>
                </div>
              ))}
            </div>
            <p className="tp-mono mt-4 text-[10px]" style={{ color: "var(--tp-faint)" }}>tip: shortcuts pause while typing in a search field</p>
          </div>
        </div>
      ) : null}

      {readingOpen ? (
        <div className="tp-overlay flex items-center justify-center px-4" onClick={closeOverlays} role="presentation">
          <div className="tp-sheet w-full max-w-lg overflow-hidden" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Reading list">
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--tp-border)" }}>
              <h2 className="tp-mono text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--tp-accent)" }}>
                Reading list <span style={{ color: "var(--tp-faint)" }}>({bookmarks.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {bookmarks.length > 0 ? (
                  <button className="tp-mono text-[10px]" onClick={() => { setBookmarks([]); notify("Reading list cleared"); }} style={{ color: "var(--tp-faint)" }} type="button">clear all</button>
                ) : null}
                <button className="tp-btn h-7 w-7 justify-center p-0" onClick={closeOverlays} type="button" aria-label="Close">✕</button>
              </div>
            </div>
            <div className="tp-scroll max-h-[56vh] overflow-y-auto p-3">
              {bookmarks.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-[13px]" style={{ color: "var(--tp-muted)" }}>Nothing saved yet.</p>
                  <p className="tp-mono mt-2 text-[10px]" style={{ color: "var(--tp-faint)" }}>press <span className="tp-kbd">B</span> on a story to save it for later</p>
                </div>
              ) : (
                bookmarks.map((item) => (
                  <div className="flex items-start gap-3 rounded-xl px-3 py-3 transition-colors" key={item.id} style={{ background: "transparent" }}>
                    <span className={TOPIC_CLASS[item.topic]}>{item.topic}</span>
                    <div className="min-w-0 flex-1">
                      <a className="block truncate text-[13px] font-medium hover:text-cyan-400" href={item.url} rel="noreferrer" target="_blank">{item.title}</a>
                      <p className="tp-mono mt-0.5 text-[10px]" style={{ color: "var(--tp-faint)" }}>{formatScore(item.score)} pts · {sourceOf(item.url)}</p>
                    </div>
                    <a className="tp-mono shrink-0 text-[10px]" href={item.hnUrl} rel="noreferrer" style={{ color: "var(--tp-muted)" }} target="_blank">hn</a>
                    <button
                      aria-label="Remove bookmark"
                      className="shrink-0 text-[10px]"
                      onClick={() => { setBookmarks(bookmarks.filter((entry) => entry.id !== item.id)); notify("Removed from reading list"); }}
                      style={{ color: "var(--tp-faint)" }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="tp-mono border-t px-5 py-2 text-[10px]" style={{ borderColor: "var(--tp-border)", color: "var(--tp-faint)" }}>
              saved locally · persists across refreshes
            </div>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="pointer-events-none fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 sm:bottom-6">
        {toast ? (
          <div className="tp-fade rounded-full border px-4 py-2 shadow-xl" style={{ borderColor: "var(--tp-border-strong)", background: "var(--tp-panel-strong)", color: "var(--tp-text)" }}>
            <span className="tp-mono text-[11px]">{toast}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}


