import { describe, it, expect } from "vitest";
import { parsePHPosts } from "../src/queues/collect-ph.js";

const mockPHPosts = [
  {
    id: "post-1",
    name: "CodePilot AI",
    tagline: "AI-powered code completion for VS Code",
    url: "https://www.producthunt.com/posts/codepilot-ai",
    website: "https://codepilot.ai",
    votesCount: 523,
    createdAt: "2026-04-05T08:00:00Z",
    topics: { edges: [{ node: { name: "Artificial Intelligence" } }, { node: { name: "Developer Tools" } }] },
  },
  {
    id: "post-2",
    name: "DesignAI",
    tagline: "Generate UI designs from text descriptions",
    url: "https://www.producthunt.com/posts/designai",
    website: "https://designai.com",
    votesCount: 312,
    createdAt: "2026-04-05T10:00:00Z",
    topics: { edges: [{ node: { name: "Design Tools" } }] },
  },
];

describe("parsePHPosts", () => {
  it("parses PH posts into news items", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      source_id: "source-ph",
      title: "CodePilot AI",
      url: "https://codepilot.ai",
      summary: "AI-powered code completion for VS Code",
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 523,
      published_at: "2026-04-05T08:00:00Z",
    });
  });

  it("falls back to PH URL when no website", () => {
    const posts = [{ ...mockPHPosts[0], website: null }];
    const items = parsePHPosts(posts, "source-ph");
    expect(items[0].url).toBe("https://www.producthunt.com/posts/codepilot-ai");
  });

  it("uses votesCount as engagement_score", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items[1].engagement_score).toBe(312);
  });

  it("uses tagline as summary", () => {
    const items = parsePHPosts(mockPHPosts, "source-ph");
    expect(items[0].summary).toBe("AI-powered code completion for VS Code");
  });
});
