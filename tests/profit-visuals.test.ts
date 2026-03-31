import { describe, expect, it } from "vitest";
import { formatWaterfallTotal, getNetProfitBarColor, getNetProfitVisualState } from "@/lib/profit-visuals";

describe("profit visuals regression", () => {
  it("preserves minus sign in waterfall total for negative net profit", () => {
    expect(formatWaterfallTotal(-123.45)).toBe("-$123.45");
  });

  it("renders negative net profit bars in loss state", () => {
    expect(getNetProfitVisualState(-0.01)).toBe("loss");
    expect(getNetProfitBarColor(-0.01)).toBe("#dc2626");
  });
});
