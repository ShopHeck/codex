import { describe, expect, it } from "vitest";
import { getProductStatus } from "@/lib/services/insights";

describe("product status rules", () => {
  it("marks negative margin as cut candidate", () => {
    expect(
      getProductStatus({ marginPercent: -0.01, refundRate: 0.01, shippingBurden: 0.05, netProfit: -1 })
    ).toBe("Cut Candidate");
  });

  it("marks low positive margin as needs fix", () => {
    expect(getProductStatus({ marginPercent: 0.05, refundRate: 0.01, shippingBurden: 0.05, netProfit: 5 })).toBe(
      "Needs Fix"
    );
  });

  it("marks strong margin as scale", () => {
    expect(getProductStatus({ marginPercent: 0.3, refundRate: 0.01, shippingBurden: 0.05, netProfit: 30 })).toBe(
      "Scale"
    );
  });

  it("marks middle margin as healthy", () => {
    expect(getProductStatus({ marginPercent: 0.2, refundRate: 0.01, shippingBurden: 0.1, netProfit: 20 })).toBe(
      "Healthy"
    );
  });
});
