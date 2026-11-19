# TechPulse

Your 2-minute daily programming news, summarized by AI.

A single-page daily digest of the top 10 programming and tech stories from Hacker News. Each story has an AI-written summary, a "Why it matters" line for student developers, a topic tag, and a link to the original article.

## Features

- Top Takeaways: three lines on the day's biggest trends
- Topic filters: AI, Web, Security, Tools, Open Source
- Beginner / Technical toggle for summary depth
- Refresh button for on-demand updates
- Dark, minimal, mobile-friendly single page with no login

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

Server-only secrets live in `.env.lakebed.server` (git-ignored):

```txt
OPENCODE_ZEN_API_KEY=oc_sk_...
OPENCODE_ZEN_MODEL=big-pickle
```

If the AI provider is unavailable or rate-limited, the app automatically shows lightweight generated summaries so the digest still works.

## Deploy

```sh
npx lakebed deploy
```

Outbound server-side fetch and server env require a claimed deploy.
