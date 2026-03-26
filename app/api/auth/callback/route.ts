import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, normalizeShopDomain, verifyHmac } from "@/lib/shopify/oauth";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/shopify/session";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");

  if (!code || !shop || !verifyHmac(params)) {
    return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
  }

  const stateCookie = req.cookies.get("oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const normalizedShop = normalizeShopDomain(shop);
  const token = await exchangeCodeForToken(normalizedShop, code);

  const store = await prisma.shopifyStore.upsert({
    where: { shopDomain: normalizedShop },
    update: { accessToken: token.access_token },
    create: { shopDomain: normalizedShop, accessToken: token.access_token }
  });

  const session = signSession({ shop: normalizedShop, storeId: store.id });
  const res = NextResponse.redirect(new URL("/api/billing/status", req.url));
  res.cookies.set("rp_session", session, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  return res;
}
