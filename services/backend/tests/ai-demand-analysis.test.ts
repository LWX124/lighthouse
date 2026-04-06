import { describe, it, expect } from "vitest";
import { buildDemandPrompt, parseDemandResponse } from "../src/queues/ai-demand-analysis.js";

describe("buildDemandPrompt", () => {
  it("includes the news title and summary in the prompt", () => {
    const prompt = buildDemandPrompt(
      "Developers frustrated with slow CI/CD pipelines",
      "A survey shows 67% of developers waste 30+ minutes daily on builds."
    );
    expect(prompt).toContain("Developers frustrated");
    expect(prompt).toContain("67% of developers");
  });
});

describe("parseDemandResponse", () => {
  it("parses a valid demand signal response", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "pain_point",
      score: 82,
      market_size_est: "大型 ($100M+)",
      competition_lvl: "medium",
      ai_analysis: "CI/CD 慢是开发者普遍痛点，市场上已有解决方案但仍有改进空间",
    });
    const result = parseDemandResponse(response);
    expect(result).not.toBeNull();
    expect(result!.signal_type).toBe("pain_point");
    expect(result!.score).toBe(82);
    expect(result!.market_size_est).toBe("大型 ($100M+)");
    expect(result!.competition_lvl).toBe("medium");
  });

  it("returns null when has_signal is false", () => {
    const response = JSON.stringify({ has_signal: false });
    const result = parseDemandResponse(response);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseDemandResponse("not json");
    expect(result).toBeNull();
  });

  it("clamps score to 0-100 range", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "trending",
      score: 150,
      market_size_est: null,
      competition_lvl: null,
      ai_analysis: "Test",
    });
    const result = parseDemandResponse(response);
    expect(result!.score).toBe(100);
  });

  it("rejects invalid signal_type", () => {
    const response = JSON.stringify({
      has_signal: true,
      signal_type: "invalid_type",
      score: 50,
      market_size_est: null,
      competition_lvl: null,
      ai_analysis: "Test",
    });
    const result = parseDemandResponse(response);
    expect(result).toBeNull();
  });
});
