import { describe, expect, it } from "vitest";
import { getProductStatus } from "@/lib/services/insights";

describe("product status rules", () => {
  it("marks negative margin as cut candidate", () => {
    expect(getProductStatus(-0.01)).toBe("Cut Candidate");
  });

  it("marks low positive margin as needs fix", () => {
    expect(getProductStatus(0.05)).toBe("Needs Fix");
  });

  it("marks strong margin as scale", () => {
    expect(getProductStatus(0.3)).toBe("Scale");
  });

  it("marks middle margin as healthy", () => {
    expect(getProductStatus(0.2)).toBe("Healthy");
  });
});
