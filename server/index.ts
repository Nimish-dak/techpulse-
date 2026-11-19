import { capsule, endpoint, mutation, number, query, string, table, text } from "lakebed/server";
import { TOPICS, type Digest, type DigestStory, type Topic } from "../shared/digest";
import { SEED_STORY_SUMMARIES, SEED_TAKEAWAYS } from "../shared/seed";

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  by?: string;
  type?: string;
  time?: number;
}

type Env = Record<string, string | undefined>;

const TOP_STORIES_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM_URL = "https://hacker-news.firebaseio.com/v0/item";
const CACHE_MS = 24 * 60 * 60 * 1000; // 24-hour daily cache

function getDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

let cache: Digest | null = null;
let cacheTime = 0;
let inflight: Promise<Digest> | null = null;
let lastWarning: string | undefined;

function domain(url: string): string {
  return url.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
}

function topicFor(title: string): Topic {
  const value = title.toLowerCase();
  if (/\b(ai|llm|gpt|claude|gemini|model|neural|machine learning|agent|transformer|openai|anthropic)\b/.test(value)) return "AI";
  if (/\b(security|secure|vulnerability|cve|breach|exploit|password|encrypt|phishing|malware|auth)\b/.test(value)) return "Security";
  if (/\b(web|browser|css|html|react|vue|javascript|typescript|http|frontend|backend|next\.js|node)\b/.test(value)) return "Web";
  if (/\b(open source|opensource|github|gitlab|license|foss|community|foundation)\b/.test(value)) return "Open Source";
  return "Tools";
}

