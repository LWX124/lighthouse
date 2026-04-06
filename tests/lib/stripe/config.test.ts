import { describe, it, expect } from "vitest";
import { PLANS, getPlanByPriceId, getFreeLimits, getProLimits } from "@/lib/stripe/config";

describe("stripe config", () => {
  it("exports free and pro plans", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.free.name).toBe("Free");
    expect(PLANS.pro.name).toBe("Pro");
  });

  it("free plan has correct limits", () => {
    const limits = getFreeLimits();
    expect(limits.planGenerations).toBe(1);
    expect(limits.aiRequests).toBe(5);
    expect(limits.toolSearches).toBe(10);
  });

  it("pro plan has unlimited marker", () => {
    const limits = getProLimits();
    expect(limits.planGenerations).toBe(-1);
    expect(limits.aiRequests).toBe(-1);
    expect(limits.toolSearches).toBe(-1);
  });

  it("getPlanByPriceId returns pro for matching price", () => {
    const result = getPlanByPriceId("price_placeholder");
    expect(result).toBe("pro");
  });

  it("getPlanByPriceId returns null for unknown price", () => {
    const result = getPlanByPriceId("price_unknown_xxx");
    expect(result).toBeNull();
  });
});
