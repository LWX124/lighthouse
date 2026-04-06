import { describe, it, expect } from "vitest";
import { buildTagPrompt, parseTagResponse } from "../src/queues/ai-tag-summarize.js";

describe("buildTagPrompt", () => {
  it("builds a prompt with the news title and summary", () => {
    const prompt = buildTagPrompt("AI Code Review Tool Launches", "A new tool for reviewing code using AI.");
    expect(prompt).toContain("AI Code Review Tool Launches");
    expect(prompt).toContain("A new tool for reviewing code using AI.");
    expect(prompt).toContain("tags");
    expect(prompt).toContain("summary");
  });

  it("handles missing summary", () => {
    const prompt = buildTagPrompt("AI News Title", null);
    expect(prompt).toContain("AI News Title");
    expect(prompt).toContain("无摘要");
  });
});

describe("parseTagResponse", () => {
  it("parses valid JSON response", () => {
    const response = JSON.stringify({
      tags: ["ai", "code-review", "developer-tools"],
      summary: "一款新的 AI 代码审查工具发布",
    });
    const result = parseTagResponse(response);
    expect(result.tags).toEqual(["ai", "code-review", "developer-tools"]);
    expect(result.summary).toBe("一款新的 AI 代码审查工具发布");
  });

  it("returns empty result for invalid JSON", () => {
    const result = parseTagResponse("not valid json");
    expect(result.tags).toEqual([]);
    expect(result.summary).toBeNull();
  });

  it("limits tags to 5", () => {
    const response = JSON.stringify({
      tags: ["a", "b", "c", "d", "e", "f", "g"],
      summary: "test",
    });
    const result = parseTagResponse(response);
    expect(result.tags).toHaveLength(5);
  });
});
