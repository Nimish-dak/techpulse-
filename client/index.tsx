import { createClient } from "lakebed/client";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type app from "../server";
import { TOPICS, type Digest, type DigestStory, type ExplanationMode, type Topic } from "../shared/digest";

const client = createClient<typeof app>();
const FILTERS: Array<"All" | Topic> = ["All", ...TOPICS];

const LS_BOOKMARKS = "techpulse.bookmarks.v2";
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

/* ─── CLIP-PATH for chamfered corners ─── */
const CLIP_SM = "polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)";
const CLIP_MD = "polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)";
const CLIP_LG = "polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px)";

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&family=Share+Tech+Mono&display=swap');

:root {
  --nr-bg: #050505;
  --nr-bg-2: #0B0D19;
  --nr-bg-3: #0E1127;
  --nr-panel: rgba(0,255,194,0.05);
  --nr-panel-solid: #0a0e18;
  --nr-border: #003232;
  --nr-border-strong: rgba(0,255,194,0.30);
  --nr-text: #e8edf5;
  --nr-body: #8A99AD;
  --nr-muted: #6b778d;
  --nr-faint: #55627a;
  --nr-cyan: #00FFC2;
  --nr-green: #39FF14;
  --nr-magenta: #FF00E5;
  --nr-amber: #FFB800;
  --nr-purple: #BF5AF2;
  --nr-glow: 0 0 12px rgba(0,255,194,0.12), 0 0 40px rgba(0,255,194,0.05);
  --nr-glow-strong: 0 0 8px rgba(0,255,194,0.25), 0 0 30px rgba(0,255,194,0.10);
}

html { color-scheme: dark; }
body { margin: 0; }
*, *::before, *::after { box-sizing: border-box; }

.nr-root {
  min-height: 100vh;
  background: var(--nr-bg);
  color: var(--nr-text);
  font-family: "JetBrains Mono", "Share Tech Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-feature-settings: "ss01";
  -webkit-font-smoothing: antialiased;
  position: relative;
  overflow-x: hidden;
}

/* ── Scanline overlay ── */
.nr-scanlines {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(to bottom, transparent 50%, rgba(0,255,194,0.02) 50%);
  background-size: 100% 4px;
}

/* ── Chromatic vignette ── */
.nr-vignette {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(circle at center, transparent 0%, rgba(5,5,5,0.4) 100%);
}

/* ── Ghost watermark ── */
.nr-ghost {
  position: fixed; z-index: 0; pointer-events: none;
  font-size: 120px; font-weight: 900; line-height: 0.8;
  opacity: 0.025; top: 20%; left: -10%;
  transform: rotate(-15deg);
  color: var(--nr-cyan);
  letter-spacing: 0.05em;
}

/* ── Grid background ── */
.nr-grid-bg {
  position: fixed; inset: -20%; z-index: 0; pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(0,240,255,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,240,255,0.04) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse 70% 50% at 50% 0%, #000 10%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse 70% 50% at 50% 0%, #000 10%, transparent 70%);
}

/* ── Ambient glow orbs ── */
.nr-orb {
  position: fixed; border-radius: 999px; filter: blur(120px); pointer-events: none; z-index: 0;
  animation: nr-float 22s ease-in-out infinite alternate;
}
.nr-orb-a { top: -200px; left: 5%; width: 500px; height: 500px; background: rgba(0,240,255,0.08); }
.nr-orb-b { top: 100px; right: 2%; width: 400px; height: 400px; background: rgba(191,90,242,0.06); animation-delay: -8s; }
@keyframes nr-float { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-20px, 30px, 0) scale(1.06); } }

/* ── Panel (chamfered glass) ── */
.nr-panel {
  background: var(--nr-panel);
  border: 1px solid var(--nr-border);
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  box-shadow: var(--nr-glow);
  position: relative;
}
.nr-panel::before {
  content: ""; position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--nr-cyan), transparent);
  opacity: 0.4;
}

/* ── Card ── */
.nr-card {
  position: relative;
  border: 1px solid var(--nr-border);
  background: var(--nr-panel);
  backdrop-filter: blur(16px) saturate(130%);
  -webkit-backdrop-filter: blur(16px) saturate(130%);
  transition: border-color .22s ease, box-shadow .22s ease;
}
.nr-card::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--nr-cyan), var(--nr-purple));
  opacity: 0.6; transition: opacity .22s ease;
}
.nr-card:hover { border-color: var(--nr-border-strong); box-shadow: var(--nr-glow-strong); }
.nr-card:hover::before { opacity: 1; }
.nr-card.nr-active { border-color: rgba(0,240,255,0.5); box-shadow: 0 0 12px rgba(0,240,255,0.2), 0 0 40px rgba(0,240,255,0.08), inset 0 0 30px rgba(0,240,255,0.03); }
.nr-card.nr-active::before { opacity: 1; }

