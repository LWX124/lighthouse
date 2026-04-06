import { describe, it, expect } from "vitest";
import { parseRedditPosts } from "../src/queues/collect-reddit.js";

const mockRedditPosts = [
  {
    id: "abc123",
    title: "[D] New breakthrough in AI alignment research",
    url: "https://arxiv.org/abs/1234.5678",
    selftext: "This paper proposes a novel approach...",
    score: 456,
    created_utc: 1743897600,
    subreddit: "MachineLearning",
    permalink: "/r/MachineLearning/comments/abc123/new_breakthrough/",
    is_self: false,
  },
  {
    id: "def456",
    title: "What AI tools are you using for coding in 2026?",
    url: "https://www.reddit.com/r/artificial/comments/def456/what_ai_tools/",
    selftext: "I'm curious what everyone is using...",
    score: 234,
    created_utc: 1743894000,
    subreddit: "artificial",
    permalink: "/r/artificial/comments/def456/what_ai_tools/",
    is_self: true,
  },
];

describe("parseRedditPosts", () => {
  it("parses reddit posts into news items", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("[D] New breakthrough in AI alignment research");
    expect(items[0].url).toBe("https://arxiv.org/abs/1234.5678");
    expect(items[0].engagement_score).toBe(456);
  });

  it("uses reddit permalink for self posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[1].url).toBe("https://www.reddit.com/r/artificial/comments/def456/what_ai_tools/");
  });

  it("uses selftext as summary for self posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[1].summary).toBe("I'm curious what everyone is using...");
  });

  it("sets null summary for link posts", () => {
    const items = parseRedditPosts(mockRedditPosts, "source-reddit");
    expect(items[0].summary).toBeNull();
  });
});
