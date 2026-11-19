export const TOPICS = ["AI", "Web", "Security", "Tools", "Open Source"] as const;

export type Topic = (typeof TOPICS)[number];
export type ExplanationMode = "beginner" | "technical";

export interface DigestStory {
  id: number;
  title: string;
  url: string;
  hnUrl: string;
  score: number;
  comments: number;
  by: string;
  topic: Topic;
  beginner: string;
  technical: string;
  why: string;
}

export interface Digest {
  stories: DigestStory[];
  takeaways: string[];
  generatedAt: number;
  source: "ai" | "seed" | "fallback";
}
