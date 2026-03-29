import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { normalizeShopDomain, verifyHmac } from "@/lib/shopify/oauth";
import { verifySession } from "@/lib/shopify/session";
import { config } from "@/lib/config";

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

  it("returns false when hmac has matching character count but different byte length", () => {
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
    params.set("hmac", "é".repeat(validHmac.length));

    expect(verifyHmac(params)).toBe(false);
  });

});

describe("normalizeShopDomain", () => {
  it("normalizes protocol/path and casing to canonical myshopify domain", () => {
    expect(normalizeShopDomain("HTTPS://Demo-Store.MyShopify.com/admin")).toBe("demo-store.myshopify.com");
  });

  it("rejects invalid shop hostnames", () => {
    expect(() => normalizeShopDomain("evil.com")).toThrowError("Invalid shop domain");
    expect(() => normalizeShopDomain("https://.myshopify.com")).toThrowError("Invalid shop domain");
  });
});

describe("session payload validation", () => {
  it("rejects jwt payloads that do not include required string fields", () => {
    const malformed = jwt.sign({ foo: "bar" }, config.sessionJwtSecret, { expiresIn: "7d" });
    expect(verifySession(malformed)).toBeNull();
  });
});
