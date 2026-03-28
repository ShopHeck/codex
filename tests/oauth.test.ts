import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHmac } from "@/lib/shopify/oauth";

describe("verifyHmac", () => {
  it("returns false for malformed hmac lengths instead of throwing", () => {
    const params = new URLSearchParams({
      code: "abc123",
      shop: "demo.myshopify.com",
      state: "xyz"
    });

    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const validHmac = crypto.createHmac("sha256", "").update(message).digest("hex");
    params.set("hmac", validHmac.slice(0, validHmac.length - 1));

    expect(verifyHmac(params)).toBe(false);
  });
});
