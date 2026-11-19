# TechPulse

Your 2-minute daily programming news, summarized by AI.

A single-page daily digest of the top 10 programming and tech stories from Hacker News. Each story has an AI-written summary, a "Why it matters" line for student developers, a topic tag, and a link to the original article.

## Features

- Top Takeaways: three lines on the day's biggest trends
- Topic filters: AI, Web, Security, Tools, Open Source
- Beginner / Technical toggle for summary depth
- Refresh button for on-demand updates
- Dark / light theme with a glassmorphism, animated-grid interface
- Command palette (`Ctrl K`) for searching stories and running actions
- Keyboard shortcuts: `J`/`K` navigate, `O` open, `B` bookmark, `?` cheat sheet
- Git-log view that lists stories as commits
- Dev mode with syntax-highlighted raw JSON and copy buttons
- Reading list bookmarks that persist in local storage
- Trending-topics bar chart, read-time estimates, and GitHub-style scores
- Fully responsive, single page, no login

## Stack

- [Lakebed](https://lakebed.dev/) capsule (Preact client + TypeScript server)
- [Hacker News Firebase API](https://github.com/HackerNews/API) for stories
- [OpenCode Zen](https://opencode.ai/docs/console/api/inference) free models for AI summaries

## Run locally

```sh
npx lakebed dev
```

Open http://localhost:3000.

## Configuration

Server-only secrets live in `.env.lakebed.server` (git-ignored). The AI call uses any
OpenAI-compatible Chat Completions endpoint:

```txt
# Generic provider (recommended)
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=sk-...
AI_MODEL=your-model-id
# Optional: comma-separated retries if the primary model is overloaded
AI_FALLBACK_MODELS=backup-model-id

# OpenCode Zen defaults (used when the generic vars are absent)
OPENCODE_ZEN_API_KEY=oc_sk_...
OPENCODE_ZEN_MODEL=big-pickle
```

Leave `AI_BASE_URL` unset to use OpenCode Zen's `https://opencode.ai/zen/v1`.
Gemini, Groq, OpenRouter, Together, and many others all expose an OpenAI-compatible
`/chat/completions` path.

Gemini also works in its native form: set `AI_BASE_URL` to
`https://generativelanguage.googleapis.com/v1beta` (no `/openai`) and the server uses
`generateContent` with JSON output mode and a low thinking budget, which is faster.
The current setup is `AI_MODEL=gemini-3.1-flash-lite` with
`AI_FALLBACK_MODELS=gemini-3.5-flash-lite`.

The whole AI call is capped at 18 seconds total (15 seconds per model) so the digest
still returns inside the handler budget when a provider is slow or overloaded.

If the AI provider is unavailable or rate-limited, the app falls back to a cached
AI-written snapshot of today's stories, then to lightweight generated summaries, so
the digest always works.

## Deploy

```sh
npx lakebed deploy
```

Outbound server-side fetch and server env require a claimed deploy.
