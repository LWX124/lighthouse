import { describe, it, expect } from "vitest";
import { parseHNStories } from "../src/queues/collect-hn.js";

const mockHNResponse = {
  hits: [
    {
      objectID: "111",
      title: "Show HN: AI Code Review Tool",
      url: "https://example.com/ai-code-review",
      points: 150,
      created_at_i: 1743897600,
      _tags: ["story", "show_hn"],
    },
    {
      objectID: "222",
      title: "Ask HN: Best AI tools for startups?",
      url: null,
      points: 89,
      created_at_i: 1743894000,
      _tags: ["story", "ask_hn"],
    },
    {
      objectID: "333",
      title: "OpenAI Announces GPT-5",
      url: "https://openai.com/gpt5",
      points: 342,
      created_at_i: 1743890400,
      _tags: ["story"],
    },
  ],
};

describe("parseHNStories", () => {
  it("parses stories with external URLs", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      source_id: "source-1",
      title: "Show HN: AI Code Review Tool",
      url: "https://example.com/ai-code-review",
      summary: null,
      content: null,
      ai_tags: [],
      ai_summary: null,
      engagement_score: 150,
      published_at: new Date(1743897600 * 1000).toISOString(),
    });
  });

  it("falls back to HN comment URL when no external URL", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items[1].url).toBe("https://news.ycombinator.com/item?id=222");
  });

  it("uses points as engagement_score", () => {
    const items = parseHNStories(mockHNResponse.hits, "source-1");
    expect(items[2].engagement_score).toBe(342);
  });
});
