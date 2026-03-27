import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl, generateState, normalizeShopDomain } from "@/lib/shopify/oauth";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  if (!shop) return NextResponse.redirect(new URL("/install", req.url));

  const normalized = normalizeShopDomain(shop);
  const state = generateState();
  const authUrl = buildAuthUrl(normalized, state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
  return res;
}