/* ── Animations ── */
.nr-rise { animation: nr-rise .5s cubic-bezier(.2,.7,.3,1) backwards; }
@keyframes nr-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.nr-fade { animation: nr-fade .4s ease backwards; }
@keyframes nr-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.nr-pulse-line { animation: nr-pulse-line 2.4s ease-in-out infinite; }
@keyframes nr-pulse-line {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

.nr-caret { display: inline-block; width: 9px; height: 1.1em; margin-left: 2px; vertical-align: -2px; background: var(--nr-cyan); animation: nr-blink 1s steps(2, start) infinite; box-shadow: 0 0 8px var(--nr-cyan); }
@keyframes nr-blink { 50% { opacity: 0; } }

.nr-spin { animation: nr-spin .9s linear infinite; }
@keyframes nr-spin { to { transform: rotate(360deg); } }

.nr-bar { transform-origin: left center; animation: nr-grow .8s cubic-bezier(.2,.7,.3,1) backwards; }
@keyframes nr-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.nr-skel { background: linear-gradient(90deg, rgba(0,240,255,0.05) 25%, rgba(0,240,255,0.12) 37%, rgba(0,240,255,0.05) 63%); background-size: 400% 100%; animation: nr-shimmer 1.5s ease infinite; }
@keyframes nr-shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

.nr-live-dot { box-shadow: 0 0 0 0 rgba(57,255,20,0.7); animation: nr-live 1.8s ease-out infinite; }
@keyframes nr-live { 0% { box-shadow: 0 0 0 0 rgba(57,255,20,0.6); } 70% { box-shadow: 0 0 0 7px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }

.nr-glitch { animation: nr-glitch 4s infinite; }
@keyframes nr-glitch {
  0%, 93%, 100% { transform: none; opacity: 1; }
  94% { transform: translate(-2px, 1px); opacity: 0.8; }
  95% { transform: translate(2px, -1px); opacity: 0.9; }
  96% { transform: none; opacity: 1; }
}

/* ── Tags ── */
.nr-tag { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; font-size: 9px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; border: 1px solid; }
.nr-tag-ai { color: var(--nr-purple); border-color: rgba(191,90,242,0.35); background: rgba(191,90,242,0.08); }
.nr-tag-web { color: var(--nr-cyan); border-color: rgba(0,240,255,0.30); background: rgba(0,240,255,0.06); }
.nr-tag-security { color: var(--nr-magenta); border-color: rgba(255,0,85,0.35); background: rgba(255,0,85,0.08); }
.nr-tag-tools { color: var(--nr-amber); border-color: rgba(255,183,3,0.35); background: rgba(255,183,3,0.08); }
.nr-tag-open-source { color: var(--nr-green); border-color: rgba(57,255,20,0.30); background: rgba(57,255,20,0.06); }

/* ── Chips ── */
.nr-chip { border: 1px solid var(--nr-border); background: transparent; color: var(--nr-muted); padding: 5px 12px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; transition: all .18s ease; cursor: pointer; }
.nr-chip:hover { color: var(--nr-text); border-color: var(--nr-border-strong); background: rgba(0,240,255,0.04); }
.nr-chip[aria-pressed="true"] { color: var(--nr-bg); background: var(--nr-cyan); border-color: var(--nr-cyan); box-shadow: 0 0 14px rgba(0,240,255,0.4); }

/* ── Buttons ── */
.nr-btn { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--nr-border); background: rgba(0,240,255,0.03); color: var(--nr-text); padding: 6px 12px; font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; transition: all .18s ease; cursor: pointer; font-family: inherit; }
.nr-btn:hover { border-color: var(--nr-border-strong); background: rgba(0,240,255,0.08); box-shadow: 0 0 12px rgba(0,240,255,0.1); }
.nr-btn:disabled { opacity: .45; cursor: progress; }
.nr-btn-accent { border-color: rgba(0,240,255,0.35); color: var(--nr-cyan); }

/* ── Kbd ── */
.nr-kbd { display: inline-flex; min-width: 18px; align-items: center; justify-content: center; border: 1px solid var(--nr-border); background: rgba(0,240,255,0.04); padding: 1px 5px; font-size: 9px; color: var(--nr-muted); font-family: inherit; }

/* ── Overlay ── */
.nr-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(5,5,10,.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

/* ── Sheet (dialog) ── */
.nr-sheet { background: var(--nr-panel-solid); border: 1px solid var(--nr-border-strong); box-shadow: 0 0 20px rgba(0,240,255,0.1), 0 40px 80px -30px rgba(0,0,0,.8); position: relative; }
.nr-sheet::before { content: ""; position: absolute; top: 0; left: 14px; right: 14px; height: 1px; background: linear-gradient(90deg, transparent, var(--nr-cyan), transparent); opacity: 0.5; }

/* ── Input ── */
.nr-input { width: 100%; background: transparent; border: 0; outline: none; color: var(--nr-text); font-size: 14px; font-family: inherit; }
.nr-input::placeholder { color: var(--nr-faint); }

/* ── Palette item ── */
.nr-palette-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; color: var(--nr-body); cursor: pointer; border: 1px solid transparent; transition: all .15s ease; }
.nr-palette-item:hover, .nr-palette-item[data-active="true"] { background: rgba(0,240,255,0.05); border-color: var(--nr-border); color: var(--nr-text); }

/* ── Code block ── */
.nr-code { font-family: inherit; font-size: 11px; line-height: 1.65; white-space: pre-wrap; word-break: break-all; overflow-x: auto; }
.nr-code .k { color: var(--nr-cyan); }
.nr-code .s { color: var(--nr-green); }
.nr-code .n { color: var(--nr-amber); }
.nr-code .b { color: var(--nr-magenta); }

/* ── Log rows ── */
.nr-log-row { display: grid; grid-template-columns: auto 1fr; gap: 10px 14px; padding: 10px 12px; border: 1px solid transparent; cursor: pointer; transition: background .18s ease, border-color .18s ease; }
.nr-log-row:hover { background: rgba(0,240,255,0.03); border-color: var(--nr-border); }
.nr-log-row.nr-active { background: rgba(0,240,255,0.05); border-color: rgba(0,240,255,0.3); }

/* ── Stars ── */
.nr-stars { color: var(--nr-amber); }

/* ── Mobile bar ── */
.nr-mobile-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; background: var(--nr-panel-solid); border-top: 1px solid var(--nr-border); padding: 8px 12px calc(8px + env(safe-area-inset-bottom)); backdrop-filter: blur(14px); }

/* ── Scrollbar ── */
.nr-scroll::-webkit-scrollbar { width: 8px; }
.nr-scroll::-webkit-scrollbar-thumb { background: rgba(0,240,255,0.12); border: 2px solid transparent; background-clip: content-box; }
.nr-scroll::-webkit-scrollbar-track { background: transparent; }

/* ── Corner decorations ── */
.nr-corner-tl, .nr-corner-tr, .nr-corner-bl, .nr-corner-br {
  position: absolute; width: 12px; height: 12px; pointer-events: none;
}
.nr-corner-tl { top: -1px; left: -1px; border-top: 2px solid var(--nr-cyan); border-left: 2px solid var(--nr-cyan); }
.nr-corner-tr { top: -1px; right: -1px; border-top: 2px solid var(--nr-cyan); border-right: 2px solid var(--nr-cyan); }
.nr-corner-bl { bottom: -1px; left: -1px; border-bottom: 2px solid var(--nr-cyan); border-left: 2px solid var(--nr-cyan); }
.nr-corner-br { bottom: -1px; right: -1px; border-bottom: 2px solid var(--nr-cyan); border-right: 2px solid var(--nr-cyan); }

