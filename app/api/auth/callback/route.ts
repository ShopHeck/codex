import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, normalizeShopDomain, verifyHmac } from "@/lib/shopify/oauth";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/shopify/session";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");

  if (!code || !shop) {
    return NextResponse.redirect(new URL("/install?error=missing_oauth_params", req.url));
  }

  if (!verifyHmac(params)) {
    return NextResponse.redirect(new URL("/install?error=invalid_hmac", req.url));
  }

  const stateCookie = req.cookies.get("oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(new URL("/install?error=invalid_state", req.url));
  }

  let normalizedShop: string;
  try {
    normalizedShop = normalizeShopDomain(shop);
  } catch {
    return NextResponse.redirect(new URL("/install?error=invalid_shop", req.url));
  }

  try {
    const token = await exchangeCodeForToken(normalizedShop, code);
    const store = await prisma.shopifyStore.upsert({
      where: { shopDomain: normalizedShop },
      update: { accessToken: token.access_token },
      create: { shopDomain: normalizedShop, accessToken: token.access_token }
    });

    const session = signSession({ shop: normalizedShop, storeId: store.id });
    const res = NextResponse.redirect(new URL("/api/billing/status", req.url));

    res.cookies.set("oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
    res.cookies.set("rp_session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
    return res;
  } catch {
    return NextResponse.redirect(new URL("/install?error=token_exchange_failed", req.url));
  }
}