function cleanLine(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function fallbackDigest(items: HnItem[]): Digest {
  const stories: DigestStory[] = items.map((item) => {
    const title = item.title ?? "Untitled story";
    const topic = topicFor(title);
    return {
      id: item.id,
      title,
      url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
      hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
      score: item.score ?? 0,
      comments: item.descendants ?? 0,
      by: item.by ?? "",
      topic,
      beginner: `“${title}” is drawing attention on Hacker News today. It is a useful one-minute read to see what developers are talking about right now.`,
      technical: `Community discussion around “${title}” (${item.score ?? 0} points). Open the source for the implementation details, benchmarks, and trade-offs people are debating.`,
      why: `Knowing what is trending helps you decide which tools and topics are worth exploring next.`
    };
  });

  const takeaways = stories.slice(0, 3).map((story, index) =>
    `${index + 1}. ${story.title} — a top discussion in ${story.topic.toLowerCase()} today.`
  );
  for (let index = takeaways.length; index < 3; index += 1) {
    takeaways.push("Check back tomorrow for another two-minute digest of developer news.");
  }

  return { stories, takeaways, generatedAt: Date.now(), source: "fallback" };
}

function seedDigest(items: HnItem[]): Digest {
  const fallback = fallbackDigest(items);
  const stories = fallback.stories.map((base) => {
    const seed = SEED_STORY_SUMMARIES[base.id];
    return seed ? { ...base, ...seed } : base;
  });
  const matched = stories.filter((story) => Boolean(SEED_STORY_SUMMARIES[story.id])).length;
  return {
    stories,
    takeaways: matched >= 5 ? SEED_TAKEAWAYS : fallback.takeaways,
    generatedAt: Date.now(),
    source: matched > 0 ? "seed" : "fallback"
  };
}

const STRONG_PATTERN = /program|developer|software|code|coding|linux|python|javascript|typescript|rust|golang|java\b|compiler|database|\bsql\b|sqlite|postgres|\bapi\b|server|browser|security|vulnerab|exploit|encrypt|\bai\b|llm|openai|anthropic|github|open.?source|kernel|docker|kubernetes|\bgit\b|react|node|devops|terminal|\bcli\b|reverse.?engineer|malware|ransom|phishing|password|privacy|\bhttp\b|\bdns\b|\btcp\b|unix|bsd|\bnix\b|webgpu|rails|ruby/i;
const WEAK_PATTERN = /\bweb\b|model|library|robot|quantum|android|\bios\b|windows|macos|firefox|chrome|safari|self.?host|surveillance|framework|algorithm|machine.?learning|neural|chip|cpu|gpu|cloud/i;
const TECH_DOMAIN = /github\.com|gitlab|arxiv|kernel\.org|mozilla|w3\.org|python|rust-lang|go\.dev|nodejs|npmjs|postgresql|ruby-lang/i;

function relevanceScore(item: HnItem): number {
  const title = item.title ?? "";
  const url = item.url ?? "";
  if (STRONG_PATTERN.test(title) || TECH_DOMAIN.test(url)) return 2;
  if (WEAK_PATTERN.test(title)) return 1;
  return 0;
}

async function fetchStories(): Promise<HnItem[]> {
  const response = await fetch(TOP_STORIES_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Hacker News returned ${response.status}`);
  const ids: number[] = await response.json();

  const items = await Promise.all(
    ids.slice(0, 40).map(async (id) => {
      try {
        const result = await fetch(`${ITEM_URL}/${id}.json`, { headers: { Accept: "application/json" } });
        if (!result.ok) return null;
        return (await result.json()) as HnItem;
      } catch {
        return null;
      }
    })
  );

  const usable = items.filter(
    (item): item is HnItem => Boolean(item && item.type === "story" && item.title && item.url)
  );
  const strongHot = usable.filter((item) => relevanceScore(item) === 2 && (item.score ?? 0) >= 10);
  const strongOther = usable.filter((item) => relevanceScore(item) === 2 && (item.score ?? 0) < 10);
  const weak = usable.filter((item) => relevanceScore(item) === 1);
  const rest = usable.filter((item) => relevanceScore(item) === 0);

  return [...strongHot, ...strongOther, ...weak, ...rest].slice(0, 10);
}

function extractJson(content: string): Record<string, unknown> {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI did not return JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

const AI_TOTAL_TIMEOUT_MS = 18000;
const AI_ATTEMPT_TIMEOUT_MS = 15000;

function modelChain(env: Env, baseUrl: string): string[] {
  const primary = env.AI_MODEL || env.OPENCODE_ZEN_MODEL || "big-pickle";
  const fallbacks = env.AI_FALLBACK_MODELS
    ?? (baseUrl.includes("generativelanguage.googleapis.com") ? "gemini-3.5-flash-lite" : "");
  const chain = [primary, ...fallbacks.split(",").map((model) => model.trim()).filter(Boolean)];
  return chain.filter((model, index) => chain.indexOf(model) === index);
}

async function requestAiContent(
  env: Env,
  model: string,
  baseUrl: string,
  endpoint: string,
  system: string,
  storyList: string,
  timeoutMs: number
): Promise<string> {
  const key = env.AI_API_KEY ?? env.OPENCODE_ZEN_API_KEY ?? env.OPENCODE_API_KEY;
  if (!key) throw new Error("No AI API key is configured");

  if (baseUrl.includes("generativelanguage.googleapis.com") && !baseUrl.endsWith("/openai")) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.3,
      maxOutputTokens: 2800,
      responseMimeType: "application/json"
    };
    if (/^gemini-3/i.test(model)) {
      generationConfig.thinkingConfig = { thinkingLevel: "low" };
    }

    const nativeResponse = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: `Today's stories:\n${storyList}` }] }],
        generationConfig
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!nativeResponse.ok) {
      const detail = await nativeResponse.text().catch(() => "");
      throw new Error(`${model}: AI provider returned ${nativeResponse.status}: ${detail.slice(0, 160)}`);
    }

    const nativePayload = await nativeResponse.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      promptFeedback?: { blockReason?: string };
    };
    if (nativePayload.promptFeedback?.blockReason) {
      throw new Error(`${model}: AI blocked the request (${nativePayload.promptFeedback.blockReason})`);
    }
    const nativeContent = nativePayload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (!nativeContent) throw new Error(`${model}: AI provider returned no content`);
    return nativeContent;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`
  };
  if (baseUrl.includes("opencode.ai")) {
    headers["x-opencode-session"] = `techpulse-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Today's stories:\n${storyList}` }
    ],
    temperature: 0.3,
    max_tokens: 3000
  };
  if (baseUrl.includes("generativelanguage.googleapis.com")) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${model}: AI provider returned ${response.status}: ${detail.slice(0, 160)}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model}: AI provider returned no content`);
  return content;
}

async function aiDigest(env: Env, items: HnItem[]): Promise<Digest> {
  const baseUrl = (env.AI_BASE_URL || "https://opencode.ai/zen/v1").replace(/\/+$/, "");
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
  const models = modelChain(env, baseUrl);
  const fallback = fallbackDigest(items);
  const storyList = items
    .map((item, index) => `${index + 1}. id=${item.id} | ${item.title} | ${domain(item.url ?? "")} | ${item.score ?? 0} points`)
    .join("\n");

  const system = [
    "You write a daily programming news digest for students and developers.",
    "Return ONLY a JSON object with exactly this shape, no markdown:",
    '{"takeaways":["line 1","line 2","line 3"],"stories":[{"id":123,"topic":"AI","beginner":"...","technical":"...","why":"..."}]}',
    "Rules:",
    "- takeaways: exactly 3 short lines naming the biggest trends across today's stories.",
    "- topic must be exactly one of: AI, Web, Security, Tools, Open Source.",
    "- beginner: 1-2 plain sentences explaining the story without jargon.",
    "- technical: 1-2 sentences with the concrete details a developer would want.",
    "- why: one sentence on why a student developer should care.",
    "- Include every story id from the input, in the same order. Keep each line under 220 characters."
  ].join("\n");

  let content = "";
  let lastError: unknown = null;
  const startedAt = Date.now();
  for (const model of models) {
    const remaining = AI_TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining < 3000) break;
    try {
      content = await requestAiContent(env, model, baseUrl, endpoint, system, storyList, Math.min(remaining, AI_ATTEMPT_TIMEOUT_MS));
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!content) {
    if (lastError instanceof Error) throw lastError;
    throw new Error("AI provider unavailable");
  }

  const parsed = extractJson(content);
  const rawTakeaways = Array.isArray(parsed.takeaways) ? parsed.takeaways : [];
  const takeaways = rawTakeaways.map((line) => cleanLine(line, 220)).filter(Boolean).slice(0, 3);

  const byId = new Map<number, Record<string, unknown>>();
  const rawStories = Array.isArray(parsed.stories) ? parsed.stories : [];
  for (const entry of rawStories) {
    if (entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "number") {
      byId.set((entry as Record<string, unknown>).id as number, entry as Record<string, unknown>);
    }
  }

  const stories = fallback.stories.map((base) => {
    const entry = byId.get(base.id);
    if (!entry) return base;
    const maybeTopic = cleanLine(entry.topic, 20);
    return {
      ...base,
      topic: (TOPICS as readonly string[]).includes(maybeTopic) ? (maybeTopic as Topic) : base.topic,
      beginner: cleanLine(entry.beginner, 300) || base.beginner,
      technical: cleanLine(entry.technical, 300) || base.technical,
      why: cleanLine(entry.why, 240) || base.why
    };
  });

  return {
    stories,
    takeaways: takeaways.length === 3 ? takeaways : fallback.takeaways,
    generatedAt: Date.now(),
    source: "ai"
  };
}

async function buildDigest(env: Env, force: boolean): Promise<{ digest: Digest; warning?: string }> {
  const now = Date.now();
  const todayKey = getDayKey(now);
  if (!force && cache && now - cacheTime < CACHE_MS && getDayKey(cacheTime) === todayKey) {
    return { digest: cache, warning: lastWarning };
  }

  if (!inflight) {
    inflight = (async () => {
      const items = await fetchStories();
      try {
        cache = await aiDigest(env, items);
        lastWarning = undefined;
      } catch (error) {
        lastWarning = error instanceof Error ? error.message : "AI summaries unavailable";
        cache = seedDigest(items);
      }
      cacheTime = Date.now();
      return cache;
    })().finally(() => {
      inflight = null;
    });
  }

  const digest = await inflight;
  return { digest, warning: lastWarning };
}

export default capsule({
  name: "TechPulse",

  auth: { requireSignIn: false },

  schema: {
    digests: table({
      dayKey: string(),
      dataJson: string(),
      generatedAt: number()
    }).index("by_day", ["dayKey"])
  },

  queries: {
    digest: query(
      async (ctx) => {
        const now = Date.now();
        const todayKey = getDayKey(now);

        // 1. In-memory check (0 ms response, zero external network requests)
        if (cache && now - cacheTime < CACHE_MS && getDayKey(cacheTime) === todayKey) {
          return cache;
        }

        // 2. Database check (5 ms response, survives worker cold-starts without calling HN or AI)
        try {
          const dbRow = await ctx.db.digests
            .withIndex("by_day", (q) => q.eq("dayKey", todayKey))
            .order("desc")
            .first();

          if (dbRow && typeof dbRow.dataJson === "string") {
            const parsed = JSON.parse(dbRow.dataJson) as Digest;
            cache = parsed;
            cacheTime = dbRow.generatedAt || now;
            return cache;
          }
        } catch (err) {
          ctx.log.warn("Database cache lookup failed", { error: err instanceof Error ? err.message : String(err) });
        }

        // 3. Fallback: generate today's initial digest if not created yet
        const result = await buildDigest(ctx.env, false);
        if (result.warning) ctx.log.warn("AI summaries unavailable", { reason: result.warning });
        return result.digest;
      },
      { tool: { description: "Get today's top 10 programming stories with AI summaries and takeaways." } }
    )
  },

  mutations: {
    refreshDigest: mutation(async (ctx) => {
      // Explicit user action: re-fetch from Hacker News and re-run AI summarization
      const result = await buildDigest(ctx.env, true);
      if (result.warning) ctx.log.warn("AI summaries unavailable on refresh", { reason: result.warning });

      // Persist to database so subsequent visitors get the refreshed digest instantly
      try {
        const todayKey = getDayKey(result.digest.generatedAt);
        await ctx.db.digests.insert({
          dayKey: todayKey,
          dataJson: JSON.stringify(result.digest),
          generatedAt: result.digest.generatedAt
        });
      } catch (err) {
        ctx.log.warn("Failed to persist digest to database", { error: err instanceof Error ? err.message : String(err) });
      }

      return result.digest;
    })
  },

  endpoints: {
    status: endpoint({ method: "GET", path: "/api/status", readOnly: true }, () => text("ok"))
  }
});
