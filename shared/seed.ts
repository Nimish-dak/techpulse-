import type { Topic } from "./digest";

export interface SeedStory {
  topic: Topic;
  beginner: string;
  technical: string;
  why: string;
}

/**
 * AI-written snapshot of the top programming stories, used when the live
 * OpenCode Zen call is rate-limited. Matching happens by Hacker News item id,
 * so fresh stories automatically fall back to generated summaries.
 */
export const SEED_STORY_SUMMARIES: Record<number, SeedStory> = {
  50561508: {
    topic: "AI",
    beginner: "Pete Warden, creator of Moonshine Voice, explains why more AI is moving onto local devices instead of the cloud. The short version: privacy, latency, and cost all improve when models run on your own hardware.",
    technical: "The interview covers on-device inference trade-offs — smaller quantized models, privacy guarantees, and lower latency versus cloud scale — using speech recognition as the running example.",
    why: "Local-first AI is a growing pattern, and understanding its trade-offs helps you design apps that work offline and respect user data."
  },
  50559719: {
    topic: "Web",
    beginner: "This project shows how to fold a single sheet of A4 paper into an eight-page zine, with the layout handled in the browser. It is a fun mix of papercraft and front-end code.",
    technical: "The web app computes page imposition for a single-sheet fold, then generates a print-ready layout so the pages land in the right order after folding and cutting.",
    why: "It is a neat example of using code to solve a physical-world problem and a good excuse to practice layout math."
  },
  50558906: {
    topic: "Security",
    beginner: "A security researcher reported a serious Java bug, nicknamed java4shell, through an OpenJDK pull request. The write-up matters because Java runs on a huge number of servers.",
    technical: "The linked OpenJDK PR discusses the java4shell issue and the fix; follow the thread for affected versions and mitigation guidance before deploying.",
    why: "Following a real vulnerability disclosure teaches you how maintainers triage, patch, and communicate security issues."
  },
  50560461: {
    topic: "Web",
    beginner: "OpenAI still struggles with WebRTC, the browser technology used for real-time audio and video. The post argues that reliability issues in WebRTC affect any product built on live media.",
    technical: "The article examines WebRTC's complexity and failure modes in OpenAI's real-time stack, arguing that transport behavior — not just model quality — determines the user experience.",
    why: "Real-time features are hard; learning where WebRTC breaks helps you build more reliable chat, voice, and video apps."
  },
  50547374: {
    topic: "Security",
    beginner: "Researchers found a flaw that can let an attacker run code on servers using Nginx with HTTP/2, without logging in. If you run web servers, update Nginx now.",
    technical: "The HTTP/2 module contains memory-safety bugs that enable unauthenticated remote code execution. Patch to the fixed release; as a stopgap, disable HTTP/2 or restrict exposure.",
    why: "Nginx powers a huge share of the web, so this is a sharp reminder to patch internet-facing services quickly."
  },
  50548021: {
    topic: "AI",
    beginner: "Microsoft announced seven new AI models aimed at doing more work for less money. The pitch is that teams can pick a model by cost and speed instead of always defaulting to the biggest one.",
    technical: "The lineup spans different size and price tiers for chat, coding, and multimodal tasks, with per-token pricing designed to make routing each workload to an appropriate model practical.",
    why: "Model choice is becoming an engineering decision about cost, latency, and quality — a useful skill to practice early."
  },
  50553843: {
    topic: "AI",
    beginner: "Anthropic, the company behind Claude, has set the price for its initial public offering — a major step toward becoming a public company.",
    technical: "The filing prices shares ahead of trading, giving the market a concrete valuation for a frontier AI lab and more visibility into its revenue and compute costs.",
    why: "The business side of AI shapes which tools and APIs stay affordable for students and side projects."
  },
  50554038: {
    topic: "Security",
    beginner: "Ruby released fixes for several security bugs in regular expressions and string case conversion. Updating Ruby is the simplest protection.",
    technical: "The advisories cover multiple issues in Regexp handling and String case-conversion paths; apply the patched Ruby releases or vendor patches for affected branches.",
    why: "Even mature languages ship security fixes — reading an advisory and upgrading safely is a core developer skill."
  },
  50556287: {
    topic: "Security",
    beginner: "A security team published details of a bug that can take over a standard Rails app before a user logs in. Rails teams should check for patches and upgrade.",
    technical: "The pre-authentication RCE sits in stock Rails request handling. Identify affected versions, apply the fixed release, and audit any exposed endpoints.",
    why: "Rails is widely used in startups, so understanding pre-auth RCE risk helps you prioritize upgrades in real projects."
  },
  50553225: {
    topic: "AI",
    beginner: "A write-up shows how a large language model can help make sense of compiled code during reverse engineering. The model is an assistant, not a replacement for understanding the binary.",
    technical: "The author uses an LLM to annotate disassembly, suggest struct layouts, and speed up hypothesis testing while verifying every result against the binary.",
    why: "AI-assisted tooling is spreading beyond code generation into debugging and security analysis."
  },
  50556533: {
    topic: "Web",
    beginner: "An engineer got 15 million web servers running on a single virtual machine by bypassing parts of the normal network stack. It is an extreme systems experiment, not a normal deployment.",
    technical: "The setup combines smoltcp, DPDK, and AF_XDP to handle packets in user space, avoiding kernel overhead and per-connection costs at massive scale.",
    why: "It shows how understanding networking internals unlocks performance that frameworks alone cannot reach."
  },
  50557537: {
    topic: "Open Source",
    beginner: "Zerodha built a distributed storage system for large files on top of SQLite, the tiny database that usually lives in a single file. It shows SQLite can scale further than many people expect.",
    technical: "The design shards blobs across SQLite instances and layers replication and metadata on top, trading some simplicity for predictable read and write performance.",
    why: "Real architecture write-ups teach you how to combine simple building blocks into reliable systems."
  },
  50547048: {
    topic: "Open Source",
    beginner: "Nintendo asked GitHub to remove Picofly firmware used to modify Switch consoles, and the repository is now down. The case is part of the long fight over console modding.",
    technical: "The takedown targets firmware that exploits the Switch recovery mode. The code is widely mirrored, so removal mainly shifts distribution rather than ending it.",
    why: "It shows how copyright enforcement and open-source hosting intersect — relevant to anyone publishing low-level code."
  },
  50560357: {
    topic: "Tools",
    beginner: "PostgreSQL 19, the newest version of the popular open-source database, is out with performance and developer improvements. Upgrading can be worthwhile after testing.",
    technical: "The release adds planner and indexing improvements plus operational changes; review the release notes and migration steps before upgrading production clusters.",
    why: "PostgreSQL is a standard skill for backend and data work, so following its releases keeps your knowledge current."
  }
};

export const SEED_STORY_IDS: number[] = Object.keys(SEED_STORY_SUMMARIES).map(Number);

export const SEED_TAKEAWAYS: string[] = [
  "Security dominated the day, with critical remote-code-execution and memory-safety fixes across widely used frameworks and web infrastructure.",
  "AI news kept expanding — from local-first inference and cheaper model tiers to major business moves by frontier labs.",
  "Open-source infrastructure stayed active, with new work on SQLite-based storage, high-performance networking, and database releases."
];
