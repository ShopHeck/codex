import { describe, expect, it } from "vitest";

function calc(revenue: number, costs: number) {
  const net = revenue - costs;
  return { net, margin: revenue ? net / revenue : 0 };
}

describe("profit calculation", () => {
  it("calculates net and margin", () => {
    const result = calc(100, 70);
    expect(result.net).toBe(30);
    expect(result.margin).toBe(0.3);
  });
});