/* ── Section header ── */
.nr-section-label {
  font-size: 9px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase;
  color: var(--nr-muted); display: flex; align-items: center; gap: 8px;
}
.nr-section-label::after {
  content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, var(--nr-border), transparent);
}

/* ── Dashed separator ── */
.nr-dashed { border-style: dashed; border-color: var(--nr-border); }

/* ── Underline link ── */
.nr-link { color: var(--nr-cyan); text-decoration: none; }
.nr-link:hover { text-decoration: underline; text-underline-offset: 3px; text-shadow: 0 0 8px rgba(0,240,255,0.3); }

@media (prefers-reduced-motion: reduce) {
  .nr-grid-bg, .nr-orb, .nr-live-dot, .nr-rise, .nr-fade, .nr-bar, .nr-skel, .nr-caret, .nr-glitch, .nr-pulse-line, .nr-spin { animation: none !important; }
}
`;

const TOPIC_CLASS: Record<Topic, string> = {
  "AI": "nr-tag nr-tag-ai",
  "Web": "nr-tag nr-tag-web",
  "Security": "nr-tag nr-tag-security",
  "Tools": "nr-tag nr-tag-tools",
  "Open Source": "nr-tag nr-tag-open-source"
};

const TOPIC_COLOR: Record<Topic, string> = {
  "AI": "#BF5AF2",
  "Web": "#00F0FF",
  "Security": "#FF0055",
  "Tools": "#FFB703",
  "Open Source": "#39FF14"
};

function sourceOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

function editionDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
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
  } catch { return []; }
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
    { id: story.id, title: story.title, topic: story.topic, url: story.url, hn_url: story.hnUrl, score: story.score, comments: story.comments, author: story.by, read_minutes: readMinutes(story), summaries: { beginner: story.beginner, technical: story.technical }, why_it_matters: story.why },
    null, 2
  );
}

/* ═══════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════ */

function CornerDecorations() {
  return (
    <>
      <span className="nr-corner-tl" />
      <span className="nr-corner-tr" />
      <span className="nr-corner-bl" />
      <span className="nr-corner-br" />
    </>
  );
}

function SystemLogo() {
  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center border border-cyan-400/30" style={{ background: "rgba(0,240,255,0.05)", clipPath: CLIP_SM }}>
      <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ color: "var(--nr-cyan)", filter: "drop-shadow(0 0 6px rgba(0,240,255,0.5))" }} viewBox="0 0 24 24">
        <path d="M2 12h4l3-8 6 16 3-8h4" opacity="0.15" />
        <path d="M2 12h4l3-8 6 16 3-8h4" style={{ strokeDasharray: 46, strokeDashoffset: 46, animation: "nr-draw 2.6s ease-in-out infinite" }} />
      </svg>
      <style>{`@keyframes nr-draw { 0% { stroke-dashoffset: 46; } 42% { stroke-dashoffset: 0; } 74% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -46; } }`}</style>
    </span>
  );
}

function Background() {
  return (
    <div aria-hidden="true">
      <div className="nr-grid-bg" />
      <div className="nr-orb nr-orb-a" />
      <div className="nr-orb nr-orb-b" />
      <div className="nr-scanlines" />
      <div className="nr-vignette" />
      <div className="nr-ghost">TECH<br />PULSE</div>
    </div>
  );
}

function Tag({ topic }: { topic: Topic }) {
  return <span className={TOPIC_CLASS[topic]}>{topic}</span>;
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="nr-panel p-5" style={{ clipPath: CLIP_MD }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="nr-skel h-5 w-16" />
        <div className="nr-skel h-3 w-14" />
      </div>
      <div className="nr-skel mb-2 h-4 w-11/12" />
      <div className="nr-skel mb-5 h-4 w-8/12" />
      <div className="nr-skel mb-2 h-3 w-full" />
      <div className="nr-skel mb-2 h-3 w-10/12" />
      <div className="nr-skel mb-5 h-3 w-7/12" />
      <div className="flex items-center gap-3">
        <div className="nr-skel h-3 w-20" />
        <div className="nr-skel h-3 w-12" />
        <div className="nr-skel ml-auto h-3 w-16" />
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
    const counts = TOPICS.map((topic) => ({ topic, count: stories.filter((s) => s.topic === topic).length })).sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...counts.map((r) => r.count));
    return counts.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }));
  }, [stories]);

  return (
    <div className="nr-panel p-4 sm:p-5 relative" style={{ clipPath: CLIP_MD }}>
      <CornerDecorations />
      <div className="mb-3 flex items-center justify-between">
        <h2 className="nr-section-label" style={{ color: "var(--nr-cyan)" }}>
          <svg aria-hidden="true" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M3 3v18h18v-2H5V3H3zm14 6l-4 4-3-3-4 4v2l4-4 3 3 4-4 2 2V9h-5l3 0z" /></svg>
          SYS_TRENDING
        </h2>
        <span className="text-[9px]" style={{ color: "var(--nr-muted)" }}>{stories.length} NODES</span>
      </div>
      <ul className="space-y-2.5">
        {rows.map((row, index) => (
          <li className="grid grid-cols-[90px_1fr_32px] items-center gap-3" key={row.topic}>
            <span className="truncate text-[10px]" style={{ color: "var(--nr-body)" }}>{row.topic}</span>
            <span className="h-1.5 overflow-hidden" style={{ background: "rgba(0,240,255,0.06)" }}>
              <span className="nr-bar block h-full" style={{ width: `${row.count === 0 ? 0 : Math.max(8, row.pct)}%`, background: TOPIC_COLOR[row.topic], animationDelay: `${index * 70}ms`, boxShadow: `0 0 8px ${TOPIC_COLOR[row.topic]}40` }} />
            </span>
            <span className="text-right text-[10px]" style={{ color: "var(--nr-body)" }}>{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }
  return (
    <div className="mt-4 overflow-hidden border" style={{ borderColor: "var(--nr-border)", background: "var(--nr-bg-2)" }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--nr-border)" }}>
        <span className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em]" style={{ color: "var(--nr-muted)" }}>
          <span className="h-1.5 w-1.5" style={{ background: "var(--nr-magenta)" }} />
          <span className="h-1.5 w-1.5" style={{ background: "var(--nr-amber)" }} />
          <span className="h-1.5 w-1.5" style={{ background: "var(--nr-green)" }} />
          <span className="ml-1">{label}</span>
        </span>
        <button className="border px-2 py-1 text-[9px] uppercase" onClick={() => void copy()} style={{ borderColor: "var(--nr-border)", color: copied ? "var(--nr-green)" : "var(--nr-muted)", fontFamily: "inherit" }} type="button">
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
      <pre className="nr-code nr-scroll max-h-56 overflow-y-auto p-3" dangerouslySetInnerHTML={{ __html: highlightJson(JSON.parse(value)) }} />
    </div>
  );
}

function StoryCard(props: {
  story: DigestStory; index: number; total: number; mode: ExplanationMode;
  active: boolean; bookmarked: boolean; devMode: boolean; delay: number;
  onFocus: (index: number) => void; onBookmark: (story: DigestStory) => void;
}) {
  const { story, index, total, mode, active, bookmarked, devMode, delay, onFocus, onBookmark } = props;
  const summary = mode === "beginner" ? story.beginner : story.technical;

  return (
    <article
      className={`nr-card nr-rise flex flex-col p-5 ${active ? "nr-active" : ""}`}
      id={`story-${story.id}`}
      onFocus={() => onFocus(index)}
      style={{ animationDelay: `${delay}ms`, clipPath: CLIP_MD }}
      tabIndex={0}
    >
      {/* Top bar */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag topic={story.topic} />
          <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>{readMinutes(story)} MIN READ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>
            [{String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}]
          </span>
          <button
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark story"}
            aria-pressed={bookmarked}
            className="nr-btn h-7 w-7 justify-center p-0"
            onClick={(e) => { e.stopPropagation(); onBookmark(story); }}
            style={bookmarked ? { color: "var(--nr-cyan)", borderColor: "rgba(0,255,194,0.4)" } : { color: "var(--nr-body)", borderColor: "var(--nr-border)" }}
            type="button"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 4h12v17l-6-4-6 4V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="mb-3 text-[15px] font-semibold leading-snug">
        <a className="nr-link transition-colors" href={story.url} onClick={() => onFocus(index)} rel="noreferrer" target="_blank">
          {story.title}
        </a>
      </h3>

      {/* Summary */}
      <p className="mb-3 text-[12.5px] leading-relaxed" style={{ color: "var(--nr-body)" }}>{summary}</p>

      {/* Why it matters */}
      <p className="mb-4 text-[12px] leading-relaxed">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nr-cyan)" }}>WHY_IT_MATTERS · </span>
        <span style={{ color: "var(--nr-body)" }}>{story.why}</span>
      </p>

      {devMode ? <JsonBlock label={`${commitHash(story.id)}.json`} value={jsonFor(story)} /> : null}

      {/* Footer */}
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-dashed pt-3 text-[10px]" style={{ borderColor: "var(--nr-border)", color: "var(--nr-body)" }}>
        <span className="truncate" style={{ color: "var(--nr-muted)" }}>{sourceOf(story.url)}</span>
        <span className="nr-stars flex items-center gap-1 font-semibold" title={`${story.score} points`}>
          <svg aria-hidden="true" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 1-5 4.9 1.2 7L12 18l-6.2 3.4L7 14.4l-5-4.9 7-1L12 2z" /></svg>
          {formatScore(story.score)}
        </span>
        <a
          className="flex items-center gap-1 font-bold transition-all hover:underline"
          href={story.hnUrl}
          rel="noreferrer"
          style={{ color: "var(--nr-amber)", textShadow: "0 0 8px rgba(255,184,0,0.3)" }}
          target="_blank"
          title="Open Hacker News discussion thread"
        >
          <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {story.comments} comments ↗
        </a>
        <a className="ml-auto font-bold nr-link" href={story.url} rel="noreferrer" style={{ color: "var(--nr-cyan)" }} target="_blank">READ →</a>
      </div>
    </article>
  );
}

function GitLog(props: {
  stories: DigestStory[]; active: number; bookmarks: number[];
  onFocus: (index: number) => void; onBookmark: (story: DigestStory) => void;
}) {
  const { stories, active, bookmarks, onFocus, onBookmark } = props;
  return (
    <div className="nr-panel nr-fade overflow-hidden relative" style={{ clipPath: CLIP_MD }}>
      <CornerDecorations />
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--nr-border)" }}>
        <span className="text-[10px]" style={{ color: "var(--nr-body)" }}>
          <span style={{ color: "var(--nr-green)" }}>netrunner@sys</span>:<span style={{ color: "var(--nr-cyan)" }}>~/digest</span>$ git log --oneline
        </span>
        <span className="hidden text-[9px] sm:block" style={{ color: "var(--nr-faint)" }}>{stories.length} COMMITS</span>
      </div>
      <div className="p-2">
        {stories.map((story, index) => {
          const saved = bookmarks.includes(story.id);
          return (
            <div className={`nr-log-row ${active === index ? "nr-active" : ""}`} id={`log-${story.id}`} key={story.id} onClick={() => onFocus(index)} onDblClick={() => window.open(story.url, "_blank", "noopener")}>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--nr-cyan)" }}>{commitHash(story.id)}</span>
                <span className={TOPIC_CLASS[story.topic]} style={{ fontSize: "8px" }}>{story.topic}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <a className="truncate text-[12px] font-medium" href={story.url} rel="noreferrer" target="_blank" style={{ color: "var(--nr-text)" }}>{story.title}</a>
                  <span className="shrink-0 text-[10px]" style={{ color: "var(--nr-faint)" }}>(score: {story.score})</span>
                  <button aria-label={saved ? "Remove bookmark" : "Bookmark"} className="ml-auto shrink-0 p-0.5" onClick={(e) => { e.stopPropagation(); onBookmark(story); }} style={{ color: saved ? "var(--nr-cyan)" : "var(--nr-muted)" }} type="button">
                    <svg aria-hidden="true" className="h-3.5 w-3.5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
                  </button>
                </div>
                <p className="mt-1 truncate text-[10px]" style={{ color: "var(--nr-muted)" }}>
                  {story.by || "unknown"} · <a className="font-semibold hover:underline" href={story.hnUrl} rel="noreferrer" style={{ color: "var(--nr-amber)" }} target="_blank">{story.comments} comments ↗</a> · {readMinutes(story)} min read · {sourceOf(story.url)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-dashed px-4 py-2" style={{ borderColor: "var(--nr-border)" }}>
        <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>TIP: DOUBLE-CLICK A ROW TO OPEN THE STORY</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════ */

export function App() {
  const digest = client.useQuery("digest");
  const refreshDigest = client.useMutation("refreshDigest");

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
  const stories = allStories.filter((s) => topic === "All" || s.topic === topic);
  const sourceLabel = data
    ? data.source === "ai" ? "AI_SUMMARIES_READY" : data.source === "seed" ? "AI_SNAPSHOT" : "FALLBACK_MODE"
    : "CONNECTING";

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  useEffect(() => { setBookmarks(loadBookmarks()); return () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }; }, []);
  useEffect(() => { try { localStorage.setItem(LS_BOOKMARKS, JSON.stringify(bookmarks)); } catch { /* noop */ } }, [bookmarks]);

  useEffect(() => {
    if (typed >= COMMAND.length) { const t = window.setTimeout(() => setIntroDone(true), 240); return () => window.clearTimeout(t); }
    const ch = COMMAND[typed] ?? "";
    const t = window.setTimeout(() => setTyped((v) => v + 1), ch === " " ? 55 : 28);
    return () => window.clearTimeout(t);
  }, [typed]);

  useEffect(() => { if (active > stories.length - 1) setActive(0); }, [stories.length, active]);
  useEffect(() => { setPaletteIndex(0); }, [paletteQuery, paletteOpen]);

  function toggleBookmark(story: DigestStory) {
    const saved = bookmarks.some((i) => i.id === story.id);
    if (saved) { setBookmarks(bookmarks.filter((i) => i.id !== story.id)); notify("Removed from reading list"); return; }
    setBookmarks([{ id: story.id, title: story.title, url: story.url, hnUrl: story.hnUrl, topic: story.topic, score: story.score, savedAt: Date.now() }, ...bookmarks]);
    notify("Saved to reading list");
  }

  async function onRefresh() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const next = await refreshDigest();
      setFresh(next); setStaggerKey((v) => v + 1); setIntroDone(true); notify("Data stream refreshed");
    } catch { setError("REFRESH_FAILED — RETRY"); notify("Refresh failed"); }
    finally { setBusy(false); }
  }

  function focusStory(index: number) {
    setActive(index);
    const story = stories[index];
    if (story) window.setTimeout(() => { (document.getElementById(`story-${story.id}`) ?? document.getElementById(`log-${story.id}`))?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 40);
  }

  function moveActive(delta: number) { if (stories.length === 0) return; focusStory(Math.min(stories.length - 1, Math.max(0, active + delta))); }
  function openActive() { const s = stories[active]; if (s) window.open(s.url, "_blank", "noopener"); }
  function bookmarkActive() { const s = stories[active]; if (s) toggleBookmark(s); }
  function closeOverlays() { setPaletteOpen(false); setShortcutsOpen(false); setReadingOpen(false); }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen((o) => !o); setPaletteQuery(""); return; }
      if (event.key === "Escape") { closeOverlays(); return; }
      if (typing) return;
      if (event.key === "?") { event.preventDefault(); setShortcutsOpen(true); return; }
      const key = event.key.toLowerCase();
      if (key === "j") { event.preventDefault(); moveActive(1); }
      else if (key === "k") { event.preventDefault(); moveActive(-1); }
      else if (key === "o") { event.preventDefault(); openActive(); }
      else if (key === "b") { event.preventDefault(); bookmarkActive(); }
      else if (key === "g") { setView((c) => (c === "cards" ? "log" : "cards")); }
      else if (key === "d") { setDevMode((v) => !v); }
      else if (key === "r") { void onRefresh(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Palette items
  const paletteItems: PaletteItem[] = [];
  allStories.forEach((story, index) => {
    paletteItems.push({ id: `story-${story.id}`, label: story.title, hint: `${story.topic} · ${story.score} pts`, group: "Stories", keywords: `${story.by} ${sourceOf(story.url)}`,
      run: () => { setTopic("All"); setView("cards"); setActive(index); closeOverlays(); window.setTimeout(() => { document.getElementById(`story-${story.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 90); }
    });
  });
  FILTERS.forEach((item) => { paletteItems.push({ id: `topic-${item}`, label: `Filter: ${item}`, hint: item === "All" ? "show all" : "topic", group: "Topics", run: () => { setTopic(item); setActive(0); closeOverlays(); } }); });
  paletteItems.push(
    { id: "mode-beginner", label: "Mode: Beginner", hint: "plain language", group: "View", run: () => { setMode("beginner"); closeOverlays(); } },
    { id: "mode-technical", label: "Mode: Technical", hint: "implementation", group: "View", run: () => { setMode("technical"); closeOverlays(); } },
    { id: "view-cards", label: "View: Cards", hint: "grid layout", group: "View", run: () => { setView("cards"); closeOverlays(); } },
    { id: "view-log", label: "View: Git log", hint: "commit style", group: "View", run: () => { setView("log"); closeOverlays(); } },
    { id: "dev", label: `${devMode ? "Disable" : "Enable"} dev mode`, hint: "raw JSON", group: "Tools", run: () => { setDevMode((v) => !v); closeOverlays(); } },
    { id: "reading", label: "Open reading list", hint: `${bookmarks.length} saved`, group: "Tools", run: () => { setReadingOpen(true); setPaletteOpen(false); } },
    { id: "refresh", label: "Refresh data stream", hint: "fetch latest", group: "Actions", run: () => { closeOverlays(); void onRefresh(); } },
    { id: "shortcuts", label: "Keyboard shortcuts", hint: "press ?", group: "Actions", run: () => { setShortcutsOpen(true); setPaletteOpen(false); } }
  );

  const trimmedQuery = paletteQuery.trim().toLowerCase();
  const paletteResults = paletteItems.filter((item) => !trimmedQuery || `${item.label} ${item.hint} ${item.keywords ?? ""}`.toLowerCase().includes(trimmedQuery)).slice(0, 26);
  const savedIds = bookmarks.map((i) => i.id);

  return (
    <div className="nr-root">
      <style>{STYLES}</style>
      <Background />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pb-16 sm:pt-10">

        {/* ══ HEADER ══ */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <SystemLogo />
            <div>
              <div className="nr-glitch flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  TECH<span style={{ color: "var(--nr-cyan)", textShadow: "0 0 12px rgba(0,240,255,0.4)" }}>PULSE</span>
                </h1>
                <span className="hidden border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest sm:inline" style={{ borderColor: "var(--nr-border)", color: "var(--nr-cyan)" }}>v2.0</span>
              </div>
              <p className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "var(--nr-muted)" }}>// INF_SYS_01 — DEV_BRIEFING</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest" style={{ borderColor: "rgba(57,255,20,0.3)", color: "var(--nr-green)", background: "rgba(57,255,20,0.05)" }}>
              <span className="nr-live-dot h-1.5 w-1.5 rounded-full" style={{ background: "var(--nr-green)" }} />
              ONLINE
            </span>
            <button className="nr-btn" onClick={() => { setPaletteOpen(true); setPaletteQuery(""); }} title="Command palette" type="button">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="hidden sm:inline">SEARCH</span>
              <span className="nr-kbd hidden sm:inline-flex">Ctrl K</span>
            </button>
            <button aria-label="Reading list" className="nr-btn relative" onClick={() => setReadingOpen(true)} type="button">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
              <span className="hidden sm:inline">SAVED</span>
              {bookmarks.length > 0 ? (
                <span className="px-1.5 text-[8px] font-bold" style={{ background: "var(--nr-cyan)", color: "var(--nr-bg)" }}>{bookmarks.length}</span>
              ) : null}
            </button>
          </div>
        </header>

        {/* ══ STATUS BAR ══ */}
        <section className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-baseline gap-3">
            <span className="nr-section-label" style={{ color: "var(--nr-faint)" }}>DAILY_EDITION</span>
            <span className="text-[10px]" style={{ color: "var(--nr-body)" }}>
              {data ? `${editionDate(data.generatedAt)} · ${editionTime(data.generatedAt)}` : "FETCHING_SIGNAL…"}
            </span>
          </div>
          <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>
            SRC: HACKER_NEWS · MODEL: OPENCODE_ZEN
          </span>
        </section>

        {/* ══ TERMINAL ══ */}
        <section className="nr-panel mb-5 overflow-hidden relative" style={{ clipPath: CLIP_MD }}>
          <CornerDecorations />
          <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--nr-border)", background: "rgba(0,240,255,0.02)" }}>
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--nr-magenta)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--nr-amber)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--nr-green)" }} />
            </span>
            <span className="text-[9px] tracking-wider" style={{ color: "var(--nr-faint)" }}>NETRUNNER — TERMINAL — 80×24</span>
            <span className="ml-auto hidden text-[9px] sm:inline" style={{ color: busy ? "var(--nr-amber)" : "var(--nr-green)" }}>{busy ? "⟳ REFRESHING" : "● READY"}</span>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <p className="text-[12px] leading-relaxed sm:text-[13px]">
              <span style={{ color: "var(--nr-green)" }}>$</span>{" "}
              <span style={{ color: "var(--nr-text)" }}>{COMMAND.slice(0, typed)}</span>
              <span className="nr-caret" />
            </p>
            {introDone ? (
              <p className="nr-fade mt-2 text-[10px]" style={{ color: "var(--nr-faint)" }}>
                <span style={{ color: "var(--nr-green)" }}>✔</span> FETCHED {allStories.length || 10} NODES
                <span className="mx-2">·</span>
                <span style={{ color: "var(--nr-cyan)" }}>{sourceLabel}</span>
                <span className="mx-2">·</span>
                PRESS <span className="nr-kbd">?</span> FOR SHORTCUTS
              </p>
            ) : null}
          </div>
        </section>

        {/* ══ MAIN CONTENT ══ */}
        <div className={introDone ? "nr-fade" : "pointer-events-none opacity-0"}>

          {/* Takeaways + Trending */}
          <section className="mb-5 grid gap-4 md:grid-cols-[1.55fr_1fr]">
            <div className="nr-panel p-5 sm:p-6 relative" style={{ clipPath: CLIP_MD }}>
              <CornerDecorations />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--nr-cyan)" }}>
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L20 10.5l-6.1 1.9L12 18l-1.9-5.6L4 10.5l6.1-1.9L12 3z" /></svg>
                  TOP_TAKEAWAYS
                </h2>
                <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>TL;DR</span>
              </div>
              <ol className="space-y-3">
                {(data?.takeaways ?? ["Connecting to Hacker News…", "Ranking today's stories…", "Preparing briefing…"]).map((line, index) => (
                  <li className="flex gap-3 text-[12.5px] leading-relaxed" key={index} style={{ color: "var(--nr-body)" }}>
                    <span className="mt-0.5 text-[9px] font-bold" style={{ color: "var(--nr-cyan)" }}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
            <TrendingChart stories={allStories} />
          </section>

          {/* Controls */}
          <section className="nr-panel mb-4 flex flex-col gap-3 p-3 sm:p-4 relative" style={{ clipPath: CLIP_MD }}>
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((item) => (
                <button aria-pressed={topic === item} className="nr-chip" key={item} onClick={() => { setTopic(item); setActive(0); }} type="button">{item}</button>
              ))}
              <span className="ml-auto hidden text-[9px] sm:inline" style={{ color: "var(--nr-faint)" }}>{stories.length} SHOWN</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-dashed pt-3" style={{ borderColor: "var(--nr-border)" }}>
              <div className="flex border p-0.5" style={{ borderColor: "var(--nr-border)", background: "rgba(0,240,255,0.02)" }}>
                <button aria-pressed={mode === "beginner"} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors" onClick={() => setMode("beginner")}
                  style={mode === "beginner" ? { background: "rgba(0,240,255,0.12)", color: "var(--nr-cyan)", boxShadow: "inset 0 0 12px rgba(0,240,255,0.08)" } : { color: "var(--nr-faint)" }} type="button">
                  Beginner
                </button>
                <button aria-pressed={mode === "technical"} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors" onClick={() => setMode("technical")}
                  style={mode === "technical" ? { background: "rgba(0,240,255,0.12)", color: "var(--nr-cyan)", boxShadow: "inset 0 0 12px rgba(0,240,255,0.08)" } : { color: "var(--nr-faint)" }} type="button">
                  Technical
                </button>
              </div>
              <div className="flex border p-0.5" style={{ borderColor: "var(--nr-border)", background: "rgba(0,240,255,0.02)" }}>
                <button aria-pressed={view === "cards"} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors" onClick={() => setView("cards")}
                  style={view === "cards" ? { background: "rgba(0,240,255,0.12)", color: "var(--nr-cyan)" } : { color: "var(--nr-faint)" }} type="button">
                  Cards
                </button>
                <button aria-pressed={view === "log"} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors" onClick={() => setView("log")}
                  style={view === "log" ? { background: "rgba(0,240,255,0.12)", color: "var(--nr-cyan)" } : { color: "var(--nr-faint)" }} type="button">
                  Git Log
                </button>
              </div>
              <button aria-pressed={devMode} className="nr-btn" onClick={() => setDevMode((v) => !v)}
                style={devMode ? { color: "var(--nr-cyan)", borderColor: "rgba(0,240,255,0.4)" } : undefined} title="Show raw JSON (D)" type="button">
                <span className="font-bold">{"{ }"}</span> DEV
              </button>
              <button className="nr-btn nr-btn-accent ml-auto disabled:opacity-50" disabled={busy} onClick={() => void onRefresh()} title="Refresh (R)" type="button">
                <svg aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? "nr-spin" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" />
                </svg>
                {busy ? "REFRESHING" : "REFRESH"}
                <span className="nr-kbd hidden sm:inline-flex">R</span>
              </button>
            </div>
          </section>

          {/* Error */}
          {error ? (
            <p className="mb-4 border px-4 py-3 text-[10px]" role="alert" style={{ borderColor: "rgba(255,183,3,0.4)", color: "var(--nr-amber)", background: "rgba(255,183,3,0.05)" }}>
              ⚠ {error}
            </p>
          ) : null}

          {/* Story grid / log */}
          {!data ? (
            <SkeletonGrid />
          ) : stories.length === 0 ? (
            <div className="nr-panel p-10 text-center" style={{ clipPath: CLIP_MD }}>
              <p className="text-[11px]" style={{ color: "var(--nr-body)" }}>NO {topic.toUpperCase()} NODES IN TODAY&apos;S TOP 10.</p>
              <button className="nr-btn mt-4" onClick={() => setTopic("All")} type="button">CLEAR_FILTER</button>
            </div>
          ) : view === "cards" ? (
            <div className="grid gap-4 md:grid-cols-2" key={staggerKey}>
              {stories.map((story, index) => (
                <StoryCard active={index === active} bookmarked={savedIds.includes(story.id)} delay={index * 60} devMode={devMode} index={index} key={story.id} mode={mode} onBookmark={toggleBookmark} onFocus={setActive} story={story} total={stories.length} />
              ))}
            </div>
          ) : (
            <GitLog active={active} bookmarks={savedIds} onBookmark={toggleBookmark} onFocus={setActive} stories={stories} />
          )}
        </div>

        {/* ══ FOOTER ══ */}
        <footer className="mt-10 flex flex-col gap-3 border-t border-dashed pt-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--nr-border)" }}>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--nr-faint)" }}>BUILT_WITH_AI • DATA_FROM_HN_API</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>DIGEST: {sourceLabel}</span>
            <span className="text-[9px]" style={{ color: "var(--nr-faint)" }}>PRESS <span className="nr-kbd">?</span> FOR SHORTCUTS</span>
          </div>
        </footer>
      </div>

      {/* ══ MOBILE BAR ══ */}
      <div className="nr-mobile-bar flex items-center justify-between gap-2 sm:hidden">
        <button className="nr-btn flex-1 justify-center" onClick={() => { setPaletteOpen(true); setPaletteQuery(""); }} type="button">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          SEARCH
        </button>
        <button className="nr-btn flex-1 justify-center" onClick={() => setReadingOpen(true)} type="button">
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
          SAVED{bookmarks.length ? ` (${bookmarks.length})` : ""}
        </button>
        <button className="nr-btn flex-1 justify-center" onClick={() => setShortcutsOpen(true)} type="button">
          <span className="font-bold">?</span> KEYS
        </button>
        <button className="nr-btn nr-btn-accent flex-1 justify-center" disabled={busy} onClick={() => void onRefresh()} type="button">
          <svg aria-hidden="true" className={`h-3.5 w-3.5 ${busy ? "nr-spin" : ""}`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          {busy ? "…" : "REFRESH"}
        </button>
      </div>

      {/* ══ COMMAND PALETTE ══ */}
      {paletteOpen ? (
        <div className="nr-overlay flex items-start justify-center px-4 pt-[12vh]" onClick={closeOverlays} role="presentation">
          <div className="nr-sheet w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette" style={{ clipPath: CLIP_LG }}>
            <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--nr-border)" }}>
              <span className="text-[11px]" style={{ color: "var(--nr-cyan)" }}>&gt;_</span>
              <input autoFocus className="nr-input" onInput={(e) => setPaletteQuery((e.currentTarget as HTMLInputElement).value)} onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIndex((i) => Math.min(paletteResults.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIndex((i) => Math.max(0, i - 1)); }
                else if (e.key === "Enter") { e.preventDefault(); paletteResults[paletteIndex]?.run(); }
              }} placeholder="Search stories, topics, commands…" value={paletteQuery} />
              <span className="nr-kbd">ESC</span>
            </div>
            <div className="nr-scroll max-h-[46vh] overflow-y-auto p-2">
              {paletteResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-[10px]" style={{ color: "var(--nr-faint)" }}>NO_MATCHES</p>
              ) : (
                paletteResults.map((item, index) => {
                  const showGroup = index === 0 || paletteResults[index - 1].group !== item.group;
                  return (
                    <div key={item.id}>
                      {showGroup ? <p className="px-3 pb-1 pt-3 text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--nr-faint)" }}>{item.group}</p> : null}
                      <button className="nr-palette-item" data-active={index === paletteIndex} onClick={() => item.run()} onMouseEnter={() => setPaletteIndex(index)} type="button">
                        <span className="truncate text-[11.5px]">{item.label}</span>
                        <span className="ml-auto shrink-0 text-[9px]" style={{ color: "var(--nr-faint)" }}>{item.hint}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex items-center gap-3 border-t px-4 py-2 text-[9px]" style={{ borderColor: "var(--nr-border)", color: "var(--nr-faint)" }}>
              <span><span className="nr-kbd">↑↓</span> NAVIGATE</span>
              <span><span className="nr-kbd">↵</span> RUN</span>
              <span className="ml-auto"><span className="nr-kbd">ESC</span> CLOSE</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* ══ SHORTCUTS ══ */}
      {shortcutsOpen ? (
        <div className="nr-overlay flex items-center justify-center px-4" onClick={closeOverlays} role="presentation">
          <div className="nr-sheet w-full max-w-md p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts" style={{ clipPath: CLIP_LG }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--nr-cyan)" }}>KEYBOARD_SHORTCUTS</h2>
              <button className="nr-btn h-7 w-7 justify-center p-0" onClick={closeOverlays} type="button" aria-label="Close">✕</button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(([keys, description]) => (
                <div className="flex items-center justify-between gap-4 border-b border-dashed pb-2" key={keys} style={{ borderColor: "var(--nr-border)" }}>
                  <span className="text-[11.5px]" style={{ color: "var(--nr-body)" }}>{description}</span>
                  <span className="nr-kbd shrink-0">{keys}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[9px]" style={{ color: "var(--nr-faint)" }}>TIP: SHORTCUTS PAUSE WHILE TYPING IN A SEARCH FIELD</p>
          </div>
        </div>
      ) : null}

      {/* ══ READING LIST ══ */}
      {readingOpen ? (
        <div className="nr-overlay flex items-center justify-center px-4" onClick={closeOverlays} role="presentation">
          <div className="nr-sheet w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Reading list" style={{ clipPath: CLIP_LG }}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--nr-border)" }}>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--nr-cyan)" }}>
                READING_LIST <span style={{ color: "var(--nr-faint)" }}>({bookmarks.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {bookmarks.length > 0 ? (
                  <button className="text-[9px] uppercase" onClick={() => { setBookmarks([]); notify("Reading list cleared"); }} style={{ color: "var(--nr-faint)" }} type="button">CLEAR ALL</button>
                ) : null}
                <button className="nr-btn h-7 w-7 justify-center p-0" onClick={closeOverlays} type="button" aria-label="Close">✕</button>
              </div>
            </div>
            <div className="nr-scroll max-h-[56vh] overflow-y-auto p-3">
              {bookmarks.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-[12px]" style={{ color: "var(--nr-body)" }}>NO_DATA_SAVED.</p>
                  <p className="mt-2 text-[9px]" style={{ color: "var(--nr-faint)" }}>PRESS <span className="nr-kbd">B</span> ON A STORY TO SAVE IT FOR LATER</p>
                </div>
              ) : (
                bookmarks.map((item) => (
                  <div className="flex items-start gap-3 px-3 py-3 transition-colors" key={item.id}>
                    <span className={TOPIC_CLASS[item.topic]}>{item.topic}</span>
                    <div className="min-w-0 flex-1">
                      <a className="block truncate text-[12px] font-medium nr-link" href={item.url} rel="noreferrer" target="_blank">{item.title}</a>
                      <p className="mt-0.5 text-[9px]" style={{ color: "var(--nr-faint)" }}>{formatScore(item.score)} PTS · {sourceOf(item.url)}</p>
                    </div>
                    <a className="shrink-0 text-[9px]" href={item.hnUrl} rel="noreferrer" style={{ color: "var(--nr-muted)" }} target="_blank">HN</a>
                    <button aria-label="Remove bookmark" className="shrink-0 text-[9px]" onClick={() => { setBookmarks(bookmarks.filter((e) => e.id !== item.id)); notify("Removed from reading list"); }} style={{ color: "var(--nr-faint)" }} type="button">✕</button>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-dashed px-5 py-2 text-[9px]" style={{ borderColor: "var(--nr-border)", color: "var(--nr-faint)" }}>
              SAVED_LOCALLY · PERSISTS_ACROSS_REFRESHES
            </div>
          </div>
        </div>
      ) : null}

      {/* ══ TOAST ══ */}
      <div aria-live="polite" className="pointer-events-none fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 sm:bottom-6">
        {toast ? (
          <div className="nr-fade border px-4 py-2 shadow-xl" style={{ borderColor: "var(--nr-border-strong)", background: "var(--nr-panel-solid)", color: "var(--nr-cyan)", boxShadow: "0 0 20px rgba(0,240,255,0.15)" }}>
            <span className="text-[10px] font-bold uppercase tracking-wider">{toast}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
