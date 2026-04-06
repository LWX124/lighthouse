import { describe, it, expect } from "vitest";
import { parseRSSItems } from "../src/queues/collect-rss.js";

const mockRSSItems = [
  {
    title: "The Future of AI Agents",
    link: "https://blog.example.com/ai-agents",
    contentSnippet: "AI agents are transforming how we interact with software...",
    isoDate: "2026-04-05T12:00:00Z",
  },
  {
    title: "Building with Claude Agent SDK",
    link: "https://blog.example.com/claude-sdk",
    contentSnippet: "A deep dive into the Claude Agent SDK for building autonomous agents.",
    isoDate: "2026-04-04T08:30:00Z",
  },
  {
    title: "Post without date",
    link: "https://blog.example.com/no-date",
    contentSnippet: "This post has no date",
    isoDate: undefined,
  },
];

describe("parseRSSItems", () => {
  it("parses RSS items into news items", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      source_id: "source-rss",
      title: "The Future of AI Agents",
      url: "https://blog.example.com/ai-agents",
      summary: "AI agents are transforming how we interact with software...",
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 0,
      published_at: "2026-04-05T12:00:00Z",
    });
  });

  it("uses contentSnippet as summary", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items[1].summary).toBe(
      "A deep dive into the Claude Agent SDK for building autonomous agents."
    );
  });

  it("uses current time when isoDate is missing", () => {
    const before = new Date().toISOString();
    const items = parseRSSItems(mockRSSItems, "source-rss");
    const after = new Date().toISOString();
    expect(items[2].published_at >= before).toBe(true);
    expect(items[2].published_at <= after).toBe(true);
  });

  it("sets engagement_score to 0 for RSS items", () => {
    const items = parseRSSItems(mockRSSItems, "source-rss");
    expect(items[0].engagement_score).toBe(0);
  });
});
